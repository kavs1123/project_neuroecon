"""Simulate raw jsPsych CSVs in the exact format the experiment writes.

Uses: (1) testing preprocess/analysis end-to-end before real data exists, (2) checking that
the pipeline recovers planted effects, (3) a simulation-based power/sensitivity analysis (power.py).

    python analysis/simulate.py --n 30 --out data/simulated/raw --seed 1

Design v0.4: 12 scam + 12 legit offers, 20 s deadline on high-urgency offers (some expire), a check budget
(~1 per offer), one 'deliberation' item instead of gut/careful, no legitimacy rating.

Planted effects on scam-trial intent (0-100 scale), effect-coded predictors (+-0.5):
    frame (loss-gain) = +3, urgency (high-low) = +6, frame x urgency = +8,
    each revealed cue lowers intent by 5 points; urgency lowers cues revealed.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from common import STIMULI, CELLS

DEFAULT_EFFECTS = dict(frame=3.0, urgency=6.0, interaction=8.0, cue_b=-5.0, urg_on_cues=-0.35, p_timeout=0.03)
DEADLINE_S = 20


def simulate_participant(pid, list_idx, stim, rng, eff, kind="normal"):
    scams = [s for s in stim["scenarios"] if s["type"] == "scam"]
    legits = [s for s in stim["scenarios"] if s["type"] == "legit"]
    item_eff = simulate_participant.item_eff
    u = rng.normal(0, 12)            # person: general willingness
    sens = rng.normal(0, 8)          # person: scam discrimination
    cue_tend = rng.normal(0, 0.35)   # person: tendency to check details
    rt_person = rng.normal(0, 0.3)
    button_side = rng.choice(["left", "right"])

    trials = []
    for type_, items in (("scam", scams), ("legit", legits)):
        for i, sc in enumerate(items):
            cell = CELLS[(i + list_idx) % 4]
            frame, urg = cell.split("_")
            trials.append((sc, type_, frame, urg, cell))
    order = rng.permutation(len(trials))
    trials = [trials[k] for k in order]
    att_pos = rng.integers(8, 17)
    trials.insert(att_pos, (stim["attention_check"], "check", "none", "none", "attention"))

    common = dict(participant_id=pid, list=list_idx, list_source="sim", accept_button_side=button_side,
                  pilot=0, study_version="sim", start_iso="2026-11-07T10:00:00Z")
    rows = [dict(task="consent", response=0, rt=4000, trial_type="html-button-response")]
    rows.append(dict(task="browser_check", width=1366, height=768, browser="chrome", mobile=False, os="windows"))
    elapsed = 60000

    for p_sc, p_type, p_frame, p_urg in ((stim["practice"][0], "legit", "gain", "low"), (stim["practice"][1], "scam", "loss", "high")):
        base = dict(scenario_id=p_sc["id"], offer_type=p_type, frame=p_frame, urgency=p_urg,
                    cell=f"{p_frame}_{p_urg}", is_practice=1, trial_num=-1)
        rows.append(dict(task="offer", rt=15000, choice="ignore", accept=0, n_cues=1, **base))
        rows.append(dict(task="ratings", rt=9000, intent=40, urg_check=4, frame_check="gain", deliberation=4, **base))

    for t, (sc, type_, frame, urg, cell) in enumerate(trials, start=1):
        base = dict(scenario_id=sc["id"], offer_type=type_, frame=frame, urgency=urg, cell=cell,
                    domain=sc["domain"], sender=sc["sender"], is_practice=0, trial_num=t)
        if type_ == "check":
            fail = kind == "attention_fail"
            rt = rng.lognormal(np.log(9000), 0.3)
            rows.append(dict(task="offer", rt=round(rt), choice="accept" if fail else "ignore", accept=int(fail), n_cues=0, **base))
            rows.append(dict(task="ratings", rt=8000, intent=70 if fail else 0, urg_check=1, frame_check="gain", deliberation=4, **base))
            continue
        f = -0.5 if frame == "gain" else 0.5
        g = -0.5 if urg == "low" else 0.5
        lam = np.exp(np.log(0.9) + cue_tend + eff["urg_on_cues"] * g)
        n_cues = int(min(3, rng.poisson(lam)))
        if kind == "speeder":
            n_cues = 0
        opened = list(rng.choice(["sender", "company", "payment"], size=n_cues, replace=False)) if n_cues else []
        if type_ == "scam":
            mu = 30 + u - sens + item_eff[sc["id"]] + eff["frame"] * f + eff["urgency"] * g + eff["interaction"] * f * g + eff["cue_b"] * (n_cues - 0.9)
        else:
            mu = 62 + u + sens + item_eff[sc["id"]] + 2 * g
        intent = float(np.clip(np.round(mu + rng.normal(0, 15)), 0, 100))
        accept = int(rng.random() < 1 / (1 + np.exp(-(intent - 50) / 8)))
        rt = rng.lognormal(np.log(9000) + 0.25 * n_cues - 0.15 * g + rt_person, 0.35)
        if kind == "speeder":
            rt = rng.lognormal(np.log(1800), 0.2)
        rt = round(rt)
        timeout = urg == "high" and (rt > DEADLINE_S * 1000 or rng.random() < eff["p_timeout"])
        # cue events consistent with n_cues
        ev, tcur, dwell = [], 800, {"sender": 0, "company": 0, "payment": 0}
        for c in opened:
            d = int(rng.integers(800, 3500))
            ev.append({"cue": c, "open": tcur, "close": min(rt, tcur + d)})
            dwell[c] = ev[-1]["close"] - tcur
            tcur += d + 300
        rows.append(dict(
            task="offer", rt=None if timeout else rt, response=None if timeout else (0 if accept else 1),
            choice="timeout" if timeout else ("accept" if accept else "ignore"), accept=None if timeout else accept,
            timeout=int(timeout), deadline_s=DEADLINE_S if urg == "high" else None, n_checks_denied=0,
            cue_events=json.dumps(ev), n_cues=n_cues, n_cue_opens=n_cues, cue_dwell_ms=sum(dwell.values()),
            dwell_sender_ms=dwell["sender"], dwell_company_ms=dwell["company"], dwell_payment_ms=dwell["payment"],
            opened_sender="sender" in opened, opened_company="company" in opened, opened_payment="payment" in opened,
            first_cue_ms=ev[0]["open"] if ev else None, mouse_tracking_data="[]", **base))
        urg_check = int(np.clip(np.round(2.8 + 2.4 * (g + 0.5) + rng.normal(0, 1.1)), 1, 7))
        frame_check = frame if rng.random() < 0.8 else ("loss" if frame == "gain" else "gain")
        deliberation = int(np.clip(np.round(4 - 1.1 * g + 0.7 * (n_cues - 0.9) + rng.normal(0, 1.2)), 1, 7))
        rows.append(dict(task="ratings", rt=round(rng.lognormal(np.log(8000), 0.3)), intent=intent,
                         urg_check=urg_check, frame_check=frame_check, deliberation=deliberation, **base))
        if t == 12:
            rows.append(dict(task="break", rt=3000))

    p_crt = rng.beta(3, 2)
    right, wrong = ["2nd", "8", "Emily", "0"], ["first", "7", "June", "27"]
    rows.append(dict(task="crt", **{f"crt_{k + 1}": (right[k] if rng.random() < p_crt else wrong[k]) for k in range(4)}))
    rows.append(dict(task="demographics", age=int(rng.integers(18, 27)), gender=rng.choice(["Woman", "Man"]),
                     occupation=rng.choice(["Student", "Working", "Student and working"]),
                     job_seeking=rng.choice(["Yes", "No"]), messaging_hours=rng.choice(["1–2", "3–4", "5 or more"])))
    rows.append(dict(task="scam_exposure", exp_received=rng.choice(["Yes", "No"], p=[0.75, 0.25]),
                     exp_engaged=rng.choice(["Yes", "No"], p=[0.15, 0.85]), exp_lost=rng.choice(["Yes", "No"], p=[0.05, 0.95]),
                     exp_close_lost=rng.choice(["Yes", "No", "Not sure"])))
    rows.append(dict(task="funnel_debrief", funnel_purpose="job offers", funnel_noticed="timers",
                     funnel_suspect_scam=rng.choice(["Yes", "Unsure"]), funnel_guess_hyp=rng.choice(["Yes", "No", "Unsure"])))
    rows.append(dict(task="reconsent", response=0, keep_data=1))

    df = pd.DataFrame(rows)
    for k, v in common.items():
        df[k] = v
    df["time_elapsed"] = elapsed + np.cumsum(df["rt"].fillna(5000)).astype(int)
    df["trial_index"] = range(len(df))
    return df


def simulate(n, out, seed=1, eff=None, extra_bad=True, write=True):
    """Simulate n valid participants (+ 3 to-be-excluded ones if extra_bad). Returns list of DataFrames."""
    eff = {**DEFAULT_EFFECTS, **(eff or {})}
    stim = json.loads(Path(STIMULI).read_text(encoding="utf-8"))
    rng = np.random.default_rng(seed)
    simulate_participant.item_eff = {s["id"]: rng.normal(0, 7) for s in stim["scenarios"]}
    kinds = ["normal"] * n + (["attention_fail", "speeder"] if extra_bad else [])
    dfs = []
    out = Path(out)
    if write:
        out.mkdir(parents=True, exist_ok=True)
        for f in out.glob("*.csv"):
            f.unlink()
    for i, kind in enumerate(kinds):
        pid = f"SIM{i:03d}"
        df = simulate_participant(pid, i % 4, stim, rng, eff, kind)
        dfs.append(df)
        if write:
            df.to_csv(out / f"{pid}.csv", index=False)
    if write and extra_bad:  # a participant who withdrew at reconsent
        (out / "SIMWD.csv").write_text("participant_id,withdrawn,study_version\nSIMWD,1,sim\n")
    return dfs


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=30)
    ap.add_argument("--out", default="data/simulated/raw")
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    simulate(a.n, a.out, a.seed)
    print(f"simulated {a.n} valid + 2 excluded + 1 withdrawn participants -> {a.out}")
