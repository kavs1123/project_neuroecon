// Renders one job offer as a phone chat plus a click-to-reveal cue panel,
// and wires up the reveal logging and the live countdown.
const Chat = (() => {
  const CUE_ORDER = ["sender", "company", "payment"];

  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const fill = (tpl, k) => tpl.replaceAll("{amount}", k.amount).replaceAll("{slots}", k.slots_left);

  const fmt = (sec) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  function initials(name) {
    const base = name.split("|").pop().trim();
    return base.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }

  /** Message texts for one scenario in one cell (slots {FRAME}/{URGENCY} filled in). */
  function messagesFor(sc, frame, urgency, stim) {
    return sc.messages.map((m) => {
      if (m === "{FRAME}") return fill(stim.frames[sc.type][frame], stim.constants);
      if (m === "{URGENCY}") return fill(stim.urgency[sc.type][urgency].text, stim.constants);
      return m;
    });
  }

  function hasTimer(sc, urgency, stim) {
    return Boolean(stim.urgency[sc.type] && stim.urgency[sc.type][urgency]?.timer);
  }

  /** HTML for the offer screen. The header shows the display name only; the number/account
   *  status is in the 'Sender profile' cue so it has to be looked up. */
  function render(sc, frame, urgency, stim) {
    const k = stim.constants;
    const msgs = messagesFor(sc, frame, urgency, stim);
    const timer = hasTimer(sc, urgency, stim);
    const label = timer ? stim.urgency[sc.type][urgency].timer_label : "";
    const bubbles = msgs
      .map((m, i) => `<div class="bubble">${esc(m)}<span class="ts">10:${String(41 + i).padStart(2, "0")}</span></div>`)
      .join("");
    const cues = CUE_ORDER.map(
      (c) => `<div class="cue" id="cue-${c}" data-cue="${c}">
          <button type="button" class="cue-head">${esc(stim.cue_labels[c])}<span class="chev">+</span></button>
          <div class="cue-body">${esc(sc.cues[c])}</div>
        </div>`
    ).join("");
    return `
      <div class="offer-layout">
        <div class="phone" id="phone">
          <div class="phone-header">
            <div class="avatar">${esc(initials(sc.sender))}</div>
            <div><div class="name">${esc(sc.sender)}</div><div class="status">online</div></div>
          </div>
          ${timer ? `<div class="timer-banner"><span>⏳ ${esc(label)}</span><span class="timer" id="countdown">${fmt(k.countdown_seconds)}</span></div>` : ""}
          <div class="chat-body"><div class="day-chip">Today</div>${bubbles}</div>
        </div>
        <div class="cue-panel">
          <h3>Check details <span>(optional)</span></h3>
          <p class="cue-hint">Click a box to open it. Only one box is open at a time.</p>
          ${cues}
          <div class="decision-label">Your decision</div>
        </div>
      </div>`;
  }

  /** Attach reveal + timer behaviour. Returns a handle whose finish(rt) returns the cue summary. */
  function attach(root, countdownSeconds) {
    const t0 = performance.now();
    // put the decision buttons under the cues (saves vertical space) and show the newest message
    const btns = root.querySelector("#jspsych-html-button-response-btngroup");
    const panel = root.querySelector(".cue-panel");
    if (btns && panel) panel.appendChild(btns);
    const body = root.querySelector(".chat-body");
    if (body) body.scrollTop = body.scrollHeight;
    const now = () => Math.round(performance.now() - t0);
    const events = [];
    let open = null;

    const closeCurrent = (t) => {
      if (!open) return;
      open.ev.close = t;
      open.el.classList.remove("open");
      open.el.querySelector(".chev").textContent = "+";
      open = null;
    };

    root.querySelectorAll(".cue").forEach((el) => {
      el.querySelector(".cue-head").addEventListener("click", () => {
        const t = now();
        const name = el.dataset.cue;
        const same = open && open.name === name;
        closeCurrent(t);
        if (same) return;
        const ev = { cue: name, open: t, close: null };
        events.push(ev);
        el.classList.add("open");
        el.querySelector(".chev").textContent = "−";
        open = { name, el, ev };
      });
    });

    let interval = null;
    const cd = root.querySelector("#countdown");
    if (cd) {
      let remaining = countdownSeconds;
      interval = setInterval(() => {
        remaining = Math.max(0, remaining - 1);
        cd.textContent = fmt(remaining);
      }, 1000);
    }

    return {
      finish(rt) {
        const tEnd = rt ?? now();
        closeCurrent(tEnd);
        if (interval) clearInterval(interval);
        const dwell = Object.fromEntries(CUE_ORDER.map((c) => [c, 0]));
        events.forEach((e) => (dwell[e.cue] += Math.max(0, (e.close ?? tEnd) - e.open)));
        const unique = new Set(events.map((e) => e.cue));
        return {
          cue_events: JSON.stringify(events),
          n_cues: unique.size,
          n_cue_opens: events.length,
          cue_dwell_ms: CUE_ORDER.reduce((s, c) => s + dwell[c], 0),
          dwell_sender_ms: dwell.sender,
          dwell_company_ms: dwell.company,
          dwell_payment_ms: dwell.payment,
          opened_sender: unique.has("sender"),
          opened_company: unique.has("company"),
          opened_payment: unique.has("payment"),
          first_cue_ms: events.length ? events[0].open : null,
        };
      },
    };
  }

  /** Empty cue summary (used if the trial is simulated without a DOM). */
  const emptySummary = () => attach(document.createElement("div"), 0).finish(0);

  return { render, attach, emptySummary, messagesFor, hasTimer, CUE_ORDER };
})();
