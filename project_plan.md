# Action Plan — Framing × Urgency in App-Based Employment Scams (Team 22)

## Context
The approach papers (`approach_paper.tex/.pdf`, `detailed_approach_paper.pdf`) propose a 2 (Frame: gain/loss) × 2 (Urgency: high/low) within-subjects study on scam compliance, N≈25–30, RQ1–RQ4 / H1–H4. We now have to run it. Deadline: **~10 days (submit ≈ 13 Nov 2026)**. It's a course project (not for publication), and we can recruit ~30 people through our own contacts.

**Agreed upgrades over the proposal** (the 2×2 core, hypotheses and analyses all stay):
1. **Multi-trial paradigm.** The proposal has 4 trials, so each cell is one noisy response and is confounded with job domain. We move to **32 trials: 16 scam + 16 legitimate offers, 4 per cell for each type**. Scenarios rotate across cells via 4 counterbalanced lists. This gives reliable cell means, lets item be a random effect, and makes **signal-detection analysis** possible (does urgency reduce scam *discrimination* d′, or just shift *willingness to accept*, the criterion c?).
2. **Click-to-reveal (Mouselab-style) red-flag cues.** Each offer hides 3 details (sender profile, company/registration, payment terms) until clicked. The number of cues opened and the time spent on them is an **objective measure of deliberation for H4**, stronger than self-report alone.
3. **Binary Apply/Ignore decision with RT** on each trial, plus the proposal's 0–100 compliance slider. This makes GLMM, SDT and (stretch) drift-diffusion analyses possible.
4. **Online jsPsych experiment** (GitHub Pages + DataPipe→OSF), with a countdown that really ticks in high-urgency trials.

Decided against: a real-money token deposit (budget and logistics don't fit 10 days) and webcam eye-tracking (too noisy).

---

## Final design spec

**Stimuli.** 32 base scenarios (16 scam, 16 legit), each with 4 variants (frame × urgency).
- Generated from **one HTML/CSS phone chat template** filled from `stimuli.json`, not hand-made images. This is what makes 128 variants feasible.
- Scam template follows the documented task-scam script: unsolicited recruiter, a simple task (rate/review/verify), a commission counter, and an upfront "activation/registration fee". Economics are held constant within the scam set (e.g., ₹2,000 commission, ₹500 fee).
- Legit offers: plausible pay, no upfront fee, normal recruiting channel cues.
- **Frame:** gain = "claim your ₹2,000 commission"; loss = "avoid losing your ₹2,000 credited balance". Everything else is identical.
- **Urgency high:** a live countdown (e.g., 14:59, ticking in real seconds) plus "only 2 slots left". It doesn't force a deadline, so RT isn't cut off. **Urgency low:** "complete any time this week".
- Legit offers are crossed with frame × urgency too (real employers also use deadlines), so SDT works within every cell.
- Use **₹ amounts** (Indian sample). This is a deliberate localisation of the proposal's $; note it in the report.
- **Fictional company names and clearly fake numbers/links only.** Never impersonate real firms.
- 3 click-to-reveal fields per offer. In scams they show red flags (unverified foreign number, no registration found, "refundable deposit via UPI to a personal ID"); in legit offers they show benign info.

**Counterbalancing.** 4 lists (an item-level Latin square). Each participant sees every scenario once, 4 trials per (type × cell), and across lists every scenario appears in every cell. Lists are assigned in balanced order via DataPipe condition assignment, and trial order is randomised within each participant.

**Per-trial flow (~30 s).**
1. Offer screen with click-to-reveal → **Register/Apply vs Ignore**. Log choice, RT, which cues were opened and their dwell times, and the mouse trajectory (jsPsych mouse-tracking extension; recorded cheaply, analysed only if time allows).
2. Rating screen:
   - compliance-intent slider 0–100
   - perceived legitimacy 1–7
   - felt urgency 1–7 (manipulation check)
   - frame forced choice: "the message emphasised gaining / avoiding a loss" (manipulation check)
   - 2-item processing style, 1–7: "I went with my gut feeling" and "I carefully checked the details" (reverse-scored)

**Session (~20–25 min).** Consent (cover story: "evaluating remote-job offers received on messaging apps") → device/browser check (laptop/desktop only) → instructions + 2 practice trials → 32 trials with 1 embedded attention check → CRT (use the **CRT-2**, Thomson & Oppenheimer, since students know the classic CRT-3) → demographics (age, gender, student/working, job-seeking status) → prior scam exposure (received / engaged / lost money) → **funnel debrief** (study purpose? suspicion?) → **educational debrief** showing which offers were scams and which red flags gave them away.

**Ethics (light, since it's a course project).**
- Anonymous random IDs and no PII.
- Explicit right to withdraw.
- The deception is justified and fully debriefed.
- Send a one-line heads-up to the instructor/TA describing the deception and the debrief.

---

## Day-by-day plan (today = Tue 3 Nov)

| Day | Date | Actions | Owner |
|---|---|---|---|
| 1 | 3–4 Nov | Freeze the design spec above. Write the 32 scenarios plus frame/urgency text slots in `stimuli.json` (I draft, team edits for realism). Freeze the analysis plan as `analysis_plan.md` (a timestamped git commit serves as a lightweight pre-registration). Message the instructor. | Claude drafts; team reviews |
| 2–3 | 4–6 Nov | Build the jsPsych experiment: chat template, reveal mechanics, live timer, ratings, CRT, debriefs, list assignment, DataPipe saving plus a local CSV fallback. Build `simulate.py`, which produces fake data in the exact output format, then the full analysis pipeline on simulated data (also a **simulation-based power check**). | Claude |
| 3 | 6 Nov | Create the OSF project + DataPipe experiment ID, the GitHub repo + Pages (**needs your accounts**). Test on 2–3 browsers. | Team (+Claude guidance) |
| 4 | 6–7 Nov | **Pilot, N = 5–6** (not part of the main 30): check the manipulation checks, duration, confusing items, and that data saves correctly. Fix and freeze. | Team runs; Claude analyses/fixes |
| 5–7 | 7–9 Nov | **Main data collection, N = 30–35.** Monitor completions daily and keep the 4 lists balanced. | Team |
| 8 | 10 Nov | Preprocess + run all analyses + figures. | Claude |
| 9–10 | 11–12 Nov | Final report (LaTeX, same style as the proposal) + slides if needed. Write up the stimulus battery appendix. | Claude drafts; team edits |
| — | 13 Nov | Buffer / submit. | |

---

## Analysis plan (frozen before data)

**Preprocessing.**
- Exclude participants who fail the attention check, didn't finish, or have a median decision RT under 3 s (didn't read).
- Exclude individual trials with RT under 1.5 s or over 3 SD above the person's log-RT mean.
- Report all exclusions.

**Manipulation checks.**
- Felt urgency, high vs low: paired t-test / Wilcoxon on participant means, with d_z.
- Frame identification accuracy vs 50%: binomial test, plus the per-condition breakdown.

**H1–H3 (scam trials, proposal-faithful).**
- 2×2 RM-ANOVA on participant cell means of the compliance slider (`pingouin.rm_anova`, Greenhouse–Geisser correction), reporting partial η².
- **Plus a linear mixed model:** `intent ~ frame*urgency + (1|participant) + (1|scenario)`.
- **Plus a GLMM (logit):** `apply ~ frame*urgency + (1|participant) + (1|scenario)`, reporting odds ratios.
- H3 is the interaction term. Also report simple effects of frame within each urgency level, with d_z.
- Covariates (CRT, scam exposure, age) go in a second model. Exploratory: CRT × urgency (does reflection protect against urgency?).

**SDT (new).**
- Probit GLMM SDT (DeCarlo 1998): `ignore ~ is_scam * frame * urgency + (is_scam|participant)`. The `is_scam` slope is d′, the intercept terms are the criterion, and the interactions show whether urgency/frame shifts sensitivity or bias.
- Report per-participant d′/c (log-linear correction) descriptively.

**H4 mechanism (exploratory).**
- Mediators: cues revealed, log RT, processing-style score.
- Fit a path: M ~ frame*urgency + (1|pid) and b path: Y ~ M + frame*urgency + (1|pid), with the mediator centred within person.
- Indirect effect a·b with a Monte Carlo 95% CI. Also test mediation of the interaction (moderated mediation).

**Stretch.**
- EZ-diffusion per participant × urgency, using classification accuracy plus RT. Prediction: urgency lowers boundary separation *a* (the speed–accuracy signature of System-1 processing). Note the caveat that RT includes reading time.
- Mouse-trajectory curvature (AUC/MAD) as a measure of decision conflict.

**Figures.**
- Interaction plot with within-subject CIs (Cousineau–Morey).
- Raincloud plot of compliance by cell.
- SDT d′/c by cell.
- Cues revealed by cell.
- Mediation path diagram.

Stack: Python (pandas, pingouin, statsmodels, bambi/PyMC for crossed-random-effects GLMMs, matplotlib/seaborn).

---

## Files to create (in `c:\Users\kavis\Desktop\neuro_econ\project`)
```
experiment/        index.html, js/{main,trials,chat_render,lists}.js, css/chat.css, stimuli/stimuli.json
analysis/          simulate.py, preprocess.py, analysis.py (or .ipynb), sdt.py, mediation.py, figures/
data/              raw/ (downloaded from OSF; git-ignored), processed/
docs/              analysis_plan.md, stimulus_battery.md, consent & debrief text
report/            final_report.tex (reuse approach_paper.tex preamble/style)
```
Note: the current git repo root is your **home folder**. Before publishing to GitHub Pages we'll start a separate repo just for this project folder; I'll confirm with you before any push. Raw data stays off the public repo.

## Verification
- `simulate.py` → `preprocess.py` → `analysis.py` runs end-to-end on fake data and recovers the effects planted in the simulation (this validates the pipeline before any real data).
- Click through every list locally (`python -m http.server`): confirm each list has 4 trials per type × cell, each scenario appears once, the timer only shows in high-urgency trials, and reveals and RTs are logged.
- Pilot (N = 5–6): high-urgency felt-urgency is clearly above low-urgency, frame identification is above chance, median duration is ≤ 25 min, and data arrives in OSF.
- Before analysis, check that list counts are balanced (≈ 7–9 participants per list).

## Needed from you
- Instructor heads-up.
- GitHub + OSF accounts (for Pages / DataPipe).
- A realism review of the scenario texts.
- Running the pilot and main recruitment.
