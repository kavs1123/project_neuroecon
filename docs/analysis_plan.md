# Analysis Plan (frozen before data collection)

Team 22 — Framing × Urgency in App-Based Employment Scams
Status: **DRAFT v0.3, 4 Nov 2026** (v0.2: models pinned to the implemented statsmodels versions. v0.3: design changed after the team's own test run: 24 trials, a real deadline under high urgency, a check budget, and a shorter rating screen; see §1–§3). Freeze (git-commit with date) before the main data collection starts on 7 Nov. Any later change must be listed in the report as a deviation.

## 1. Design
- Fully within-subjects 2 (Frame: gain / loss) × 2 (Urgency: high / low) design, crossed with Offer type (scam / legit).
- 24 trials per participant: 12 scam + 12 legit, 3 per (type × cell), plus 1 attention-check trial and 2 practice trials (practice is not analysed).
- **Urgency is enforced, not just displayed.** High-urgency offers show a live 20-second countdown and really expire when it ends; an expired offer counts as not accepted. Low-urgency offers have no deadline.
- **Checking is costly.** Participants have 24 detail checks for the whole main part (about 1 per offer). Each first opening of a box uses one check and takes 1.2 s to load. When the budget is used up, the boxes lock. This makes decisions rest mainly on the message, and makes checking a scarce resource whose use we can measure.
- 4 counterbalancing lists: within each type, scenario *i* goes to cell `(i + list) mod 4`. Trial order is randomised per participant.
- Target N = 30 valid participants (balanced ≈ 7–8 per list), 35 if recruitment allows.
- **Simulation-based sensitivity** for the 24-trial design (`analysis/power.py`, 100 simulations per cell; LMM, with the RM-ANOVA in brackets):
  - Interaction, 8 points: N = 30 → .73 (.68); N = 35 → .76 (.70); N = 40 → .81 (.77).
  - Interaction, 12 points: N = 30 → .97 (.91).
  - Urgency (6 points): about 1.00. Frame (3 points): about .50.
  - Cutting from 32 to 24 trials cost about 5 points of power for the 8-point interaction at N = 30 (.78 → .73).
  - Target **35–40** valid participants if recruitment allows. The LMM is the primary test for H3; the RM-ANOVA is reported as in the proposal.
  - H1 is underpowered for small framing effects, so report effect sizes and CIs.
- Pilot participants (N = 5–6) are analysed separately and are not part of the main sample.

## 2. Variables
| Level | Variable | Coding |
|---|---|---|
| Trial | `frame` | gain = −0.5, loss = +0.5 |
| Trial | `urgency` | low = −0.5, high = +0.5 |
| Trial | `is_scam` | legit = 0, scam = 1 (for SDT: −0.5 / +0.5) |
| Trial | `accept` | 1 = "Accept offer", 0 = "Ignore", missing if the offer expired |
| Trial | `timeout` | 1 = high-urgency offer expired before a decision |
| Trial | `rt_ms` | time from offer onset to decision click (missing for expired offers) |
| Trial | `intent` | compliance-intent slider, 0–100 (**primary DV**; asked after every offer, including expired ones) |
| Trial | `urg_check` | felt urgency, 1–7 (manipulation check) |
| Trial | `frame_check` | "How was the ₹2,000 described?" claim/gain vs reserved/could lose (manipulation check; reworded in v0.3.1) |
| Trial | `heuristic` | 8 − `deliberation` ("How did you make this decision?" 1 = gut feeling … 7 = carefully weighed details); high = heuristic |
| Trial | `n_cues` | detail boxes opened (0–3; budget-limited) |
| Trial | `checks_left_before` | checks remaining when the offer appeared |
| Trial | `cue_dwell_ms` | total time revealed details were visible |
| Person | `crt` | CRT-2 score (0–4) |
| Person | `scam_exp` | prior scam exposure (0 none, 1 received, 2 engaged, 3 lost money) |
| Person | `age`, `gender`, `job_seeking` | demographics |

## 3. Exclusions (applied in this order, all reported)
1. Participants who did not finish all 24 trials.
2. Participants who failed the attention check (didn't click Ignore, or slider > 10).
3. Participants whose median decision RT is under 3,000 ms (didn't read the offers).
4. Individual trials with RT < 1,500 ms or log-RT > person mean + 3 SD.
5. Expired offers stay in the intent analyses (the slider was answered). They are left out of the choice, SDT and RT analyses, and the timeout rate is reported by condition. Robustness check: count expired offers as Ignore.

## 4. Manipulation checks
- **Urgency:** per-participant mean `urg_check` in high vs low → paired t-test (and Wilcoxon signed-rank), d_z with 95% CI. Success = high > low, p < .05.
- **Frame:** proportion of trials where `frame_check` matches the true frame → one-sample test against 0.5 (participant-level), shown per cell.

## 5. Confirmatory analyses — H1, H2, H3 (scam trials only)
1. **RM-ANOVA (proposal-faithful):** participant × cell means of `intent` → 2 × 2 repeated-measures ANOVA (`pingouin.rm_anova`), with Greenhouse–Geisser correction where applicable. Report F, p, partial η².
   - H1: main effect of frame. Two-sided; direction is an open question (loss > gain predicted by the short proposal).
   - H2: main effect of urgency (high > low). Urgency now means message cues plus a real 20-second deadline, so H2 tests urgency architecture with real time pressure.
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
Candidate mediators: `n_cues` (checks spent), `log_rt`, `heuristic`. All mediators are person-mean-centred.
- a path: `M ~ frame * urgency + trial position + (1 | participant)`. Trial position controls for the budget shrinking over the session.
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
