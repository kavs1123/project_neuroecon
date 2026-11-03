// Study configuration. Fill DATAPIPE_EXPERIMENT_ID (12 characters) after creating the experiment on
// https://pipe.jspsych.org with Google Drive storage; turn on "Accept new data" + condition assignment (4 conditions).
const CONFIG = {
  STUDY_VERSION: "0.3.0",
  DATAPIPE_EXPERIMENT_ID: "sKyyU2rUm4BB", // leave empty to fall back to local download
  STIMULI_URL: "stimuli/stimuli.json",
  TEAM: "Team 22 (Neuroeconomics course): Nitin Reddy & Kavish Kapoor",
  CONTACT: "", // optional contact email shown on the consent page
  MIN_WIDTH: 900,
  MIN_HEIGHT: 600,
  ATTENTION_CHECK_RANGE: [12, 24], // insert attention check at a random position in this range (0-based)
  BREAK_AFTER: 16,                  // short pause screen after this many main trials
};
