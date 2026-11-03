// Study configuration. Fill DATAPIPE_EXPERIMENT_ID after creating the experiment on
// https://pipe.jspsych.org (linked to your OSF project; enable data collection + condition assignment with 4 conditions).
const CONFIG = {
  STUDY_VERSION: "0.2.0",
  DATAPIPE_EXPERIMENT_ID: "", // e.g. "AbC123xYz" — leave empty to fall back to local download
  STIMULI_URL: "stimuli/stimuli.json",
  TEAM: "Team 22 (Neuroeconomics course): Nitin Reddy & Kavish Kapoor",
  CONTACT: "", // optional contact email shown on the consent page
  MIN_WIDTH: 900,
  MIN_HEIGHT: 600,
  ATTENTION_CHECK_RANGE: [12, 24], // insert attention check at a random position in this range (0-based)
  BREAK_AFTER: 16,                  // short pause screen after this many main trials
};
