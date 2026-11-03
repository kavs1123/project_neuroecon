// Study configuration. DATAPIPE_EXPERIMENT_ID (12 characters) comes from https://pipe.jspsych.org
// (Google Drive storage; "Accept new data" + condition assignment with 4 conditions in sequence).
const CONFIG = {
  STUDY_VERSION: "0.4.2", // also bump the ?v= tags in index.html
  DATAPIPE_EXPERIMENT_ID: "sKyyU2rUm4BB", // leave empty to fall back to local download
  STIMULI_URL: "stimuli/stimuli.json",
  TEAM: "Team 22 (Neuroeconomics course): Nitin Reddy & Kavish Kapoor",
  CONTACT: "", // optional contact email shown on the consent page
  MIN_WIDTH: 900,
  MIN_HEIGHT: 600,

  // --- making information and time costly (v0.4) ---
  DEADLINE_SECONDS: 20,    // high-urgency offers expire for real after this many seconds (counts as not accepted)
  CHECK_BUDGET: 24,        // detail checks for the whole main part (~1 per offer); boxes lock when used up
  PRACTICE_CHECKS: 3,      // separate budget for the 2 practice offers
  CHECK_DELAY_MS: 1200,    // "Checking…" delay before a detail is shown (time cost, matters under the deadline)

  ATTENTION_CHECK_RANGE: [8, 16], // attention check inserted at a random position in this range (0-based)
  BREAK_AFTER: 12,                // short pause screen after this many main trials
};
