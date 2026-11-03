"""All confirmatory + exploratory analyses from docs/analysis_plan.md.

    python analysis/analysis.py --processed data/processed --out results
    python analysis/analysis.py --processed data/simulated/processed --out results_sim

Writes <out>/results.md (human-readable), <out>/results.json (numbers for the report) and <out>/figures/*.png.
"""
import argparse
import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import pingouin as pg
import statsmodels.api as sm
import statsmodels.formula.api as smf
from scipy import stats
from statsmodels.genmod.bayes_mixed_glm import BinomialBayesMixedGLM

from common import loglinear_dprime

warnings.filterwarnings("ignore")
VC = {"pid": "0 + C(participant_id)", "item": "0 + C(scenario_id)"}
RNG = np.random.default_rng(2026)
OUT = {}      # numbers for results.json
MD = []       # markdown lines


def h(title, level=2):
    MD.append(f"\n{'#' * level} {title}\n")


def table(df, floatfmt=".3f"):
    MD.append(df.to_markdown(floatfmt=floatfmt) + "\n")


def para(s):
    MD.append(s + "\n")


def fmt_p(p):
    return "< .001" if p < 0.001 else f"{p:.3f}"


def dz(diff):
    diff = np.asarray(diff, float)
    d = diff.mean() / diff.std(ddof=1)
    n = len(diff)
    se = np.sqrt(1 / n + d ** 2 / (2 * n))
    return d, d - 1.96 * se, d + 1.96 * se


def paired(a, b, label):
    """Paired comparison a vs b (participant-level arrays): t, Wilcoxon, d_z."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    t = stats.ttest_rel(a, b)
    w = stats.wilcoxon(a, b)
    d, lo, hi = dz(a - b)
    ci = stats.t.interval(0.95, len(a) - 1, loc=(a - b).mean(), scale=stats.sem(a - b))
    return {"comparison": label, "mean_a": a.mean(), "mean_b": b.mean(), "diff": (a - b).mean(), "diff_ci_lo": ci[0],
            "diff_ci_hi": ci[1], "t": t.statistic, "df": len(a) - 1, "p": t.pvalue, "wilcoxon_p": w.pvalue,
            "d_z": d, "d_z_lo": lo, "d_z_hi": hi}


def crossed_lmm(formula, data):
    d = data.assign(_one=1)
    return smf.mixedlm(formula, d, groups="_one", re_formula="0", vc_formula=VC).fit(reml=True)


def coef_table(fit, terms=None):
    ci = fit.conf_int()
    rows = []
    for k in fit.fe_params.index if hasattr(fit, "fe_params") else fit.params.index:
        if terms and k not in terms:
            continue
        rows.append({"term": k, "b": fit.params[k], "se": fit.bse[k], "ci_lo": ci.loc[k, 0], "ci_hi": ci.loc[k, 1], "p": fit.pvalues[k]})
    return pd.DataFrame(rows).set_index("term")


# ------------------------------------------------------------------ sections
def describe(t, p):
    h("1. Sample")
    v = p[~p["excluded"]]
    OUT["sample"] = {"n_files": int(len(p)), "n_valid": int(len(v)),
                     "excluded": p.loc[p["excluded"], "exclusion_reason"].value_counts().to_dict(),
                     "age_mean": float(pd.to_numeric(v["age"], errors="coerce").mean()),
                     "age_sd": float(pd.to_numeric(v["age"], errors="coerce").std()),
                     "duration_median_min": float(v["duration_min"].median()),
                     "per_list": v["list"].value_counts().sort_index().to_dict(),
                     "trials_used": int((~t["trial_excluded"]).sum()), "trials_excluded": int(t["trial_excluded"].sum())}
    s = OUT["sample"]
    para(f"Valid participants: **{s['n_valid']}** of {s['n_files']} (excluded: {s['excluded'] or 'none'}). "
         f"Age M = {s['age_mean']:.1f} (SD {s['age_sd']:.1f}); median duration {s['duration_median_min']:.1f} min. "
         f"Per list: {s['per_list']}. Trials analysed: {s['trials_used']} ({s['trials_excluded']} excluded by RT rules).")
    para("Descriptives by offer type × cell (trial level). `accept` excludes expired offers; `timeout` = share of offers that expired "
         "(possible only under high urgency); `cues` = detail boxes opened (budget-limited).")
    desc = t.groupby(["offer_type", "cell"]).agg(accept=("accept", "mean"), timeout=("timeout", "mean"), intent=("intent", "mean"),
                                                  cues=("n_cues", "mean"), rt_s=("rt_ms", lambda x: x.median() / 1000)).round(3)
    table(desc)
    OUT["descriptives"] = desc.reset_index().to_dict(orient="records")


def manipulation_checks(t):
    h("2. Manipulation checks")
    pm = t.groupby(["participant_id", "urgency"])["urg_check"].mean().unstack()
    u = paired(pm["high"], pm["low"], "felt urgency: high − low")
    acc = t.groupby("participant_id")["frame_check_correct"].mean()
    tt = stats.ttest_1samp(acc, 0.5)
    w = stats.wilcoxon(acc - 0.5)
    by_cell = t.groupby("cell")["frame_check_correct"].mean()
    OUT["manip"] = {"urgency": u, "frame_accuracy_mean": acc.mean(), "frame_t": tt.statistic, "frame_p": tt.pvalue,
                    "frame_wilcoxon_p": w.pvalue, "frame_accuracy_by_cell": by_cell.to_dict()}
    table(pd.DataFrame([u]).set_index("comparison"))
    para(f"Frame identification accuracy: M = {acc.mean():.2f} vs chance .50, t({len(acc) - 1}) = {tt.statistic:.2f}, "
         f"p {fmt_p(tt.pvalue)} (Wilcoxon p {fmt_p(w.pvalue)}). By cell: "
         + ", ".join(f"{k} {v:.2f}" for k, v in by_cell.items()) + ".")


def h1_h3(scam, people):
    h("3. H1–H3: framing, urgency and their interaction (scam offers)")
    cm = scam.groupby(["participant_id", "frame", "urgency"])["intent"].mean().reset_index()
    aov = pg.rm_anova(data=cm, dv="intent", within=["frame", "urgency"], subject="participant_id", detailed=True, effsize="np2")
    aov = aov.set_index("Source")
    h("3a. Repeated-measures ANOVA on compliance intent (participant cell means)", 3)
    para("Both factors have 2 levels, so sphericity holds by definition (Greenhouse–Geisser ε = 1).")
    keep = [c for c in ["F", "ddof1", "ddof2", "p_unc", "p-unc", "np2"] if c in aov.columns]
    table(aov[keep])
    pcol = "p_unc" if "p_unc" in aov.columns else "p-unc"
    OUT["rm_anova"] = {src: {"F": float(aov.loc[src, "F"]), "df1": float(aov.loc[src, "ddof1"]), "df2": float(aov.loc[src, "ddof2"]),
                             "p": float(aov.loc[src, pcol]), "np2": float(aov.loc[src, "np2"])}
                       for src in ["frame", "urgency", "frame * urgency"]}
    ps = [OUT["rm_anova"][k]["p"] for k in ["frame", "urgency", "frame * urgency"]]
    holm = pg.multicomp(ps, method="holm")[1]
    para("Holm-corrected p (frame, urgency, interaction): " + ", ".join(fmt_p(x) for x in holm))
    OUT["rm_anova_holm"] = list(map(float, holm))

    h("3b. Cell means (participant level) and simple effects of frame", 3)
    wide = cm.pivot_table(index="participant_id", columns=["frame", "urgency"], values="intent")
    cells = wide.agg(["mean", "std"]).T
    table(cells)
    se = [paired(wide[("loss", u)], wide[("gain", u)], f"loss − gain | urgency {u}") for u in ["high", "low"]]
    se.append(paired(wide[("loss", "high")] - wide[("gain", "high")], wide[("loss", "low")] - wide[("gain", "low")],
                     "frame effect: high − low urgency (interaction contrast)"))
    se_df = pd.DataFrame(se).set_index("comparison")
    table(se_df[["diff", "diff_ci_lo", "diff_ci_hi", "t", "p", "wilcoxon_p", "d_z", "d_z_lo", "d_z_hi"]])
    OUT["simple_effects"] = se

    h("3c. Linear mixed model: intent ~ frame × urgency + (1|participant) + (1|scenario)", 3)
    lmm = crossed_lmm("intent ~ frame_c * urg_c", scam)
    ct = coef_table(lmm, ["Intercept", "frame_c", "urg_c", "frame_c:urg_c"])
    table(ct)
    OUT["lmm"] = ct.reset_index().to_dict(orient="records")
    para("Effect-coded (±0.5): `frame_c` = loss − gain, `urg_c` = high − low; the interaction is the difference "
         "in the frame effect between high and low urgency (points on the 0–100 scale).")

    h("3d. GLMM (logit): accept ~ frame × urgency + (1|participant) + (1|scenario)", 3)
    para(f"Expired offers excluded from the choice models: {int(scam['timeout'].sum())} of {len(scam)} scam trials "
         f"(participants were told these count as not accepted; §3f treats them as Ignore as a robustness check).")
    choice = scam.dropna(subset=["accept"])
    g = BinomialBayesMixedGLM.from_formula("accept ~ frame_c * urg_c", VC, choice).fit_vb()
    names = g.model.exog_names
    rows = []
    for i, nme in enumerate(names):
        m, s = g.fe_mean[i], g.fe_sd[i]
        rows.append({"term": nme, "log_odds": m, "sd": s, "OR": np.exp(m), "OR_lo": np.exp(m - 1.96 * s),
                     "OR_hi": np.exp(m + 1.96 * s), "p_approx": 2 * stats.norm.sf(abs(m / s))})
    gt = pd.DataFrame(rows).set_index("term")
    table(gt)
    para("Variational-Bayes GLMM (statsmodels); 95% intervals are approximate posterior intervals. "
         "Robustness check: GEE (logit, exchangeable within participant) below.")
    gee = smf.gee("accept ~ frame_c * urg_c", "participant_id", choice, family=sm.families.Binomial(),
                  cov_struct=sm.cov_struct.Exchangeable()).fit()
    gee_t = coef_table(gee)
    gee_t["OR"] = np.exp(gee_t["b"])
    table(gee_t)
    OUT["glmm"] = gt.reset_index().to_dict(orient="records")
    OUT["gee_accept"] = gee_t.reset_index().to_dict(orient="records")

    h("3e. Covariates and exploratory moderation (CRT × urgency)", 3)
    d = scam.merge(people[["participant_id", "crt", "scam_exp", "age"]], on="participant_id")
    for c in ["crt", "scam_exp", "age"]:
        d[c] = pd.to_numeric(d[c], errors="coerce")
        d[f"{c}_c"] = d[c] - d.groupby("participant_id")[c].first().mean()
    cov = crossed_lmm("intent ~ frame_c * urg_c + crt_c + scam_exp_c + age_c + urg_c:crt_c", d.dropna(subset=["crt_c", "age_c"]))
    ct2 = coef_table(cov)
    ct2 = ct2.drop([i for i in ct2.index if "Var" in i], errors="ignore")
    table(ct2)
    OUT["lmm_covariates"] = ct2.reset_index().to_dict(orient="records")

    h("3f. Robustness: expired offers counted as Ignore", 3)
    rob = scam.assign(accept_all=scam["accept"].fillna(0))
    gee2 = smf.gee("accept_all ~ frame_c * urg_c", "participant_id", rob, family=sm.families.Binomial(),
                   cov_struct=sm.cov_struct.Exchangeable()).fit()
    r2 = coef_table(gee2)
    r2["OR"] = np.exp(r2["b"])
    table(r2)
    OUT["gee_accept_timeouts_as_ignore"] = r2.reset_index().to_dict(orient="records")
    return cm


def sdt(t):
    h("4. Signal detection: does urgency hurt discrimination (d′) or shift acceptance bias (c)?")
    para("'Signal' = scam offer, 'yes' response = Ignore. Higher d′ = better at telling scams from legitimate offers. "
         "c is coded so that **higher c = more willing to accept** (fewer Ignore responses overall).")
    t = t.dropna(subset=["ignore"])  # expired offers have no choice
    gee = smf.gee("ignore ~ scam_c * frame_c * urg_c", "participant_id", t,
                  family=sm.families.Binomial(sm.families.links.Probit()), cov_struct=sm.cov_struct.Exchangeable()).fit()
    ct = coef_table(gee)
    lab = {"Intercept": "−c (mean criterion, sign-flipped)", "scam_c": "d′ (mean sensitivity)",
           "frame_c": "−Δc for loss frame", "urg_c": "−Δc for high urgency",
           "scam_c:frame_c": "Δd′ for loss frame", "scam_c:urg_c": "Δd′ for high urgency",
           "frame_c:urg_c": "−Δc frame × urgency", "scam_c:frame_c:urg_c": "Δd′ frame × urgency"}
    ct.insert(0, "meaning", [lab.get(i, "") for i in ct.index])
    table(ct)
    para("Probit GEE (population-averaged SDT; DeCarlo, 1998). Coefficients are in probit (z) units.")
    OUT["sdt_gee"] = ct.reset_index().to_dict(orient="records")

    rows = []
    for (pid, frame, urg), g in t.groupby(["participant_id", "frame", "urgency"]):
        s, l = g[g.offer_type == "scam"], g[g.offer_type == "legit"]
        d, c = loglinear_dprime(s["ignore"].sum(), len(s), l["ignore"].sum(), len(l))
        rows.append({"participant_id": pid, "frame": frame, "urgency": urg, "dprime": d, "c": c})
    pc = pd.DataFrame(rows)
    by_u = pc.groupby(["participant_id", "urgency"])[["dprime", "c"]].mean().unstack()
    res = [paired(by_u[("dprime", "high")], by_u[("dprime", "low")], "d′: high − low urgency"),
           paired(by_u[("c", "high")], by_u[("c", "low")], "c: high − low urgency")]
    by_f = pc.groupby(["participant_id", "frame"])[["dprime", "c"]].mean().unstack()
    res += [paired(by_f[("dprime", "loss")], by_f[("dprime", "gain")], "d′: loss − gain"),
            paired(by_f[("c", "loss")], by_f[("c", "gain")], "c: loss − gain")]
    para("Per-participant d′ / c (log-linear correction), averaged over the other factor:")
    table(pd.DataFrame(res).set_index("comparison")[["mean_a", "mean_b", "diff", "t", "p", "wilcoxon_p", "d_z"]])
    OUT["sdt_participant"] = res
    return pc


def mediation(scam):
    h("5. H4 — mechanism (exploratory multilevel mediation)")
    para("a path: M ~ frame × urgency + trial position + (1|participant); trial position controls for the shrinking check budget. "
         "b path: intent ~ M(within) + M(between) + frame × urgency + (1|participant). "
         "Indirect effect = a × b, 95% Monte Carlo CI (20,000 draws). log RT excludes expired offers.")
    res = []
    for m in ["n_cues", "log_rt", "heuristic"]:
        d = scam.dropna(subset=[m]).copy()
        d[f"{m}_pm"] = d.groupby("participant_id")[m].transform("mean")
        d[f"{m}_w"] = d[m] - d[f"{m}_pm"]
        d[f"{m}_b"] = d[f"{m}_pm"] - d[f"{m}_pm"].mean()
        fa = smf.mixedlm(f"{m} ~ frame_c * urg_c + trial_c", d, groups="participant_id").fit(reml=True)
        fb = smf.mixedlm(f"intent ~ {m}_w + {m}_b + frame_c * urg_c", d, groups="participant_id").fit(reml=True)
        for x in ["urg_c", "frame_c:urg_c"]:
            a, sa = fa.params[x], fa.bse[x]
            b, sb = fb.params[f"{m}_w"], fb.bse[f"{m}_w"]
            draws = RNG.normal(a, sa, 20000) * RNG.normal(b, sb, 20000)
            lo, hi = np.percentile(draws, [2.5, 97.5])
            res.append({"mediator": m, "X": x, "a": a, "a_p": fa.pvalues[x], "b": b, "b_p": fb.pvalues[f"{m}_w"],
                        "direct": fb.params[x], "direct_p": fb.pvalues[x], "indirect": a * b, "ind_lo": lo, "ind_hi": hi,
                        "significant": not (lo <= 0 <= hi)})
    r = pd.DataFrame(res).set_index(["mediator", "X"])
    table(r)
    OUT["mediation"] = pd.DataFrame(res).to_dict(orient="records")
    return r


def ez_diffusion(t):
    h("6. Stretch: EZ-diffusion by urgency (classification accuracy + RT)")
    para("Correct = Ignore a scam / Accept a legitimate offer. Wagenmakers et al. (2007), s = 0.1, RT in seconds "
         "(correct trials). Caveat: RT includes reading time, so parameters are only indicative.")
    s = 0.1

    def ez(pc, vrt, mrt, n):
        pc = min(max(pc, 1 / (2 * n)), 1 - 1 / (2 * n))
        if pc == 0.5:
            pc += 1 / (2 * n)
        L = np.log(pc / (1 - pc))
        x = L * (L * pc ** 2 - L * pc + pc - 0.5) / vrt
        v = np.sign(pc - 0.5) * s * x ** 0.25
        a = s ** 2 * L / v
        y = -v * a / s ** 2
        mdt = (a / (2 * v)) * (1 - np.exp(y)) / (1 + np.exp(y))
        return v, a, mrt - mdt

    rows = []
    t = t.dropna(subset=["correct"])
    for (pid, urg), g in t.groupby(["participant_id", "urgency"]):
        corr = g[g["correct"] == 1]["rt_ms"] / 1000
        if len(corr) < 3:
            continue
        v, a, ter = ez(g["correct"].mean(), corr.var(), corr.mean(), len(g))
        rows.append({"participant_id": pid, "urgency": urg, "v": v, "a": a, "Ter": ter})
    e = pd.DataFrame(rows).pivot(index="participant_id", columns="urgency")
    e = e.dropna()
    res = [paired(e[(k, "high")], e[(k, "low")], f"{k}: high − low urgency") for k in ["v", "a", "Ter"]]
    table(pd.DataFrame(res).set_index("comparison")[["mean_a", "mean_b", "diff", "t", "p", "d_z"]])
    OUT["ez"] = res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--processed", default="data/processed")
    ap.add_argument("--out", default="results")
    a = ap.parse_args()
    proc, out = Path(a.processed), Path(a.out)
    (out / "figures").mkdir(parents=True, exist_ok=True)

    trials = pd.read_csv(proc / "trials.csv")
    people = pd.read_csv(proc / "participants.csv")
    t = trials[~trials["trial_excluded"]].copy()
    scam = t[t["offer_type"] == "scam"].copy()

    MD.append(f"# Results — Framing × Urgency in App-Based Employment Scams\n\nSource: `{proc}`\n")
    describe(trials, people)
    manipulation_checks(t)
    cm = h1_h3(scam, people)
    pc = sdt(t)
    med = mediation(scam)
    ez_diffusion(t)

    import figures
    made = figures.make_all(t, scam, cm, pc, med, out / "figures")
    h("Figures")
    for f in made:
        MD.append(f"![{f.stem}](figures/{f.name})\n")

    (out / "results.md").write_text("\n".join(MD), encoding="utf-8")
    (out / "results.json").write_text(json.dumps(OUT, indent=2, default=lambda o: o.item() if hasattr(o, "item") else str(o)))
    print(f"wrote {out / 'results.md'}, {out / 'results.json'} and {len(made)} figures")


if __name__ == "__main__":
    main()
