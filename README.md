# Framing × Urgency in App-Based Employment Scams (Team 22)

A within-subjects online experiment and analysis pipeline. See [project_plan.md](project_plan.md) for the plan and [docs/analysis_plan.md](docs/analysis_plan.md) for the frozen analysis plan.

```
experiment/   jsPsych 8 study (static site: index.html, js/, css/, stimuli/stimuli.json)
analysis/     simulate.py · preprocess.py · analysis.py · figures.py · power.py
docs/         analysis_plan.md
data/raw/     participant CSVs downloaded from the Google Drive folder (git-ignored)
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

**DataPipe + Google Drive (data storage and list assignment)**

DataPipe no longer accepts new OSF experiments, so data goes to a private Google Drive folder.

1. Log in at https://pipe.jspsych.org. Under **Account Settings → Storage Providers**, connect **Google Drive**.
2. Click **New Experiment**, choose **Google Drive**, and give it a title, e.g. "Scam framing study".
3. On the experiment dashboard:
   - turn on **Condition assignment** with **4** conditions;
   - optionally turn on CSV data validation;
   - leave the session limit off.
4. Copy the **12-character experiment ID** into `experiment/js/config.js` → `DATAPIPE_EXPERIMENT_ID`, then commit and push.
5. Turn on **Accept new data**.

Each participant becomes one CSV in the Drive folder that DataPipe links to from the dashboard. Notes on the files:
- Pilot files are named `pilot_<id>.csv`.
- People who decline consent or fail the device check leave a tiny file with no trials; `preprocess.py` skips these.
- People who withdraw at the end leave only a withdrawal marker.

**Saving.** The study uses `@jspsych/extension-pipe` and uploads once at the end, so nothing is stored for people who drop out midway. If an upload fails, the participant sees a download button and is asked to send you the file.

**GitHub Pages (hosting)**
1. Repo: https://github.com/kavs1123/project_neuroecon (public; data folders are git-ignored).
2. In the repo, go to Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
3. Participant link: `https://kavs1123.github.io/project_neuroecon/experiment/`
4. Pilot link: the same URL plus `?pilot=1`.

Before sending links, test with `?pilot=1` once and confirm that a `pilot_*.csv` shows up in the Google Drive folder.

## 3. Analysis

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r analysis/requirements.txt   # Windows path; use .venv/bin/python on macOS/Linux

# pipeline check on simulated data (plants known effects)
.venv/Scripts/python analysis/simulate.py --n 30 --out data/simulated/raw
.venv/Scripts/python analysis/preprocess.py --raw data/simulated/raw --out data/simulated/processed
.venv/Scripts/python analysis/analysis.py --processed data/simulated/processed --out results_sim

# real data: download the Drive folder's CSVs into data/raw/, then
.venv/Scripts/python analysis/preprocess.py --raw data/raw --out data/processed
.venv/Scripts/python analysis/analysis.py --processed data/processed --out results
# pilot only: preprocess with --only-pilot --out data/pilot_processed, then analyse with --out results_pilot
```

Outputs:
- `results/results.md`: all tables
- `results/results.json`: numbers for the report
- `results/figures/*.png`
- `data/processed/exclusions.json`
