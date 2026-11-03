"""Raw jsPsych CSVs (one per participant) -> tidy trial and participant tables + exclusion log.

    python analysis/preprocess.py --raw data/raw --out data/processed
    python analysis/preprocess.py --raw data/simulated/raw --out data/simulated/processed

Pilot files (filename starting 'pilot_' or pilot==1) are skipped unless --include-pilot / --only-pilot is given.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from common import (TEST_SESSIONS, ATTN_MAX_INTENT, FRAME_CODE, MIN_MEDIAN_RT_MS, MIN_TRIAL_RT_MS, SCAM_CODE,
                    TRIAL_LOGRT_SD, URG_CODE, score_crt)

KEYS = ["participant_id", "scenario_id", "is_practice"]
skipped = []  # files with no trials (declined consent, failed device check)
test_skipped = []  # researcher test sessions (common.TEST_SESSIONS)


def load_raw(raw_dir, include_pilot=False, only_pilot=False):
    frames, withdrawn = [], []
    global skipped
    for f in sorted(Path(raw_dir).glob("*.csv")):
        df = pd.read_csv(f, low_memory=False)
        if "participant_id" in df.columns and str(df["participant_id"].iloc[0]) in TEST_SESSIONS:
            test_skipped.append(f.name)
            continue
        is_pilot = f.name.startswith("pilot_") or ("pilot" in df.columns and (df["pilot"] == 1).any())
        if (is_pilot and not (include_pilot or only_pilot)) or (only_pilot and not is_pilot):
            continue
        if "withdrawn" in df.columns:
            withdrawn.append(str(df["participant_id"].iloc[0]))
            continue
        if "declined" in df.columns or "task" not in df.columns or not (df["task"] == "offer").any():
            skipped.append(f.name)  # declined consent / failed device check: no trials
            continue
        df["source_file"] = f.name
        frames.append(df)
    if not frames:
        raise SystemExit(f"no participant files found in {raw_dir}")
    return pd.concat(frames, ignore_index=True), withdrawn


def person_value(raw, task, col):
    s = raw.loc[raw["task"] == task, ["participant_id", col]].dropna().drop_duplicates("participant_id")
    return s.set_index("participant_id")[col]


def build(raw):
    raw = raw.copy()
    raw["participant_id"] = raw["participant_id"].astype(str)
    offers = raw[raw["task"] == "offer"].copy()
    ratings = raw[raw["task"] == "ratings"].copy()
    rcols = ["intent", "legit_rating", "urg_check", "frame_check", "gut", "careful", "rt"]
    ratings = ratings[KEYS + rcols].rename(columns={"rt": "ratings_rt_ms"})
    ocols = ["participant_id", "list", "accept_button_side", "trial_num", "scenario_id", "is_practice", "offer_type",
             "frame", "urgency", "cell", "domain", "rt", "choice", "accept", "n_cues", "n_cue_opens", "cue_dwell_ms",
             "dwell_sender_ms", "dwell_company_ms", "dwell_payment_ms", "opened_payment", "first_cue_ms"]
    offers = offers[[c for c in ocols if c in offers.columns]].rename(columns={"rt": "rt_ms"})
    t = offers.merge(ratings, on=KEYS, how="left", validate="one_to_one")

    t["is_practice"] = t["is_practice"].astype(int)
    t["accept"] = t["accept"].astype(int)
    t["ignore"] = 1 - t["accept"]
    t["log_rt"] = np.log(t["rt_ms"])
    t["opened_payment"] = t["opened_payment"].astype(str).str.lower().eq("true").astype(int)
    t["heuristic"] = (t["gut"] + (8 - t["careful"])) / 2
    t["frame_c"] = t["frame"].map(FRAME_CODE)
    t["urg_c"] = t["urgency"].map(URG_CODE)
    t["scam_c"] = t["offer_type"].map(SCAM_CODE)
    t["frame_check_correct"] = (t["frame_check"] == t["frame"]).astype(float).where(t["frame"].isin(["gain", "loss"]))
    # classification accuracy: ignore scams, accept legit offers
    t["correct"] = np.where(t["offer_type"] == "scam", t["ignore"], np.where(t["offer_type"] == "legit", t["accept"], np.nan))

    # ---------- participant table ----------
    pids = sorted(t["participant_id"].unique())
    p = pd.DataFrame(index=pd.Index(pids, name="participant_id"))
    p["list"] = t.groupby("participant_id")["list"].first()
    p["accept_button_side"] = t.groupby("participant_id")["accept_button_side"].first()
    crt = raw[raw["task"] == "crt"].set_index("participant_id")[[f"crt_{k}" for k in range(1, 5)]]
    p["crt"] = crt.apply(lambda r: score_crt(r.values), axis=1)
    for task, cols in {"demographics": ["age", "gender", "occupation", "job_seeking", "messaging_hours"],
                       "scam_exposure": ["exp_received", "exp_engaged", "exp_lost", "exp_close_lost"],
                       "funnel_debrief": ["funnel_purpose", "funnel_noticed", "funnel_suspect_scam", "funnel_guess_hyp"],
                       "reconsent": ["keep_data"],
                       "browser_check": ["browser", "os", "width", "height"]}.items():
        for c in cols:
            if c in raw.columns:
                p[c] = person_value(raw, task, c)
    yes = lambda c: p.get(c, pd.Series(index=p.index, dtype=object)).eq("Yes")
    p["scam_exp"] = np.select([yes("exp_lost"), yes("exp_engaged"), yes("exp_received")], [3, 2, 1], 0)
    p["duration_min"] = raw.groupby("participant_id")["time_elapsed"].max() / 60000

    main = t[(t["is_practice"] == 0) & t["offer_type"].isin(["scam", "legit"])]
    att = t[t["offer_type"] == "check"].set_index("participant_id")
    p["n_main_trials"] = main.groupby("participant_id").size()
    p["attention_pass"] = ((att["choice"] == "ignore") & (att["intent"] <= ATTN_MAX_INTENT)).reindex(p.index).fillna(False)
    p["median_rt_ms"] = main.groupby("participant_id")["rt_ms"].median()
    p["completed"] = p["keep_data"].eq(1) & p["n_main_trials"].eq(32)

    # ---------- exclusions (analysis_plan §3, in order) ----------
    reason = pd.Series("", index=p.index)
    reason[~p["completed"]] = "incomplete"
    reason[(reason == "") & ~p["attention_pass"]] = "attention_check"
    reason[(reason == "") & (p["median_rt_ms"] < MIN_MEDIAN_RT_MS)] = "median_rt_too_fast"
    p["excluded"] = reason != ""
    p["exclusion_reason"] = reason

    main = main[main["participant_id"].isin(p.index[~p["excluded"]])].copy()
    mu = main.groupby("participant_id")["log_rt"].transform("mean")
    sd = main.groupby("participant_id")["log_rt"].transform("std")
    main["trial_excluded"] = (main["rt_ms"] < MIN_TRIAL_RT_MS) | (main["log_rt"] > mu + TRIAL_LOGRT_SD * sd)
    return main, p.reset_index()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="data/raw")
    ap.add_argument("--out", default="data/processed")
    ap.add_argument("--include-pilot", action="store_true", help="analyse pilot + main files together")
    ap.add_argument("--only-pilot", action="store_true", help="analyse pilot files only")
    a = ap.parse_args()
    raw, withdrawn = load_raw(a.raw, a.include_pilot, a.only_pilot)
    trials, people = build(raw)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    trials.to_csv(out / "trials.csv", index=False)
    people.to_csv(out / "participants.csv", index=False)
    log = {
        "files_participants": int(len(people)) + len(withdrawn),
        "withdrawn_at_reconsent": len(withdrawn),
        "no_trial_files_skipped": len(skipped),
        "researcher_test_sessions_skipped": len(test_skipped),
        "excluded_participants": people.loc[people["excluded"], "exclusion_reason"].value_counts().to_dict(),
        "valid_participants": int((~people["excluded"]).sum()),
        "per_list_valid": people.loc[~people["excluded"], "list"].value_counts().sort_index().to_dict(),
        "trials_valid_participants": int(len(trials)),
        "trials_excluded": int(trials["trial_excluded"].sum()),
    }
    (out / "exclusions.json").write_text(json.dumps(log, indent=2, default=int))
    print(json.dumps(log, indent=2, default=int))


if __name__ == "__main__":
    main()
