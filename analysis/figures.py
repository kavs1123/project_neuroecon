"""Report figures (static PNG, light mode). Colour: gain = palette slot 1 (blue), loss = slot 2 (orange).
Every 2-series chart has a legend *and* direct labels, so identity never relies on colour alone."""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.patches import FancyBboxPatch
from scipy import stats

from common import COL

plt.rcParams.update({
    "figure.facecolor": COL["surface"], "axes.facecolor": COL["surface"], "savefig.facecolor": COL["surface"],
    "axes.edgecolor": COL["grid"], "axes.labelcolor": COL["ink2"], "xtick.color": COL["ink2"], "ytick.color": COL["ink2"],
    "text.color": COL["ink"], "axes.grid": True, "axes.grid.axis": "y", "grid.color": COL["grid"], "grid.linewidth": 0.8,
    "axes.spines.top": False, "axes.spines.right": False, "axes.spines.left": False, "font.size": 10.5,
    "axes.titlesize": 12, "axes.titleweight": "bold", "axes.titlelocation": "left", "legend.frameon": False,
    "figure.dpi": 150,
})
FRAMES = ["gain", "loss"]
URGS = ["low", "high"]


def cm_ci(wide):
    """Cousineau–Morey within-subject 95% CI half-widths for the columns of a participant × condition table."""
    w = wide.dropna()
    norm = w.sub(w.mean(axis=1), axis=0) + w.values.mean()
    j = w.shape[1]
    n = len(w)
    return norm.std(ddof=1) / np.sqrt(n) * np.sqrt(j / (j - 1)) * stats.t.ppf(0.975, n - 1)


def _two_line(ax, wide, ylabel, title, fmt="{:.0f}"):
    """Mean ± within-CI lines over urgency, one line per frame, legend + end labels."""
    ci = cm_ci(wide)
    x = np.arange(2)
    for f in FRAMES:
        m = [wide[(f, u)].mean() for u in URGS]
        e = [ci[(f, u)] for u in URGS]
        xf = x + (-0.04 if f == "gain" else 0.04)  # small dodge so CIs don't overlap
        ax.errorbar(xf, m, yerr=e, color=COL[f], lw=2, marker="o", ms=7, mec=COL["surface"], mew=1.5,
                    capsize=0, elinewidth=1.5, label=f"{f.capitalize()} frame")
        ax.annotate(f"{f.capitalize()}  {fmt.format(m[1])}", (xf[1], m[1]), xytext=(10, 0), textcoords="offset points",
                    va="center", color=COL["ink2"], fontsize=9.5)
    ax.set_xticks(x, ["Low urgency", "High urgency"])
    ax.set_xlim(-0.3, 1.55)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    ax.legend(loc="best", fontsize=9)


def fig_interaction(cm, out):
    wide = cm.pivot_table(index="participant_id", columns=["frame", "urgency"], values="intent")
    fig, ax = plt.subplots(figsize=(5.2, 4))
    _two_line(ax, wide, "Compliance intent (0–100)", "Compliance intent for scam offers")
    ax.text(0, -0.16, "Means with within-subject 95% CIs (Cousineau–Morey).", transform=ax.transAxes, fontsize=8.5, color=COL["ink2"])
    fig.tight_layout()
    p = out / "fig1_interaction.png"
    fig.savefig(p)
    plt.close(fig)
    return p


def fig_raincloud(cm, out):
    fig, ax = plt.subplots(figsize=(6.4, 4))
    order = [("gain", "low"), ("loss", "low"), ("gain", "high"), ("loss", "high")]
    rng = np.random.default_rng(0)
    for i, (f, u) in enumerate(order):
        v = cm[(cm.frame == f) & (cm.urgency == u)]["intent"].values
        parts = ax.violinplot(v, positions=[i], widths=0.7, showextrema=False, side="high")
        for b in parts["bodies"]:
            b.set_facecolor(COL[f]); b.set_alpha(0.25); b.set_edgecolor("none")
        ax.scatter(i - 0.12 + rng.uniform(-0.06, 0.06, len(v)), v, s=14, color=COL[f], alpha=0.7, lw=0)
        ax.plot([i - 0.02, i + 0.3], [v.mean()] * 2, color=COL["ink"], lw=2, solid_capstyle="round")
    ax.set_xticks(range(4), ["Gain\nlow", "Loss\nlow", "Gain\nhigh", "Loss\nhigh"])
    ax.set_ylabel("Participant mean intent (0–100)")
    ax.set_title("Compliance intent by condition (scam offers)")
    ax.scatter([], [], color=COL["gain"], label="Gain frame"); ax.scatter([], [], color=COL["loss"], label="Loss frame")
    ax.legend(loc="upper left", fontsize=9, ncol=2)
    ax.text(0, -0.2, "Dots = participants; black bar = mean.", transform=ax.transAxes, fontsize=8.5, color=COL["ink2"])
    fig.tight_layout()
    p = out / "fig2_raincloud.png"
    fig.savefig(p)
    plt.close(fig)
    return p


def fig_sdt(pc, out):
    fig, axes = plt.subplots(1, 2, figsize=(9, 3.8))
    for ax, k, title, ylab in [(axes[0], "dprime", "Sensitivity d′ (scam vs legit)", "d′"),
                               (axes[1], "c", "Acceptance bias c", "c (higher = accepts more)")]:
        wide = pc.pivot_table(index="participant_id", columns=["frame", "urgency"], values=k)
        _two_line(ax, wide, ylab, title, fmt="{:.2f}")
    fig.tight_layout()
    p = out / "fig3_sdt.png"
    fig.savefig(p)
    plt.close(fig)
    return p


def fig_mechanism(scam, out):
    fig, axes = plt.subplots(1, 2, figsize=(9, 3.8))
    for ax, k, title, ylab, fmt in [(axes[0], "n_cues", "Details checked (scam offers)", "Cues opened (0–3)", "{:.2f}"),
                                    (axes[1], "rt_s", "Decision time (scam offers)", "Seconds (participant median)", "{:.1f}")]:
        d = scam.assign(rt_s=scam["rt_ms"] / 1000)
        agg = "median" if k == "rt_s" else "mean"
        wide = d.groupby(["participant_id", "frame", "urgency"])[k].agg(agg).unstack(["frame", "urgency"])
        _two_line(ax, wide, ylab, title, fmt=fmt)
    fig.tight_layout()
    p = out / "fig4_mechanism.png"
    fig.savefig(p)
    plt.close(fig)
    return p


def fig_mediation(med, out):
    r = med.loc[("n_cues", "urg_c")]
    fig, ax = plt.subplots(figsize=(6.4, 3.2))
    ax.axis("off"); ax.set_xlim(0, 10); ax.set_ylim(0, 5)
    boxes = {"X": (0.3, 0.6, "High urgency"), "M": (3.7, 3.3, "Details checked\n(cues opened)"), "Y": (7.1, 0.6, "Compliance\nintent")}
    for _, (x, y, txt) in boxes.items():
        ax.add_patch(FancyBboxPatch((x, y), 2.6, 1.2, boxstyle="round,pad=0.08,rounding_size=0.15", fc="white", ec=COL["ink2"], lw=1))
        ax.text(x + 1.3, y + 0.6, txt, ha="center", va="center", fontsize=10)
    star = lambda p: "*" if p < 0.05 else ""
    arrow = dict(arrowstyle="-|>", color=COL["ink2"], lw=1.4)
    ax.annotate("", (3.7, 3.8), (2.0, 1.85), arrowprops=arrow)
    ax.annotate("", (8.4, 1.85), (6.3, 3.8), arrowprops=arrow)
    ax.annotate("", (7.1, 1.2), (2.9, 1.2), arrowprops=arrow)
    ax.text(2.2, 3.0, f"a = {r['a']:.2f}{star(r['a_p'])}", ha="right", fontsize=10)
    ax.text(7.7, 3.0, f"b = {r['b']:.2f}{star(r['b_p'])}", ha="left", fontsize=10)
    ax.text(5.0, 0.75, f"direct c′ = {r['direct']:.2f}{star(r['direct_p'])}", ha="center", fontsize=10)
    ax.text(5.0, 0.15, f"indirect a×b = {r['indirect']:.2f}  [95% CI {r['ind_lo']:.2f}, {r['ind_hi']:.2f}]",
            ha="center", fontsize=10, color=COL["ink"], weight="bold")
    ax.set_title("Mediation: urgency → details checked → compliance", loc="left")
    p = out / "fig5_mediation.png"
    fig.savefig(p, bbox_inches="tight")
    plt.close(fig)
    return p


def make_all(t, scam, cm, pc, med, out):
    out = Path(out)
    return [fig_interaction(cm, out), fig_raincloud(cm, out), fig_sdt(pc, out), fig_mechanism(scam, out), fig_mediation(med, out)]
