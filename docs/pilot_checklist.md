# Pilot checklist (Day 4, N = 5–6, not part of the main sample)

Send the **pilot link** (`.../experiment/?pilot=1`). Ideally sit with 1–2 pilot participants while they do it (think-aloud). Message the rest.

## Before sending
- [ ] `config.js` has the 12-character DataPipe experiment ID (pushed to GitHub). In DataPipe, **Accept new data** and condition assignment (4 conditions) are both **on**.
- [ ] You did one run yourself with `?pilot=1` and a `pilot_*.csv` appeared in the Google Drive folder. Its `list_source` column says `datapipe`, not `random`.
- [ ] The link opens on Chrome, Edge and Firefox; on a phone it shows the "needs a computer" message.

## Ask pilot participants afterwards (2 min)
1. Was anything confusing (instructions, the "Check details" boxes, the questions)?
2. Did any message look obviously fake *for a reason unrelated to its content* (layout, wording errors, odd names)?
3. Did you notice the timers? Did they feel real?
4. How long did it take? Did it get boring?

## Check in the data (`preprocess.py --only-pilot`, then `analysis.py`)
| Check | Target | If it fails |
|---|---|---|
| Median duration | ≤ 25 min | shorten: cut the `gut` item or drop to 24 trials (3 per type × cell) |
| Felt urgency, high vs low | clearly higher (≥ 1.5 points) | make the timer banner bigger; add "slots left" counter to the header |
| Frame identification | > 65% correct | make the loss line more explicit ("you will LOSE ₹2,000") |
| Scam intent, mean | 15–50 (not floor) | scams too obvious → soften red flags visible in the chat text |
| Legit intent, mean | > scam intent | legit offers too sketchy → add credibility details |
| Cues opened per trial | 0.5–2.5 (not 0, not 3 always) | if always 0: emphasise in instructions that checking is allowed |
| Attention check | everyone passes | reword the check message |
| Data | one CSV per person, all columns present | fix before the main collection |

After fixes: bump `STUDY_VERSION` in `config.js`, freeze `docs/analysis_plan.md` (commit with date), then send the main link.
