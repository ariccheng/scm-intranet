/* ---- Flow --------------------------------------------------------------------------------
   The one place that changes what the student is looking at:
     intro -> desk -> zoomIn -> computer -> zoomOut -> desk
   On phones and narrow windows (under 900px) there is no desk; the computer
   fills the screen. Leaving the computer (Esc, a click outside its screen)
   keeps it unlocked with the same app open; Lock in the system menu locks
   it. Esc closes, in order: a name tip, the top layer, then the computer. */
import { $, bus } from "./core/dom.js";
import * as layer from "./core/layer.js";
import * as stage from "./scene/stage.js";
import * as desk from "./scene/desk.js";

export const S = { layout: "desk", mode: "boot", busy: false };
let os = null, deskApi = null, gen = 0;   // gen changes when the layout switches; a zoom in progress then stops
const html = document.documentElement;
const setMode = m => { S.mode = m; html.dataset.mode = m; };
export const setLayout = (l, why = "") => { S.layout = l; html.dataset.layout = l; html.dataset.why = why; };

export function init(ctx) {
  os = ctx.os;
  document.addEventListener("keydown", onKey);
  bus.on("monitor", zoomIn);
  bus.on("leave", zoomOut);
  bus.on("lock", lock);
}
export const setDesk = api => { deskApi = api; };

export function startDesk() { setMode("desk"); }
export function startFull() { setMode("computer"); os.place(null); os.show(true); os.focus(); }

export async function zoomIn() {
  if (S.busy || S.mode !== "desk") return;
  S.busy = true;
  const g = gen;
  layer.closeAll();
  setMode("zoomIn");
  desk.screenOn();
  $("#viewport").inert = true;
  await stage.move(stage.cameraFor());
  if (g !== gen) return;
  os.place(stage.cameraFor().screen);
  setMode("computer");
  await os.show();
  if (g !== gen) return;
  S.busy = false;
  os.focus();
}

export async function zoomOut() {
  if (S.busy || S.mode !== "computer" || S.layout !== "desk") return;
  S.busy = true;
  const g = gen;
  layer.closeAll();
  setMode("zoomOut");
  await os.hide();
  if (g !== gen) return;
  $("#viewport").inert = false;
  await stage.move(null);
  if (g !== gen) return;
  setMode("desk");
  S.busy = false;
  if (deskApi) deskApi.focusMonitor();
}

function lock() {
  os.lock();
  if (S.layout === "desk" && S.mode === "computer") zoomOut(); else os.focus();
}

/* the window was resized: keep #os on the monitor's screen */
export function relayout() {
  if (S.layout === "desk" && S.mode === "computer") os.place(stage.cameraFor().screen);
}

/* the window crossed the 900px line: switch between desk and full-screen computer */
export async function switchLayout(narrow, ctx) {
  const g = ++gen;
  layer.closeAll();
  desk.hideTip();
  S.busy = false;
  if (narrow) {
    if (S.layout === "mobile") return;
    setLayout("mobile");
    $("#intro").hidden = true;
    $("#viewport").inert = true;
    startFull();
    return;
  }
  if (S.layout === "desk" || !(await ctx.ensureDesk()) || g !== gen) return;
  setLayout("desk");
  $("#viewport").hidden = false;
  desk.lightsOn();
  desk.screenOn();
  stage.layout();
  const c = stage.cameraFor();
  stage.set(c);
  os.place(c.screen);
  setMode("computer");
}

function onKey(e) {
  if (e.key !== "Escape" || e.defaultPrevented) return;
  if (S.busy) { e.preventDefault(); return; }
  if (desk.hideTip()) return;
  if (layer.depth()) { e.preventDefault(); layer.close(); return; }
  if (S.layout === "desk" && S.mode === "computer") { e.preventDefault(); zoomOut(); }
}
