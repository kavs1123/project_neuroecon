// Main timeline. URL params:
//   ?list=0..3   force a counterbalancing list (otherwise DataPipe condition assignment, else random)
//   ?pilot=1     tag data as pilot (filename prefix "pilot_")
//   ?debug=1     skip DataPipe, offer local CSV download at the end
//   ?autopilot=1 click through automatically (testing only; implies debug)
//   ?pid=XYZ     use a given participant id instead of a random one
(async function () {
  const params = new URLSearchParams(window.location.search);
  const AUTOPILOT = params.get("autopilot") === "1";
  const DEBUG = AUTOPILOT || params.get("debug") === "1";
  const PILOT = params.get("pilot") === "1";
  const ACCEPT = "Accept offer";
  const IGNORE = "Ignore";

  const jsPsych = initJsPsych({
    show_progress_bar: true,
    auto_update_progress_bar: false,
    message_progress_bar: "Progress",
    extensions: [{ type: jsPsychExtensionMouseTracking, params: { minimum_sample_time: 50 } }],
  });

  const stim = await (await fetch(CONFIG.STIMULI_URL, { cache: "no-store" })).json();
  if (DEBUG) Lists.check(stim);

  // ---------- participant & list ----------
  const pid = params.get("pid") || jsPsych.randomization.randomID(10);
  let list = params.has("list") ? Number(params.get("list")) : null;
  let listSource = "url";
  if (list === null && CONFIG.DATAPIPE_EXPERIMENT_ID && !DEBUG) {
    try {
      const c = await jsPsychPipe.getCondition(CONFIG.DATAPIPE_EXPERIMENT_ID);
      if (Number.isInteger(c)) { list = c % Lists.N_LISTS; listSource = "datapipe"; }
    } catch (e) { console.warn("DataPipe condition assignment failed", e); }
  }
  if (list === null || Number.isNaN(list)) { list = crypto.getRandomValues(new Uint8Array(1))[0] % Lists.N_LISTS; listSource = "random"; }

  // Decision-button side is counterbalanced across participants.
  const coin = () => crypto.getRandomValues(new Uint8Array(1))[0] < 128;
  const buttonOrder = coin() ? [ACCEPT, IGNORE] : [IGNORE, ACCEPT];

  jsPsych.data.addProperties({
    participant_id: pid,
    list,
    list_source: listSource,
    accept_button_side: buttonOrder[0] === ACCEPT ? "left" : "right",
    pilot: PILOT ? 1 : 0,
    study_version: CONFIG.STUDY_VERSION,
    start_iso: new Date().toISOString(),
  });

  // ---------- autopilot (testing only) ----------
  const rand = (n) => Math.floor(Math.random() * n);
  const Auto = {
    click: (sel) => setTimeout(() => document.querySelector(sel)?.click(), 40),
    instructions() {
      const step = () => {
        const b = document.querySelector("#jspsych-instructions-next");
        if (b) { b.click(); setTimeout(step, 40); }
      };
      setTimeout(step, 40);
    },
    offer(type) {
      const cues = [...document.querySelectorAll(".cue-head")];
      const k = rand(4);
      cues.slice(0, k).forEach((c, i) => setTimeout(() => c.click(), 300 * (i + 1)));
      const pAccept = type === "scam" ? 0.35 : type === "legit" ? 0.7 : 0;
      const label = Math.random() < pAccept ? ACCEPT : IGNORE;
      setTimeout(() => {
        const btn = [...document.querySelectorAll("#jspsych-html-button-response-btngroup button")].find((b) => b.textContent === label);
        btn.click();
      }, 300 * (k + 1) + 2500 + rand(4000));
    },
    form(attention) {
      setTimeout(() => {
        const root = document.querySelector("#jspsych-content");
        root.querySelectorAll("input[type=range]").forEach((r) => {
          r.value = attention ? 0 : rand(101);
          r.dispatchEvent(new Event("input"));
        });
        const groups = new Set([...root.querySelectorAll("input[type=radio]")].map((r) => r.name));
        groups.forEach((g) => { const rs = root.querySelectorAll(`input[name="${g}"]`); rs[rand(rs.length)].checked = true; });
        root.querySelectorAll("input[type=text]").forEach((t) => (t.value = ["second", "8", "Emily", "27"][rand(4)]));
        root.querySelectorAll("input[type=number]").forEach((t) => (t.value = 19 + rand(8)));
        root.querySelectorAll("select").forEach((s) => (s.selectedIndex = 1 + rand(s.options.length - 1)));
        root.querySelectorAll("textarea").forEach((t) => (t.value = "autopilot text"));
        document.querySelector("#jspsych-survey-html-form-next").click();
      }, 60);
    },
  };
  const ap = (trial, fn) => {
    if (!AUTOPILOT) return trial;
    const orig = trial.on_load;
    trial.on_load = function () { if (orig) orig.apply(this, arguments); fn(); };
    return trial;
  };

  // ---------- trial factories ----------
  let currentOffer = null;
  const nMain = stim.scenarios.length + 1; // + attention check
  let doneMain = 0;

  function offerTrial(sc, frame, urgency, cell, meta) {
    const base = {
      scenario_id: sc.id, offer_type: sc.type, frame, urgency, cell, domain: sc.domain, sender: sc.sender, ...meta,
    };
    const offer = {
      type: jsPsychHtmlButtonResponse,
      stimulus: Chat.render(sc, frame, urgency, stim),
      choices: buttonOrder,
      button_html: (choice) => `<button class="jspsych-btn decision-btn">${choice}</button>`,
      save_trial_parameters: { stimulus: false },
      data: { task: "offer", ...base },
      extensions: [{
        type: jsPsychExtensionMouseTracking,
        params: { targets: ["#phone", ".cue-panel", '#jspsych-html-button-response-btngroup [data-choice="0"]', '#jspsych-html-button-response-btngroup [data-choice="1"]'], events: ["mousemove", "mousedown"] },
      }],
      on_load: () => { currentOffer = Chat.attach(document.querySelector("#jspsych-content"), stim.constants.countdown_seconds); },
      on_finish: (data) => {
        Object.assign(data, currentOffer ? currentOffer.finish(data.rt) : Chat.emptySummary());
        currentOffer = null;
        data.choice = buttonOrder[data.response] === ACCEPT ? "accept" : "ignore";
        data.accept = data.choice === "accept" ? 1 : 0;
      },
    };
    const ratings = {
      type: jsPsychSurveyHtmlForm,
      html: Pages.ratings(sc),
      button_label: "Continue",
      data: { task: "ratings", ...base },
      on_load: Pages.armSlider,
      on_finish: (data) => {
        const r = data.response || {};
        data.intent = Number(r.intent);
        ["legit_rating", "urg_check", "gut", "careful"].forEach((k) => (data[k] = r[k] === undefined ? null : Number(r[k])));
        data.frame_check = r.frame_check ?? null;
        if (!meta.is_practice) jsPsych.progressBar.progress = ++doneMain / nMain;
      },
    };
    return [ap(offer, () => Auto.offer(sc.type)), ap(ratings, () => Auto.form(sc.type === "check"))];
  }

  // ---------- preview mode: ?preview=S01&frame=loss&urgency=high shows one offer (for review/screenshots) ----------
  if (params.has("preview")) {
    const all = [...stim.scenarios, ...stim.practice, stim.attention_check];
    const sc = all.find((s) => s.id === params.get("preview")) || stim.scenarios[0];
    const f = params.get("frame") || "gain";
    const u = params.get("urgency") || "high";
    jsPsych.run(offerTrial(sc, f, u, `${f}_${u}`, { is_practice: 1, trial_num: 0 }));
    return;
  }

  // ---------- timeline ----------
  const timeline = [];

  timeline.push(ap({
    type: jsPsychHtmlButtonResponse,
    stimulus: Pages.consent(),
    choices: ["I agree", "I do not agree"],
    data: { task: "consent" },
    on_finish: (d) => {
      if (d.response !== 0) jsPsych.abortExperiment("<p>You chose not to take part. Thank you for your time. You can close this tab.</p>");
    },
  }, () => Auto.click("#jspsych-html-button-response-btngroup button")));

  timeline.push({
    type: jsPsychBrowserCheck,
    features: ["width", "height", "browser", "browser_version", "mobile", "os"],
    minimum_width: CONFIG.MIN_WIDTH,
    minimum_height: CONFIG.MIN_HEIGHT,
    inclusion_function: (d) => !d.mobile,
    exclusion_message: () => "<p>Sorry, this study needs a laptop or desktop computer. Please reopen the link on a computer.</p>",
    data: { task: "browser_check" },
  });

  timeline.push(ap({
    type: jsPsychInstructions, pages: Pages.instructions, show_clickable_nav: true, data: { task: "instructions" },
  }, () => Auto.instructions()));

  // practice: one legit (gain/low), one scam (loss/high) so both screen types are seen
  const [p1, p2] = stim.practice;
  timeline.push(...offerTrial(p1, "gain", "low", "gain_low", { is_practice: 1, trial_num: -2 }));
  timeline.push(...offerTrial(p2, "loss", "high", "loss_high", { is_practice: 1, trial_num: -1 }));
  timeline.push(ap({
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="text-page"><h2>Practice complete</h2><p class="lead">Now the main part begins. There are ${nMain} messages. Remember: respond as you genuinely would.</p></div>`,
    choices: ["Start"],
    data: { task: "practice_end" },
  }, () => Auto.click("#jspsych-html-button-response-btngroup button")));

  // main trials: randomised order, attention check inserted in the middle range
  const main = jsPsych.randomization.shuffle(Lists.build(stim, list));
  const [lo, hi] = CONFIG.ATTENTION_CHECK_RANGE;
  const attPos = lo + Math.floor(Math.random() * (hi - lo + 1));
  main.splice(attPos, 0, { sc: stim.attention_check, frame: "none", urgency: "none", cell: "attention" });
  main.forEach((t, i) => {
    timeline.push(...offerTrial(t.sc, t.frame, t.urgency, t.cell, { is_practice: 0, trial_num: i + 1 }));
    if (i + 1 === CONFIG.BREAK_AFTER) {
      timeline.push(ap({
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div class="text-page"><h2>Halfway there</h2><p class="lead">Take a short breath if you like, then continue.</p></div>`,
        choices: ["Continue"], data: { task: "break" },
      }, () => Auto.click("#jspsych-html-button-response-btngroup button")));
    }
  });

  const form = (html, task, label = "Continue") => ap({
    type: jsPsychSurveyHtmlForm, html, button_label: label, data: { task },
    on_finish: (d) => Object.assign(d, d.response || {}),
  }, () => Auto.form(false));

  timeline.push(form(Pages.crt(), "crt"));
  timeline.push(form(Pages.demographics(), "demographics"));
  timeline.push(form(Pages.scamExposure(), "scam_exposure"));
  timeline.push(form(Pages.funnel(), "funnel_debrief"));

  let keepData = true;
  timeline.push(ap({
    type: jsPsychHtmlButtonResponse,
    stimulus: Pages.educationalDebrief(stim),
    choices: ["Keep my responses in the study", "Withdraw my responses"],
    data: { task: "reconsent" },
    on_finish: (d) => { keepData = d.response === 0; d.keep_data = keepData ? 1 : 0; },
  }, () => Auto.click("#jspsych-html-button-response-btngroup button")));

  const filename = () => `${PILOT ? "pilot_" : ""}${pid}.csv`;
  const dataString = () => (keepData
    ? jsPsych.data.get().csv()
    : `participant_id,withdrawn,study_version\n${pid},1,${CONFIG.STUDY_VERSION}\n`);
  const usePipe = Boolean(CONFIG.DATAPIPE_EXPERIMENT_ID) && !DEBUG;

  if (usePipe) {
    timeline.push({
      type: jsPsychPipe, action: "save", experiment_id: CONFIG.DATAPIPE_EXPERIMENT_ID,
      filename, data_string: dataString,
    });
  }

  timeline.push({
    type: jsPsychHtmlButtonResponse,
    choices: [],
    stimulus: () => {
      const last = jsPsych.data.get().last(1).values()[0];
      const saved = usePipe && last && last.success;
      return `<div class="text-page"><h2>Thank you!</h2>
        ${saved
          ? "<p class='lead'>Your responses have been saved. You can now close this tab.</p>"
          : `<p class='lead'>${usePipe ? "We could not save your responses automatically." : "Saving to the server is turned off (test mode)."}
             Please click below to download your data file${usePipe ? " and send it to the study team" : ""}.</p>
             <p><button class="jspsych-btn" id="dl-btn">Download data file</button></p>`}
        <pre id="autopilot-output" style="display:none"></pre></div>`;
    },
    on_load: () => {
      document.getElementById("dl-btn")?.addEventListener("click", () => {
        const blob = new Blob([dataString()], { type: "text/csv" });
        const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename() });
        a.click();
      });
      if (AUTOPILOT) {
        const pre = document.getElementById("autopilot-output");
        pre.textContent = dataString();
        pre.dataset.done = "1";
      }
    },
  });

  jsPsych.run(timeline);
})();
