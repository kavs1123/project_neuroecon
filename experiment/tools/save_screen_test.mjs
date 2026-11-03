// Watch the end-of-study save screens in real time (headless Chrome via DevTools protocol).
// Usage: node --experimental-websocket save_screen_test.mjs <chrome.exe> <url> <max_seconds>
// Prints each change of the visible headline/status text with a timestamp.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [chrome, url, maxS = "400"] = process.argv.slice(2);
const port = 9334;
const proc = spawn(chrome, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "savetest-"))}`,
  "--window-size=1366,800", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result?.value;

try {
  let targets;
  for (let k = 0; k < 50; k++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(200); } }
  ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
  await send("Page.navigate", { url });
  const t0 = Date.now();
  let last = "";
  let savingSince = null;
  while ((Date.now() - t0) / 1000 < Number(maxS)) {
    const snap = await evaluate(`(() => { const c = document.querySelector('#jspsych-content') || document.body;
      const h = c.querySelector('h2')?.textContent || ''; const s = document.getElementById('save-status')?.textContent || '';
      const b = document.getElementById('dl-btn') ? ' [download button]' : ''; return h + ' | ' + s + b; })()`);
    if (snap && snap !== last) {
      if (snap.startsWith("Saving") && savingSince === null) savingSince = Date.now();
      const rel = savingSince ? `+${((Date.now() - savingSince) / 1000).toFixed(1)}s after Saving` : `${((Date.now() - t0) / 1000).toFixed(0)}s`;
      if (savingSince || /Thank|Saving/.test(snap)) console.log(`${rel.padEnd(22)} ${snap}`);
      last = snap;
      if (/^Thank you!/.test(snap) && savingSince) { await sleep(1500); break; }
    }
    await sleep(500);
  }
} finally {
  ws?.close();
  proc.kill();
}
