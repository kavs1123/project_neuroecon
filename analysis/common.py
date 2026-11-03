"""Shared paths, constants and small helpers for the analysis pipeline."""
from pathlib import Path
import re

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
STIMULI = ROOT / "experiment" / "stimuli" / "stimuli.json"

CELLS = ["gain_high", "gain_low", "loss_high", "loss_low"]

# Effect coding used in every model (see docs/analysis_plan.md §2)
FRAME_CODE = {"gain": -0.5, "loss": 0.5}
URG_CODE = {"low": -0.5, "high": 0.5}
SCAM_CODE = {"legit": -0.5, "scam": 0.5}

# Researcher test sessions (run by the team, who know the hypotheses): never analysed.
# 66g2sjysbg = Kavish's end-to-end DataPipe test on 3 Nov 2026 (not tagged as pilot).
# (pilot_ehnxg42vhf.csv is a real pilot participant on v0.4.0, not a researcher test; it stays in pilot analyses.)
TEST_SESSIONS = {"66g2sjysbg"}

# Exclusion thresholds (docs/analysis_plan.md §3)
MIN_MEDIAN_RT_MS = 3000
MIN_TRIAL_RT_MS = 1500
TRIAL_LOGRT_SD = 3
ATTN_MAX_INTENT = 10

# Figure colours: reference palette slots 1-2 (validated all-pairs, light mode)
COL = {"gain": "#2a78d6", "loss": "#eb6834", "ink": "#0b0b0b", "ink2": "#52514e", "grid": "#e4e3df", "surface": "#fcfcfb"}

# CRT-2 lenient scoring: correct answers are 2nd / 8 / Emily / 0
_CRT_RULES = [
    re.compile(r"^\s*(2|2nd|second|two)\b", re.I),
    re.compile(r"^\s*(8|eight)\b", re.I),
    re.compile(r"emily", re.I),
    re.compile(r"^\s*(0|zero|none|no\b|nothing|no dirt)", re.I),
]


def score_crt(answers):
    """answers: iterable of 4 raw strings -> number correct (0-4)."""
    total = 0
    for rule, a in zip(_CRT_RULES, answers):
        if isinstance(a, float) and np.isnan(a):
            continue
        a = str(a).strip()
        if a.endswith(".0"):
            a = a[:-2]
        total += bool(rule.search(a))
    return total


def loglinear_dprime(hits, n_signal, fas, n_noise):
    """d' and c with the log-linear correction (Hautus, 1995). 'Yes' = ignore, signal = scam."""
    from scipy.stats import norm

    h = (hits + 0.5) / (n_signal + 1)
    f = (fas + 0.5) / (n_noise + 1)
    d = norm.ppf(h) - norm.ppf(f)
    c = -0.5 * (norm.ppf(h) + norm.ppf(f))
    return d, c
