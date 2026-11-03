// Page content and form builders (no timeline logic here).
const Pages = (() => {
  const likert = (name, left, right, n = 7) => `
    <div class="likert">${Array.from({ length: n }, (_, i) =>
      `<label><input type="radio" name="${name}" value="${i + 1}" ${i === 0 ? "required" : ""}>${i + 1}</label>`).join("")}
    </div>
    <div class="likert-ends"><span>${left}</span><span>${right}</span></div>`;

  const consent = () => `
    <div class="text-page">
      <h2>Evaluating remote-job offers received on messaging apps</h2>
      <p>Thank you for your interest. This short study is part of a university Neuroeconomics course project
      (${CONFIG.TEAM}).</p>
      <p><b>What you will do.</b> You will read about 25 short chat messages offering remote or part-time work, decide
      how you would respond to each, and answer a few quick questions. It takes about <b>12–15 minutes</b>.
      Please use a laptop or desktop computer.</p>
      <p><b>Your data.</b> Participation is anonymous. We do not ask for your name, phone number or email. You get a random ID,
      and responses are used only for this course project, in aggregate.</p>
      <p><b>Voluntary.</b> You can stop at any time by closing the tab. Nothing is saved unless you reach the end.
      Some details of the study's purpose will be explained fully at the end.</p>
      <p><b>Important:</b> none of the messages in this study are real. Do not contact any number, name or company shown.</p>
      ${CONFIG.CONTACT ? `<p class="small">Questions: ${CONFIG.CONTACT}</p>` : ""}
      <p>By clicking <b>I agree</b> you confirm that you are 18 or older and agree to take part.</p>
    </div>`;

  const instructions = [
    `<div class="text-page"><h2>Instructions (1/3)</h2>
      <p class="lead">Imagine you are currently looking for <b>part-time or remote work</b> to earn some extra money.</p>
      <p>Over the next few minutes, you will see a series of chat messages about job offers, like the ones people often
      receive on messaging apps. Imagine each one has just arrived on your phone.</p></div>`,
    `<div class="text-page"><h2>Instructions (2/3)</h2>
      <p>For each message:</p>
      <ol>
        <li><b>Read</b> the chat on the left.</li>
        <li>If you want, <b>check details</b> about the sender, company or payment terms in the boxes on the right.</li>
        <li>Decide: <b>Accept offer</b> (you'd go ahead and register/apply) or <b>Ignore</b>.</li>
        <li>Answer a few quick questions about that message.</li>
      </ol>
      <p><b>Checks are limited.</b> You have <b>${CONFIG.CHECK_BUDGET} checks for the whole study</b> (about one per message).
      Each new box you open uses one check and takes a moment to load. When your checks run out, the boxes lock.
      So decide where checking is worth it, just as in real life, where you can't look up every message.</p></div>`,
    `<div class="text-page"><h2>Instructions (3/3)</h2>
      <p><b>Some offers have a timer.</b> The timers are real: if the timer runs out before you decide, the offer
      <b>expires</b> and counts as not accepted.</p>
      <p>There are no right or wrong answers. Please respond as you <b>genuinely</b> would if the message were real.</p>
      <p>We'll start with <b>2 practice messages</b> (with ${CONFIG.PRACTICE_CHECKS} practice checks), then the main part
      (about 25 messages).</p></div>`,
  ];

  const ratings = (sc, timedOut) => `
    <div class="rate-form">
      <div class="about">${timedOut ? "The offer expired. " : ""}About the offer from <b>${sc.sender}</b></div>
      <div class="q"><div class="qt">How likely would you be to accept this offer and register / apply?</div>
        <div class="slider-wrap">
          <input type="range" id="intent" name="intent" min="0" max="100" step="1" value="50">
          <div class="slider-ends"><span>0: Not at all likely</span><span id="intent-val">Move the slider</span><span>100: Extremely likely</span></div>
        </div></div>
      <div class="q"><div class="qt">How urgent did this offer feel?</div>
        ${likert("urg_check", "Not at all urgent", "Extremely urgent")}</div>
      <div class="q"><div class="qt">How was the ₹2,000 described in this message?</div>
        <div class="choice-row">
          <label><input type="radio" name="frame_check" value="gain" required> as <b>extra money I would get</b> if I accepted</label>
          <label><input type="radio" name="frame_check" value="loss"> as money <b>already mine that I would lose</b> if I didn't accept</label>
        </div></div>
      <div class="q"><div class="qt">How did you make this decision?</div>
        ${likert("deliberation", "Mostly on gut feeling", "Carefully weighed the details")}</div>
    </div>`;

  /** The slider must be moved (or clicked) at least once before the form can be submitted.
   *  No styling changes while dragging (v0.3 hid the thumb until first touch, which made dragging unreliable). */
  function armSlider() {
    const r = document.getElementById("intent");
    const out = document.getElementById("intent-val");
    if (!r) return;
    r.setCustomValidity("Please move the slider to give your answer.");
    const touch = () => {
      r.setCustomValidity("");
      out.textContent = `Your answer: ${r.value}`;
    };
    ["input", "change", "pointerup", "keyup"].forEach((ev) => r.addEventListener(ev, touch));
  }

  // CRT-2 (Thomson & Oppenheimer, 2016) — less familiar to students than the classic CRT-3.
  const CRT_ITEMS = [
    "If you're running a race and you pass the person in second place, what place are you in?",
    "A farmer had 15 sheep and all but 8 died. How many are left?",
    "Emily's father has three daughters. The first two are named April and May. What is the third daughter's name?",
    "How many cubic feet of dirt are there in a hole that is 3 feet deep × 3 feet wide × 3 feet long?",
  ];
  const crt = () => `
    <div class="text-page"><h2>A few short questions</h2>
      <p>Please answer each question. Take your time.</p>
      <div class="form-grid">${CRT_ITEMS.map((q, i) =>
        `<label>${i + 1}. ${q}<br><input type="text" name="crt_${i + 1}" required autocomplete="off"></label>`).join("")}
      </div></div>`;

  const demographics = () => `
    <div class="text-page"><h2>About you</h2>
      <div class="form-grid">
        <label>Age<br><input type="number" name="age" min="18" max="99" required></label>
        <label>Gender<br><select name="gender" required>
          <option value="">— select —</option><option>Woman</option><option>Man</option>
          <option>Non-binary / other</option><option>Prefer not to say</option></select></label>
        <label>Current status<br><select name="occupation" required>
          <option value="">— select —</option><option>Student</option><option>Working</option>
          <option>Student and working</option><option>Neither</option></select></label>
        <label>Are you currently looking for a job, internship or part-time work?<br><select name="job_seeking" required>
          <option value="">— select —</option><option>Yes</option><option>No</option></select></label>
        <label>Roughly how many hours a day do you spend on messaging apps?<br><select name="messaging_hours" required>
          <option value="">— select —</option><option>Less than 1</option><option>1–2</option>
          <option>3–4</option><option>5 or more</option></select></label>
      </div></div>`;

  const scamExposure = () => `
    <div class="text-page"><h2>Your experience with online job offers</h2>
      <div class="form-grid">
        <label>Have you ever received an unsolicited job offer through WhatsApp, Telegram, SMS or similar?<br>
          <select name="exp_received" required><option value="">— select —</option><option>Yes</option><option>No</option><option>Not sure</option></select></label>
        <label>Have you ever replied to or engaged with such an offer (e.g., done a task, registered)?<br>
          <select name="exp_engaged" required><option value="">— select —</option><option>Yes</option><option>No</option></select></label>
        <label>Have you ever lost money to an online job or task scam?<br>
          <select name="exp_lost" required><option value="">— select —</option><option>Yes</option><option>No</option></select></label>
        <label>Has someone close to you lost money to such a scam?<br>
          <select name="exp_close_lost" required><option value="">— select —</option><option>Yes</option><option>No</option><option>Not sure</option></select></label>
      </div></div>`;

  // Funnel debrief: general -> specific, before the purpose is revealed.
  const funnel = () => `
    <div class="text-page"><h2>Almost done — a few questions about the study</h2>
      <div class="form-grid">
        <label>1. In your own words, what do you think this study was about?<br><textarea name="funnel_purpose" required></textarea></label>
        <label>2. Did you notice anything particular about how the messages were worded or presented? If so, what?<br><textarea name="funnel_noticed" required></textarea></label>
        <label>3. While doing the task, did you think some of the offers might be scams?<br>
          <select name="funnel_suspect_scam" required><option value="">— select —</option><option>Yes</option><option>No</option><option>Unsure</option></select></label>
        <label>4. Did you think the study was testing how <i>timers/deadlines</i> or <i>the wording of rewards</i> affected your decisions?<br>
          <select name="funnel_guess_hyp" required><option value="">— select —</option><option>Yes</option><option>No</option><option>Unsure</option></select></label>
      </div></div>`;

  const educationalDebrief = (stim) => {
    const scams = stim.scenarios.filter((s) => s.type === "scam");
    return `
    <div class="text-page"><h2>What this study was really about</h2>
      <p>Thank you! We now need to tell you more about the study. <b>Half of the job offers you saw (${scams.length} of ${stim.scenarios.length}) were modelled on
      real "task-based job" scams</b> that circulate on messaging apps. The other half resembled legitimate offers.
      All names, numbers and companies were fictional.</p>
      <p>We were studying whether two common scam techniques change people's decisions:</p>
      <ul>
        <li><b>Framing:</b> describing the same ₹2,000 as something extra you <i>gain</i> by accepting ("you'll get an extra ₹2,000")
            versus something already yours that you <i>lose</i> by not accepting ("₹2,000 has already been reserved in your name… it will go to the next applicant").</li>
        <li><b>Urgency:</b> countdown timers and "only 2 slots left" messages versus no time pressure.</li>
        <li>We also limited how many details you could check, to see how people decide when checking is costly.</li>
      </ul>
      <p>We could not tell you this at the start, because knowing it would have changed how you responded.</p>
      <h3>The scam offers were from:</h3>
      <ul class="scam-list">${scams.map((s) => `<li>${s.sender}</li>`).join("")}</ul>
      <h3>Red flags to watch for in real life</h3>
      <ul class="flag-list">
        <li><b>Any upfront payment</b> ("activation fee", "refundable deposit", "tax", "VIP level") — legitimate employers never ask you to pay to work.</li>
        <li><b>Payment to a personal UPI ID</b> or wallet rather than a company account.</li>
        <li><b>Unsolicited contact</b> from unknown or international numbers, often with no interview.</li>
        <li><b>Too-good pay for trivial tasks</b> (liking videos, rating apps or hotels, "boosting" orders).</li>
        <li><b>Pressure tactics:</b> countdowns, limited slots, "your bonus will be lost". Slow down whenever you feel rushed.</li>
        <li><b>Unverifiable company:</b> no registration, a newly created website, only a chat group.</li>
      </ul>
      <p class="small">In India, cyber-fraud can be reported at the national cyber-crime helpline <b>1930</b> or cybercrime.gov.in.</p>
      <p><b>Now that you know the real purpose, may we keep your responses?</b> Choosing "withdraw" deletes your answers. Only a note that you withdrew is kept.</p>
    </div>`;
  };

  return { consent, instructions, ratings, armSlider, crt, demographics, scamExposure, funnel, educationalDebrief, CRT_ITEMS };
})();
