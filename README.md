# Framing × Urgency in App-Based Employment Scams (Team 22)

A within-subjects online experiment and analysis pipeline. See [project_plan.md](project_plan.md) for the plan and [docs/analysis_plan.md](docs/analysis_plan.md) for the frozen analysis plan.

```
experiment/   jsPsych 8 study (static site: index.html, js/, css/, stimuli/stimuli.json)
analysis/     simulate.py · preprocess.py · analysis.py · figures.py · power.py
docs/         analysis_plan.md
data/raw/     participant CSVs downloaded from OSF (git-ignored)
```

## 1. Run the experiment locally

```bash
cd experiment
python -m http.server 8000
# open http://localhost:8000/?debug=1
```

| URL parameter | Effect |
|---|---|
| `?debug=1` | no DataPipe; download button for the CSV at the end |
| `?pilot=1` | tags data as pilot; files saved as `pilot_<id>.csv` (preprocessing skips them by default) |
| `?list=0..3` | force a counterbalancing list |
| `?preview=S01&frame=loss&urgency=high` | show a single offer (for reviewing stimuli) |
| `?autopilot=1` | clicks through by itself (testing only) |

**End-to-end test without a human:** run headless Chrome with `?autopilot=1&list=N` and `--dump-dom`, then use `experiment/tools/extract_autopilot_csv.py` to pull the CSV out of the page.

## 2. Deploy (one-time setup, ~15 min)

**OSF + DataPipe (data storage and list assignment)**
1. On osf.io, create a **private** project (e.g., "Scam framing study").
2. On OSF go to Settings → Personal access tokens. Create a token with the `osf.full_write` scope.
3. Log in at https://pipe.jspsych.org and add the OSF token under *Account*.
4. *New experiment*: give it a title, paste the OSF project ID (the 5 characters in the project URL), and name a new data component, e.g. `data`.
5. On the experiment page:
   - turn on **Enable data collection**;
   - turn on **Enable condition assignment** with **4** conditions;
   - optionally turn on CSV validation.
6. Copy the **experiment ID** into `experiment/js/config.js` → `DATAPIPE_EXPERIMENT_ID`.

**GitHub Pages (hosting)**
1. Repo: https://github.com/kavs1123/project_neuroecon (public; data folders are git-ignored).
2. In the repo, go to Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
3. Participant link: `https://kavs1123.github.io/project_neuroecon/experiment/`
4. Pilot link: the same URL plus `?pilot=1`.

Before sending links, test with `?pilot=1` once and confirm that a `pilot_*.csv` shows up in the OSF component.

## 3. Analysis

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r analysis/requirements.txt   # Windows path; use .venv/bin/python on macOS/Linux

# pipeline check on simulated data (plants known effects)
.venv/Scripts/python analysis/simulate.py --n 30 --out data/simulated/raw
.venv/Scripts/python analysis/preprocess.py --raw data/simulated/raw --out data/simulated/processed
.venv/Scripts/python analysis/analysis.py --processed data/simulated/processed --out results_sim

# real data: download the OSF component's CSVs into data/raw/, then
.venv/Scripts/python analysis/preprocess.py --raw data/raw --out data/processed
.venv/Scripts/python analysis/analysis.py --processed data/processed --out results
# pilot only: preprocess with --only-pilot --out data/pilot_processed, then analyse with --out results_pilot
```

Outputs:
- `results/results.md`: all tables
- `results/results.json`: numbers for the report
- `results/figures/*.png`
- `data/processed/exclusions.json`
