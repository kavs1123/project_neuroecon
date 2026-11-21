// Main timeline. URL params:
//   ?list=0..3   force a counterbalancing list (otherwise DataPipe condition assignment, else random)
//   ?preview=ID  show one offer only (never saves)
//   ?pilot=1     tag data as pilot (filename prefix "pilot_")
//   ?debug=1     skip DataPipe, offer local CSV download at the end
// Saving: @jspsych/extension-pipe uploads the whole dataset once, when the experiment ends
// (stream:false, so nothing is stored for people who drop out, matching the consent text).
//   ?autopilot=1 click through automatically (testing only; implies debug)
//   ?pid=XYZ     use a given participant id instead of a random one
(async function () {
  const params = new URLSearchParams(window.location.search);
  const AUTOPILOT = params.get("autopilot") === "1";
  const DEBUG = AUTOPILOT || params.get("debug") === "1";
  // lenient: ?pilot=1, ?Pilot=1, ?pilot?=1 ... all count as pilot runs
  const PILOT = [...params.keys()].some((k) => k.toLowerCase().replace(/[^a-z]/g, "") === "pilot");
  const ACCEPT = "Accept offer";
  const IGNORE = "Ignore";
  const usePipe = Boolean(CONFIG.DATAPIPE_EXPERIMENT_ID) && !DEBUG && !params.has("preview");

  // ---------- participant id + what gets saved ----------
  const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
  const randomId = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => ALPHABET[b % ALPHABET.length]).join("");
  const pid = params.get("pid") || randomId(10);
  let status = "in_progress"; // -> "declined" | "withdrawn" | "complete"
  let jsPsych = null;
  const filename = () => `${PILOT ? "pilot_" : ""}${pid}.csv`;
  const dataString = () => {
    if (status === "declined") return `participant_id,declined,study_version\n${pid},1,${CONFIG.STUDY_VERSION}\n`;
    if (status === "withdrawn") return `participant_id,withdrawn,study_version\n${pid},1,${CONFIG.STUDY_VERSION}\n`;
    return jsPsych.data.get().csv();
  };
  const download = () => {
    const blob = new Blob([dataString()], { type: "text/csv" });
    Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename() }).click();
  };

  const THANKS_HTML = "<div class='text-page'><h2>Thank you!</h2><p class='lead'>Your responses have been saved. You can now close this tab.</p></div>";
  const THANKS_WITH_BACKUP_HTML = `<div class='text-page'><h2>Thank you!</h2>
    <p class='lead'>Your responses have been saved. You can now close this tab.</p>
    <p class='small'><button class='jspsych-btn' id='dl-btn' style='margin-top:12px;font-size:13px;'>Download backup copy (optional)</button></p></div>`;

  // Runs while the final upload is pending (started when the last screen is left).
  const saveWatch = {
    timers: [],
    start() {
      const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
      this.timers.push(setTimeout(() => set("save-status", "Still saving… this can take up to a minute."), 8000));
      this.timers.push(setTimeout(() => {
        // If DataPipe's HTTP reply has not arrived after 1 minute, DataPipe has almost certainly already written
        // the file to Google Drive. Replace the "Saving…" screen entirely with the completion screen.
        const display = jsPsych.getDisplayElement();
        if (display) {
          display.innerHTML = THANKS_WITH_BACKUP_HTML;
          document.getElementById("dl-btn")?.addEventListener("click", download);
        }
      }, 60000));
    },
    stop() { this.timers.forEach(clearTimeout); this.timers = []; },
  };

  const extensions = [{ type: jsPsychExtensionMouseTracking, params: { minimum_sample_time: 50 } }];
  if (usePipe) {
    extensions.push({
      type: jsPsychExtensionPipe,
      params: {
        experiment_id: CONFIG.DATAPIPE_EXPERIMENT_ID,
        filename,
        data_string: dataString,
        stream: false,
        // DataPipe can write the file to Drive well before its HTTP reply arrives (the 0.4.1 pilot sat on
        // "Saving…" although the CSV was already in Drive). So: reassure after a while, offer a backup
        // download, and draw the final screen ourselves in on_save instead of relying on done_message.
        wait_message: `<div class='text-page'><h2>Saving…</h2><p class='lead'>Saving your responses. Please do not close this page.</p>
          <p id="save-status" class="small"></p><p id="save-backup"></p></div>`,
        done_message: THANKS_HTML,
        on_save: (result) => {
          saveWatch.stop();
          const display = jsPsych.getDisplayElement();
          if (!display) return;
          if (result.ok) {
            display.innerHTML = THANKS_HTML;
            return;
          }
          // If the watchdog already transitioned to the thank-you screen after 1 minute, keep it.
          // Otherwise, show the download button.
          if (!document.getElementById("dl-btn")) {
            display.innerHTML = `<div class="text-page"><h2>Thank you!</h2>
              <p class="lead">We could not confirm that your responses were saved. Please download your data file and send it to the study team.</p>
              <p><button class="jspsych-btn" id="dl-btn">Download data file</button></p></div>`;
            document.getElementById("dl-btn")?.addEventListener("click", download);
          }
        },
      },
    });
  }

  jsPsych = initJsPsych({
    show_progress_bar: true,
    auto_update_progress_bar: false,
    message_progress_bar: "Progress",
    extensions,
  });

  const stim = await (await fetch(CONFIG.STIMULI_URL, { cache: "no-store" })).json();
  if (DEBUG) Lists.check(stim);

  // ---------- counterbalancing list ----------
  // Assigned by the "list_assignment" step AFTER consent, device check and instructions, so people who only
  // open the link (or reload it) do not use up a DataPipe condition. Order: URL ?list= > DataPipe > random.
  let list = params.has("list") ? Number(params.get("list")) : null;
  let listSource = list === null || Number.isNaN(list) ? null : "url";

  // Decision-button side is counterbalanced across participants.
  const coin = () => crypto.getRandomValues(new Uint8Array(1))[0] < 128;
  const buttonOrder = coin() ? [ACCEPT, IGNORE] : [IGNORE, ACCEPT];

  jsPsych.data.addProperties({
    participant_id: pid,
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
    offer(type, timed) {
      if (timed && Math.random() < 0.2) return; // let the deadline expire (tests the timeout path)
      const cues = [...document.querySelectorAll(".cue-head")];
      const k = rand(3);
      const step = CONFIG.CHECK_DELAY_MS + 300;
      cues.slice(0, k).forEach((c, i) => setTimeout(() => c.click(), step * i + 200));
      const pAccept = type === "scam" ? 0.35 : type === "legit" ? 0.7 : 0;
      const label = Math.random() < pAccept ? ACCEPT : IGNORE;
      setTimeout(() => {
        const btn = [...document.querySelectorAll("#jspsych-html-button-response-btngroup button")].find((b) => b.textContent === label);
        btn.click();
      }, step * k + 1500 + rand(4000));
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
    const timed = Chat.hasTimer(sc, urgency, stim);
    const deadline = timed ? CONFIG.DEADLINE_SECONDS : null;
    let timedOut = false;
    const offer = {
      type: jsPsychHtmlButtonResponse,
      stimulus: Chat.render(sc, frame, urgency, stim, CONFIG.DEADLINE_SECONDS),
      choices: buttonOrder,
      button_html: (choice) => `<button class="jspsych-btn decision-btn">${choice}</button>`,
      trial_duration: timed ? CONFIG.DEADLINE_SECONDS * 1000 : null, // the offer really expires
      save_trial_parameters: { stimulus: false },
      data: { task: "offer", deadline_s: deadline, ...base },
      extensions: [{
        type: jsPsychExtensionMouseTracking,
        params: { targets: ["#phone", ".cue-panel", '#jspsych-html-button-response-btngroup [data-choice="0"]', '#jspsych-html-button-response-btngroup [data-choice="1"]'], events: ["mousemove", "mousedown"] },
      }],
      on_load: () => {
        currentOffer = Chat.attach(document.querySelector("#jspsych-content"), { deadlineSeconds: deadline, checkDelayMs: CONFIG.CHECK_DELAY_MS });
      },
      on_finish: (data) => {
        timedOut = data.response === null || data.response === undefined;
        if (currentOffer) Object.assign(data, currentOffer.finish(timedOut ? deadline * 1000 : data.rt));
        currentOffer = null;
        data.timeout = timedOut ? 1 : 0;
        data.choice = timedOut ? "timeout" : buttonOrder[data.response] === ACCEPT ? "accept" : "ignore";
        data.accept = timedOut ? null : data.choice === "accept" ? 1 : 0;
      },
    };
    const expired = {
      timeline: [{
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div class="text-page expired"><h2>⏳ This offer has expired</h2><p class="lead">The timer ran out, so it counts as not accepted.</p></div>`,
        choices: [],
        trial_duration: 1800,
        data: { task: "expired_notice", ...base },
      }],
      conditional_function: () => timedOut,
    };
    const ratings = {
      type: jsPsychSurveyHtmlForm,
      html: () => Pages.ratings(sc, timedOut),
      button_label: "Continue",
      data: { task: "ratings", ...base },
      on_load: Pages.armSlider,
      on_finish: (data) => {
        const r = data.response || {};
        data.intent = Number(r.intent);
        ["urg_check", "deliberation"].forEach((k) => (data[k] = r[k] === undefined ? null : Number(r[k])));
        data.frame_check = r.frame_check ?? null;
        if (!meta.is_practice) jsPsych.progressBar.progress = ++doneMain / nMain;
      },
    };
    return [ap(offer, () => Auto.offer(sc.type, timed)), expired, ap(ratings, () => Auto.form(sc.type === "check"))];
  }

  // ---------- preview mode: ?preview=S01&frame=loss&urgency=high shows one offer (for review/screenshots) ----------
  if (params.has("preview")) {
    const all = [...stim.scenarios, ...stim.practice, stim.attention_check];
    const sc = all.find((s) => s.id === params.get("preview")) || stim.scenarios[0];
    const f = params.get("frame") || "gain";
    const u = params.get("urgency") || "high";
    Chat.budget.set(CONFIG.PRACTICE_CHECKS);
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
      if (d.response !== 0) {
        status = "declined";
        jsPsych.abortExperiment("<p>You chose not to take part. Thank you for your time. You can close this tab.</p>");
      }
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
    on_finish: () => Chat.budget.set(CONFIG.PRACTICE_CHECKS),
  }, () => Auto.instructions()));

  timeline.push({
    type: jsPsychCallFunction,
    async: true,
    data: { task: "list_assignment" },
    func: (done) => {
      const finish = () => {
        jsPsych.data.addProperties({ list, list_source: listSource }); // also back-fills earlier rows
        done({ list, list_source: listSource });
      };
      const fallback = () => {
        list = crypto.getRandomValues(new Uint8Array(1))[0] % Lists.N_LISTS;
        listSource = "random";
        finish();
      };
      if (listSource === "url") return finish();
      if (!usePipe) return fallback();
      jsPsychExtensionPipe.getCondition(CONFIG.DATAPIPE_EXPERIMENT_ID)
        .then((c) => {
          if (!Number.isInteger(c)) return fallback();
          list = c % Lists.N_LISTS;
          listSource = "datapipe";
          finish();
        })
        .catch((e) => { console.warn("DataPipe condition assignment failed; using a random list", e); fallback(); });
    },
  });

  // practice: one legit (gain/low), one scam (loss/high) so both screen types are seen
  const [p1, p2] = stim.practice;
  timeline.push(...offerTrial(p1, "gain", "low", "gain_low", { is_practice: 1, trial_num: -2 }));
  timeline.push(...offerTrial(p2, "loss", "high", "loss_high", { is_practice: 1, trial_num: -1 }));
  timeline.push(ap({
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="text-page"><h2>Practice complete</h2><p class="lead">Now the main part begins. There are ${nMain} messages,
      and you have <b>${CONFIG.CHECK_BUDGET} checks</b> for all of them. Remember: respond as you genuinely would.</p></div>`,
    choices: ["Start"],
    data: { task: "practice_end" },
    on_finish: () => Chat.budget.set(CONFIG.CHECK_BUDGET),
  }, () => Auto.click("#jspsych-html-button-response-btngroup button")));

  // main trials: one block per list (only the assigned list runs); randomised order, attention check in the middle range
  const [lo, hi] = CONFIG.ATTENTION_CHECK_RANGE;
  for (let L = 0; L < Lists.N_LISTS; L++) {
    const block = [];
    const main = jsPsych.randomization.shuffle(Lists.build(stim, L));
    const attPos = lo + Math.floor(Math.random() * (hi - lo + 1));
    main.splice(attPos, 0, { sc: stim.attention_check, frame: "none", urgency: "none", cell: "attention" });
    main.forEach((t, i) => {
      block.push(...offerTrial(t.sc, t.frame, t.urgency, t.cell, { is_practice: 0, trial_num: i + 1 }));
      if (i + 1 === CONFIG.BREAK_AFTER) {
        block.push(ap({
          type: jsPsychHtmlButtonResponse,
          stimulus: `<div class="text-page"><h2>Halfway there</h2><p class="lead">Take a short breath if you like, then continue.</p></div>`,
          choices: ["Continue"], data: { task: "break" },
        }, () => Auto.click("#jspsych-html-button-response-btngroup button")));
      }
    });
    timeline.push({ timeline: block, conditional_function: () => list === L });
  }

  const form = (html, task, label = "Continue") => ap({
    type: jsPsychSurveyHtmlForm, html, button_label: label, data: { task },
    on_finish: (d) => Object.assign(d, d.response || {}),
  }, () => Auto.form(false));

  timeline.push(form(Pages.crt(), "crt"));
  timeline.push(form(Pages.demographics(), "demographics"));
  timeline.push(form(Pages.scamExposure(), "scam_exposure"));
  timeline.push(form(Pages.funnel(), "funnel_debrief"));

  timeline.push(ap({
    type: jsPsychHtmlButtonResponse,
    stimulus: Pages.educationalDebrief(stim),
    choices: ["Keep my responses in the study", "Withdraw my responses"],
    data: { task: "reconsent" },
    on_finish: (d) => {
      status = d.response === 0 ? "complete" : "withdrawn";
      d.keep_data = status === "complete" ? 1 : 0;
      if (usePipe) saveWatch.start(); // the upload starts right after this, the last screen
    },
  }, () => Auto.click("#jspsych-html-button-response-btngroup button")));

  // Test mode only: final screen with a download button (+ CSV dump for the autopilot test).
  // With DataPipe on, the reconsent screen is the last trial and the extension shows its done message.
  if (!usePipe) {
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      choices: [],
      stimulus: `<div class="text-page"><h2>Thank you!</h2>
        <p class='lead'>Saving to the server is turned off (test mode). Click below to download the data file.</p>
        <p><button class="jspsych-btn" id="dl-btn">Download data file</button></p>
        <pre id="autopilot-output" style="display:none"></pre></div>`,
      on_load: () => {
        document.getElementById("dl-btn").addEventListener("click", download);
        if (AUTOPILOT) {
          const pre = document.getElementById("autopilot-output");
          pre.textContent = dataString();
          pre.dataset.done = "1";
        }
      },
    });
  }

  jsPsych.run(timeline);
})();
