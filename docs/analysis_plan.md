# Analysis Plan (frozen before data collection)

Team 22 — Framing × Urgency in App-Based Employment Scams
Status: **DRAFT v0.2, 3 Nov 2026** (v0.2: models pinned to the implemented statsmodels versions; see §5.3, §6, §11). Freeze (git-commit with date) before the main data collection starts on 7 Nov. Any later change must be listed in the report as a deviation.

## 1. Design
- Fully within-subjects 2 (Frame: gain / loss) × 2 (Urgency: high / low) design, crossed with Offer type (scam / legit).
- 32 trials per participant: 16 scam + 16 legit, 4 per (type × cell), plus 1 attention-check trial and 2 practice trials (practice is not analysed).
- 4 counterbalancing lists: within each type, scenario *i* goes to cell `(i + list) mod 4`. Trial order is randomised per participant.
- Target N = 30 valid participants (balanced ≈ 7–8 per list), 35 if recruitment allows.
- **Simulation-based sensitivity** (`analysis/power.py`, 100 simulations per cell, run on simulated data with SDs plausible for this design):
  - Interaction power at N = 30: .34 for 4 points, .78 for 8 points, .97 for 12 points (LMM); the RM-ANOVA is slightly lower (.28 / .75 / .97).
  - At N = 35, the 8-point interaction reaches .83.
  - Urgency (6 points) is detected about 100% of the time; a 3-point frame effect only about 50%.
  - So H3 is adequately powered only for medium-to-large interactions (≥ 8 points), and H1 is underpowered for small framing effects. Report effect sizes and CIs accordingly. Pilot participants (N = 5–6) are analysed separately and are not part of the main sample.

## 2. Variables
| Level | Variable | Coding |
|---|---|---|
| Trial | `frame` | gain = −0.5, loss = +0.5 |
| Trial | `urgency` | low = −0.5, high = +0.5 |
| Trial | `is_scam` | legit = 0, scam = 1 (for SDT: −0.5 / +0.5) |
| Trial | `accept` | 1 = "Accept offer", 0 = "Ignore" |
| Trial | `rt_ms` | time from offer onset to decision click |
| Trial | `intent` | compliance-intent slider, 0–100 (**primary DV**) |
| Trial | `legit_rating` | perceived legitimacy, 1–7 |
| Trial | `urg_check` | felt urgency, 1–7 (manipulation check) |
| Trial | `frame_check` | "gain" / "loss" forced choice (manipulation check) |
| Trial | `heuristic` | mean of "gut feeling" and reverse-scored "carefully checked details" (1–7; high = heuristic) |
| Trial | `n_cues` | number of hidden cues opened (0–3) |
| Trial | `cue_dwell_ms` | total time cue panels were open |
| Person | `crt` | CRT-2 score (0–4) |
| Person | `scam_exp` | prior scam exposure (0 none, 1 received, 2 engaged, 3 lost money) |
| Person | `age`, `gender`, `job_seeking` | demographics |

## 3. Exclusions (applied in this order, all reported)
1. Participants who did not finish all 32 trials.
2. Participants who failed the attention check (didn't click Ignore, or slider > 10).
3. Participants whose median decision RT is under 3,000 ms (didn't read the offers).
4. Individual trials with RT < 1,500 ms or log-RT > person mean + 3 SD.

## 4. Manipulation checks
- **Urgency:** per-participant mean `urg_check` in high vs low → paired t-test (and Wilcoxon signed-rank), d_z with 95% CI. Success = high > low, p < .05.
- **Frame:** proportion of trials where `frame_check` matches the true frame → one-sample test against 0.5 (participant-level), shown per cell.

## 5. Confirmatory analyses — H1, H2, H3 (scam trials only)
1. **RM-ANOVA (proposal-faithful):** participant × cell means of `intent` → 2 × 2 repeated-measures ANOVA (`pingouin.rm_anova`), with Greenhouse–Geisser correction where applicable. Report F, p, partial η².
   - H1: main effect of frame. Two-sided; direction is an open question (loss > gain predicted by the short proposal).
   - H2: main effect of urgency (high > low).
   - H3: frame × urgency interaction (frame effect larger under high urgency).
2. **Linear mixed model:** `intent ~ frame * urgency + (1 | participant) + (1 | scenario)`. Report b, 95% CI, p.
3. **GLMM (logit):** `accept ~ frame * urgency + (1 | participant) + (1 | scenario)`, fit with variational Bayes (statsmodels `BinomialBayesMixedGLM`). Report odds ratios with approximate 95% intervals. Robustness check: GEE logit with exchangeable within-participant correlation.
4. **Simple effects for H3:** frame effect within high and within low urgency (paired t on participant means, d_z).

Inference: α = .05, two-sided. With 3 primary terms we report raw p-values and also flag Holm-corrected ones. Because this is a pilot-scale study, the emphasis is on effect sizes and CIs.

## 6. Signal-detection analysis (all 32 trials)
- **Model:** probit GEE (population-averaged SDT; DeCarlo, 1998), `ignore ~ is_scam * frame * urgency`, clustered by participant with exchangeable correlation, and `is_scam` coded ±0.5. (We use GEE because statsmodels has no probit GLMM with random slopes. The per-participant d′/c below acts as the subject-specific check.)
  - The `is_scam` coefficient is mean d′ (sensitivity to scam vs legit).
  - The negative intercept is the mean criterion c. With Ignore as the 'yes' response, **higher c = more willing to accept**.
  - `urgency` / `frame` main effects are shifts in criterion (response bias).
  - `is_scam × urgency` / `is_scam × frame` are changes in sensitivity.
- **Key question:** does urgency make people *worse at telling scams from real jobs* (lower d′), or just *more willing to accept anything* (a liberal criterion shift)?
- **Descriptive:** per participant × urgency level, d′ and c with log-linear correction (Hautus, 1995), then paired t-tests.

## 7. Mechanism — H4 (exploratory)
Candidate mediators: `n_cues`, `log_rt`, `heuristic`. All mediators are person-mean-centred.
- a path: `M ~ frame * urgency + (1 | participant)`
- b path: `intent ~ M + frame * urgency + (1 | participant)`
- Indirect effect a·b with a Monte Carlo 95% CI (20,000 draws).
- We run this for the urgency main effect, and for the interaction term (moderated mediation) if H3 is supported.

## 8. Covariates & moderators (exploratory)
- Add `crt`, `scam_exp` and `age` (person-level, grand-mean-centred) to the LMM in §5.2.
- Exploratory `urgency × crt`: does cognitive reflection buffer the effect of urgency?
- We expect low power here and will interpret cautiously.

## 9. Stretch analyses (only if time permits)
- **EZ-diffusion** (Wagenmakers et al., 2007) per participant × urgency, using classification accuracy (correct = ignore scam / accept legit), mean RT and RT variance. Prediction: boundary separation *a* is lower under high urgency. Caveat: RT includes reading time.
- **Mouse-trajectory** curvature (AUC / MAD) by cell, as a measure of decision conflict.

## 10. Figures
1. Frame × urgency interaction plot for `intent` (scam trials), with within-subject 95% CIs (Cousineau–Morey).
2. Raincloud plot of `intent` by cell.
3. d′ and c by cell (SDT).
4. Cues opened and log-RT by cell.
5. Mediation path diagram with coefficients.

## 11. Software
Python 3 (versions pinned in `analysis/requirements.txt`): pandas, numpy, scipy, pingouin, statsmodels (crossed random effects via variance components; VB GLMM; GEE), matplotlib. The whole pipeline is first run end-to-end on simulated data (`analysis/simulate.py`) to check that it recovers the effects planted there.
