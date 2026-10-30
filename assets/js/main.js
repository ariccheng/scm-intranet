/* ---- Start-up ----------------------------------------------------------------------------
   Reads ui.json first (without it there is nothing to say), then the rest of
   content/. Phones and windows narrower than 900px go straight to the
   computer; wider screens get the intro and the desk. If scene.json cannot
   be read, the computer fills the window instead of the desk. If start-up
   fails altogether, the static message in index.html is shown.          */
import { $ } from "./core/dom.js";
import { CONTENT, getJSON } from "./core/load.js";
import { setStrings, setGlobals, t } from "./core/i18n.js";
import * as store from "./core/store.js";
import * as time from "./core/simtime.js";
import { safeAccent } from "./core/color.js";
import { loadWorld } from "./core/world.js";
import * as flow from "./flow.js";
import * as desk from "./scene/desk.js";
import { runIntro } from "./scene/intro.js";
import { createOS } from "./os/shell.js";
import { openObject } from "./objects/open.js";
import { deskList } from "./objects/list.js";

const html = document.documentElement;
const narrow = matchMedia("(max-width: 899.98px)");

function fail(detail) {
  $("#boot-detail").textContent = detail || "";
  html.classList.add("boot-failed");
}

let deskApi = null;
async function ensureDesk(ctx) {
  if (deskApi) return true;
  const r = await getJSON(new URL("scene.json", CONTENT));
  const s = r.ok ? r.value : null;
  const rect = v => v && ["x", "y", "w", "h"].every(k => Number.isFinite(v[k]));
  if (!s || !(s.stage?.width > 0) || !(s.stage?.height > 0) || !rect(s.monitor?.face) || !rect(s.monitor?.screen) || !Array.isArray(s.objects)) {
    console.error(r.ok ? "scene.json needs stage width/height, monitor.face, monitor.screen (x, y, w, h) and objects" : r.error);
    return false;
  }
  s.objects = s.objects.filter(o => { if (rect(o)) return true; console.error("scene.json: an object needs x, y, w and h", o); return false; });
  s.spots = Array.isArray(s.spots) ? s.spots.filter(o => { if (rect(o) && o.id) return true; console.error("scene.json: a spot needs id, x, y, w and h", o); return false; }) : [];
  s.decor = Array.isArray(s.decor) ? s.decor.filter(rect) : [];
  $("#viewport").hidden = false;
  try { deskApi = desk.buildDesk(s, ctx); }
  catch (e) { console.error(e); $("#viewport").hidden = true; return false; }
  flow.setDesk(deskApi);
  return true;
}

async function boot() {
  const ui = await getJSON(new URL("ui.json", CONTENT));
  if (!ui.ok) return fail(ui.error);
  setStrings(ui.value);
  time.setLocale(ui.value._locale);
  html.lang = ui.value._lang || "en";

  const world = await loadWorld();
  [...world.errors, ...world.news.errors, ...world.desk.errors].forEach(e => console.error(e));
  const co = world.company;
  setGlobals({ company: co.name || t("fallback.company"), week: world.weekNow, name: store.get("name", "", store.isStr) || t("fallback.name") });
  document.title = t("meta.title");
  const accent = safeAccent(co.accentColor);
  if (accent) html.style.setProperty("--accent", accent);
  if (co.wallpaper) html.style.setProperty("--wallpaper", `url("${co.wallpaper}")`);
  if (co.logo) $("link[rel=icon]").href = co.logo;

  const ctx = { world, desk: deskList(world), openObject: o => openObject(o, ctx), relayout: () => flow.relayout(), ensureDesk: () => ensureDesk(ctx) };
  ctx.os = createOS(ctx);
  flow.init(ctx);
  narrow.addEventListener("change", e => flow.switchLayout(e.matches, ctx));

  if (narrow.matches || !(await ensureDesk(ctx))) {
    flow.setLayout("mobile", narrow.matches ? "" : "no-scene");
    html.classList.add("booted");
    flow.startFull();
    return;
  }
  flow.setLayout("desk");
  html.classList.add("booted");
  await runIntro(desk.ready());
  if (flow.S.layout !== "desk") return;
  flow.startDesk();
  await desk.lightsUp();
}

boot().catch(e => { console.error(e); fail(e.message); });
