"""Simulation-based power / sensitivity analysis for the scam-trial effects.

For each (N, interaction size) we simulate full datasets with simulate.py's generative model, run the
real preprocessing, and fit (a) the 2x2 RM-ANOVA and (b) the crossed LMM. Power = share of p < .05.

    python analysis/power.py --sims 150 --out results_sim/power.csv
"""
import argparse
import itertools
import warnings

import numpy as np
import pandas as pd
import pingouin as pg

import simulate
from analysis import crossed_lmm
from preprocess import build

warnings.filterwarnings("ignore")


def one_run(n, interaction, seed):
    dfs = simulate.simulate(n, out=".", seed=seed, eff={"interaction": interaction}, extra_bad=False, write=False)
    trials, _ = build(pd.concat(dfs, ignore_index=True))
    scam = trials[trials["offer_type"] == "scam"]
    cm = scam.groupby(["participant_id", "frame", "urgency"])["intent"].mean().reset_index()
    aov = pg.rm_anova(data=cm, dv="intent", within=["frame", "urgency"], subject="participant_id").set_index("Source")
    pcol = "p_unc" if "p_unc" in aov.columns else "p-unc"
    lmm = crossed_lmm("intent ~ frame_c * urg_c", scam)
    return {"aov_frame": aov.loc["frame", pcol], "aov_urg": aov.loc["urgency", pcol], "aov_int": aov.loc["frame * urgency", pcol],
            "lmm_frame": lmm.pvalues["frame_c"], "lmm_urg": lmm.pvalues["urg_c"], "lmm_int": lmm.pvalues["frame_c:urg_c"]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sims", type=int, default=150)
    ap.add_argument("--ns", default="25,30,35")
    ap.add_argument("--interactions", default="4,8,12")
    ap.add_argument("--out", default="results_sim/power.csv")
    a = ap.parse_args()
    rows = []
    for n, ix in itertools.product(map(int, a.ns.split(",")), map(float, a.interactions.split(","))):
        ps = pd.DataFrame([one_run(n, ix, seed) for seed in range(a.sims)])
        power = (ps < 0.05).mean().to_dict()
        rows.append({"N": n, "interaction_pts": ix, **power})
        print(rows[-1], flush=True)
    out = pd.DataFrame(rows)
    out.to_csv(a.out, index=False)
    print("\n" + out.round(2).to_markdown(index=False))


if __name__ == "__main__":
    main()
