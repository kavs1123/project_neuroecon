// Drag-test the intent slider in a real (headless) Chrome via the DevTools protocol.
// Usage: node --experimental-websocket slider_drag_test.mjs <chrome.exe> <base-url>
// Opens ?preview=S01, clicks a decision button, then performs two consecutive drags on the slider
// and prints the slider value after each one. Both drags should change the value.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [chrome, base] = process.argv.slice(2);
const port = 9333;
const prof = mkdtempSync(join(tmpdir(), "slidertest-"));
const proc = spawn(chrome, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "--window-size=1366,800", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
const mouse = (type, x, y) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 });

async function drag(fromX, toX, y) {
  await mouse("mousePressed", fromX, y);
  for (let k = 1; k <= 10; k++) { await mouse("mouseMoved", fromX + ((toX - fromX) * k) / 10, y); await sleep(15); }
  await mouse("mouseReleased", toX, y);
  await sleep(100);
}

try {
  let targets;
  for (let k = 0; k < 50; k++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(200); } }
  const page = targets.find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
  await send("Page.enable");
  await send("Page.navigate", { url: `${base}/index.html?preview=S01&frame=gain&urgency=low` });
  await sleep(3000);
  await evaluate(`document.querySelector('#jspsych-html-button-response-btngroup button').click()`);
  await sleep(800);
  const geo = await evaluate(`(() => { const r = document.getElementById('intent'); r.scrollIntoView({block:'center'}); const b = r.getBoundingClientRect(); return {x:b.left, y:b.top + b.height/2, w:b.width, v:+r.value}; })()`);
  const thumbX = (v) => geo.x + 8 + (geo.w - 16) * (v / 100);
  console.log("start value", geo.v);
  await drag(thumbX(geo.v), thumbX(80), geo.y);
  const v1 = await evaluate(`+document.getElementById('intent').value`);
  console.log("after drag 1 (to ~80):", v1);
  await drag(thumbX(v1), thumbX(20), geo.y);
  const v2 = await evaluate(`+document.getElementById('intent').value`);
  console.log("after drag 2 (to ~20):", v2);
  await drag(thumbX(v2), thumbX(60), geo.y);
  const v3 = await evaluate(`+document.getElementById('intent').value`);
  console.log("after drag 3 (to ~60):", v3);
  console.log(Math.abs(v1 - 80) <= 3 && Math.abs(v2 - 20) <= 3 && Math.abs(v3 - 60) <= 3 ? "PASS: every drag moved the slider" : "FAIL: a drag did not move the slider");
} finally {
  ws?.close();
  proc.kill();
}
