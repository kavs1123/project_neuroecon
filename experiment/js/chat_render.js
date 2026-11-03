// Renders one job offer as a phone chat plus a click-to-reveal cue panel, and wires up:
//  - a session-wide CHECK BUDGET (each first reveal of a box costs one check; boxes lock at 0),
//  - a "Checking…" delay before a detail appears (time cost),
//  - the live countdown for high-urgency offers (the trial itself expires via trial_duration).
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

  /** Session-wide budget of detail checks. */
  const budget = { left: 0, set(n) { this.left = n; } };

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
   *  status is in the 'Sender profile' box so it has to be looked up. */
  function render(sc, frame, urgency, stim, deadlineSeconds) {
    const msgs = messagesFor(sc, frame, urgency, stim);
    const timer = hasTimer(sc, urgency, stim);
    const label = timer ? stim.urgency[sc.type][urgency].timer_label : "";
    const bubbles = msgs
      .map((m, i) => `<div class="bubble">${esc(m)}<span class="ts">10:${String(41 + i).padStart(2, "0")}</span></div>`)
      .join("");
    const cues = CUE_ORDER.map(
      (c) => `<div class="cue" id="cue-${c}" data-cue="${c}">
          <button type="button" class="cue-head">${esc(stim.cue_labels[c])}<span class="chev">+</span></button>
          <div class="cue-body" data-text="${esc(sc.cues[c])}"></div>
        </div>`
    ).join("");
    return `
      <div class="offer-layout">
        <div class="phone" id="phone">
          <div class="phone-header">
            <div class="avatar">${esc(initials(sc.sender))}</div>
            <div><div class="name">${esc(sc.sender)}</div><div class="status">online</div></div>
          </div>
          ${timer ? `<div class="timer-banner"><span>⏳ ${esc(label)}</span><span class="timer" id="countdown">${fmt(deadlineSeconds)}</span></div>` : ""}
          <div class="chat-body"><div class="day-chip">Today</div>${bubbles}</div>
        </div>
        <div class="cue-panel">
          <h3>Check details <span class="checks-left" id="checks-left"></span></h3>
          <p class="cue-hint">Each new box you open uses one check. Checks are limited for the whole study.</p>
          ${cues}
          <div class="decision-label">Your decision</div>
        </div>
      </div>`;
  }

  /** Attach reveal + budget + countdown behaviour. Returns a handle whose finish(rt) returns the cue summary. */
  function attach(root, { deadlineSeconds = null, checkDelayMs = 1200 } = {}) {
    const t0 = performance.now();
    const now = () => Math.round(performance.now() - t0);
    const budgetBefore = budget.left;

    // put the decision buttons under the boxes (saves vertical space) and show the newest message
    const btns = root.querySelector("#jspsych-html-button-response-btngroup");
    const panel = root.querySelector(".cue-panel");
    if (btns && panel) panel.appendChild(btns);
    const body = root.querySelector(".chat-body");
    if (body) body.scrollTop = body.scrollHeight;

    const counter = root.querySelector("#checks-left");
    const showBudget = () => {
      if (!counter) return;
      counter.textContent = `· ${budget.left} check${budget.left === 1 ? "" : "s"} left`;
      counter.classList.toggle("none-left", budget.left === 0);
      root.querySelectorAll(".cue").forEach((el) => el.classList.toggle("locked", budget.left === 0 && !el.dataset.revealed));
    };
    showBudget();

    const events = [];
    let denied = 0;
    let open = null;
    const timers = [];

    const closeCurrent = (t) => {
      if (!open) return;
      open.ev.close = t;
      open.el.classList.remove("open");
      open.el.querySelector(".chev").textContent = "+";
      open = null;
    };

    root.querySelectorAll(".cue").forEach((el) => {
      const bodyEl = el.querySelector(".cue-body");
      el.querySelector(".cue-head").addEventListener("click", () => {
        const t = now();
        const name = el.dataset.cue;
        const same = open && open.name === name;
        closeCurrent(t);
        if (same) return;
        const firstTime = !el.dataset.revealed;
        if (firstTime && budget.left <= 0) {
          denied += 1;
          el.classList.add("denied");
          timers.push(setTimeout(() => el.classList.remove("denied"), 900));
          return;
        }
        const ev = { cue: name, open: t, shown: null, close: null, paid: firstTime };
        events.push(ev);
        el.classList.add("open");
        el.querySelector(".chev").textContent = "−";
        open = { name, el, ev };
        if (firstTime) {
          budget.left -= 1;
          el.dataset.revealed = "1";
          showBudget();
          bodyEl.innerHTML = `<span class="checking">Checking…</span>`;
          timers.push(setTimeout(() => {
            bodyEl.textContent = bodyEl.dataset.text;
            ev.shown = now();
          }, checkDelayMs));
        } else {
          ev.shown = t; // already looked up: shows instantly, no extra cost
        }
      });
    });

    let interval = null;
    const cd = root.querySelector("#countdown");
    if (cd && deadlineSeconds) {
      let remaining = deadlineSeconds;
      interval = setInterval(() => {
        remaining = Math.max(0, remaining - 1);
        cd.textContent = fmt(remaining);
        cd.classList.toggle("last-seconds", remaining <= 5);
      }, 1000);
    }

    return {
      finish(rt) {
        const tEnd = rt ?? now();
        closeCurrent(tEnd);
        if (interval) clearInterval(interval);
        timers.forEach(clearTimeout);
        const dwell = Object.fromEntries(CUE_ORDER.map((c) => [c, 0]));
        events.forEach((e) => {
          if (e.shown !== null) dwell[e.cue] += Math.max(0, (e.close ?? tEnd) - e.shown);
        });
        const unique = new Set(events.map((e) => e.cue));
        return {
          cue_events: JSON.stringify(events),
          n_cues: unique.size,
          n_cue_opens: events.length,
          n_checks_denied: denied,
          checks_left_before: budgetBefore,
          checks_left_after: budget.left,
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

  return { render, attach, budget, messagesFor, hasTimer, CUE_ORDER };
})();
