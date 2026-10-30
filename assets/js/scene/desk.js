/* ---- Desk -----------------------------------------------------------------------------
   Builds the desk from scene.json: the photo (or drawn stand-ins until the
   art arrives), the monitor, the clickable objects and a few decorations.
   Objects that are always there are placed by their id in "objects";
   papers from a week folder (desk.json) go to the "spots" they name.
   An object is drawn one of three ways:
     image given          -> cut-out that lifts on hover
     photo but no image   -> hotspot: nothing drawn, a soft outline on hover
     no photo, no image   -> grey placeholder block that lifts on hover
   "mode": "cutout" or "hotspot" in scene.json forces one of the first two.
   This module also runs the one automatic effect (the lights coming up),
   the single blink of the standby light after 6 idle seconds, the
   reflection on the desk while the screen is on, and the sound switch.  */
import { $, el, icon, bus, wait, reducedMotion } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { SITE, resolve } from "../core/load.js";
import * as store from "../core/store.js";
import * as stage from "./stage.js";
import { objectName } from "../objects/open.js";
import { TYPES } from "../objects/list.js";
let vp = null, tip = null, tipTimer = 0, img = null;

const pos = (n, r) => (Object.assign(n.style, { left: r.x + "%", top: r.y + "%", width: r.w + "%", height: r.h + "%" }), n);

export function buildDesk(scene, ctx) {
  vp = $("#viewport");
  const photo = Array.isArray(scene.base?.srcset) && scene.base.srcset.length > 0;
  const camera = el("div.camera"), st = el("div.stage." + (photo ? "photo" : "placeholder"));
  st.dataset.light = scene.lightSide === "right" ? "right" : "left";
  camera.append(st);

  if (photo) {
    const s = [...scene.base.srcset].sort((a, b) => a.w - b.w);
    img = el("img.base", { src: resolve(s[s.length - 1].src, SITE), srcset: s.map(x => `${resolve(x.src, SITE)} ${x.w}w`).join(", "),
      sizes: "100vw", alt: t("scene.alt"), decoding: "async", draggable: "false" });
    st.append(img);
  } else st.append(el("div.room", { role: "img", "aria-label": t("scene.alt") }, el("div.wall"), el("div.window-light"), el("div.desk-top"), el("div.desk-light"), el("div.desk-edge")));

  /* on a photo, a decor image is a cut-out; on the drawn desk it sits inside its drawn shape (a picture frame) */
  for (const d of scene.decor || []) if (!photo || d.image)
    st.append(pos(photo ? el("img.decor", { src: resolve(d.image, SITE), alt: "" })
      : el("div.decor.ph-" + d.id, {}, d.image ? el("img.decor-art", { src: resolve(d.image, SITE), alt: "", draggable: "false" }) : null), d));

  const mon = scene.monitor;
  if (!photo) st.append(pos(el("div.monitor-face"), mon.face));
  const screen = pos(el("div.screen", {}, el("div.screen-wall"), el("div.screen-glow")), mon.screen);
  screen.style.borderRadius = `calc(var(--u) * ${mon.screen.radius || 0})`;
  st.append(screen);
  if (mon.led) st.append(el("div.led", { style: { left: mon.led.x + "%", top: mon.led.y + "%" } }));
  if (mon.reflection) st.append(pos(el("div.reflection"), mon.reflection));

  const monitor = pos(el("button.obj.obj-monitor", { type: "button", "aria-label": t("object.monitor") }), mon.face);
  monitor.addEventListener("click", () => { hideTip(); bus.emit("monitor"); });
  hookTip(monitor);
  st.append(monitor);

  const placed = new Map(scene.objects.map(o => [o.id, o])), spots = new Map(scene.spots.map(o => [o.id, o]));
  for (const id of placed.keys()) if (!TYPES[id] || TYPES[id].weekly) console.warn(`scene.json: unknown object "${id}" is left out`);
  /* a paper whose spot scene.json does not have goes to a free spot, so the desk and the phone list match */
  const used = new Set(ctx.desk.filter(d => d.item && spots.has(d.item.spot)).map(d => d.item.spot));
  for (const d of ctx.desk) {
    let o = d.item ? spots.get(d.item.spot) : placed.get(d.id);
    if (!o && d.item) {
      const free = scene.spots.find(s => !used.has(s.id));
      console.warn(`desk.json: "${d.id}" names spot "${d.item.spot}", which scene.json does not have` + (free ? `; using "${free.id}"` : ""));
      if (free) { used.add(free.id); o = free; }
    }
    if (!o) { if (!d.item) console.warn(`scene.json: no place for "${d.id}"`); continue; }
    const mode = o.mode === "cutout" || o.mode === "hotspot" ? o.mode : o.image ? "cutout" : photo ? "hotspot" : "placeholder";
    const b = pos(el("button.obj.obj-" + d.type + "." + mode, { type: "button", "aria-label": objectName(d),
      "aria-haspopup": "dialog", dataset: { id: d.id, shape: o.shape || "rect" } }), o);
    b.style.setProperty("--rot", (o.rotate || 0) + "deg");
    if (mode !== "hotspot") {
      if (o.shadow !== false) b.append(el("span.cast"));
      b.append(o.image ? el("img.art", { src: resolve(o.image, SITE), alt: "", draggable: "false" }) : art(d, ctx.world));
    }
    b.addEventListener("click", () => { hideTip(); ctx.openObject(d); });
    hookTip(b);
    st.append(b);
  }

  const sound = el("button.sound", { type: "button", "aria-label": t("desk.sound"), "aria-pressed": "false" });
  const paint = on => { sound.setAttribute("aria-pressed", String(on)); sound.replaceChildren(icon(on ? "volume-2" : "volume-x", 18)); };
  paint(store.get("sound", false, v => typeof v === "boolean"));
  sound.addEventListener("click", () => { const on = sound.getAttribute("aria-pressed") !== "true"; store.set("sound", on); paint(on); });

  tip = el("div.tip", { "aria-hidden": "true" });
  vp.replaceChildren(camera, el("div.lights"), sound, tip);
  stage.setup(scene, { viewport: vp, camera, stage: st }, () => { if (img) img.sizes = Math.round(st.offsetWidth) + "px"; hideTip(); ctx.relayout(); });
  return { focusMonitor: () => monitor.focus({ preventScroll: true }) };
}

/* the drawn stand-in for an object: a span styled by scene.css (.ph-<type>),
   with a few child spans for the parts that need their own shape or text.
   The desk calendar's page is printed with this week ("Week 2") or the
   break's name; the button's label already names the object, so the print
   is hidden from screen readers.                                       */
function art(d, world) {
  const parts = PARTS[d.type] || 0;
  const print = d.type === "calendar" && world ? el("span.ph-print", { "aria-hidden": "true",
    text: world.breakNow && world.breakNow.label ? world.breakNow.label : t("os.week", { n: world.weekNow }) }) : null;
  return el("span.art.ph.ph-" + d.type, {}, Array.from({ length: parts }, (_, i) => el("span.p" + (i + 1))), print);
}
const PARTS = { sticky: 4, badge: 4, phone: 3, notebook: 2, calendar: 4, coffee: 3, menu: 4, map: 4, suppliers: 4, newspaper: 4, memo: 4, flyer: 4 };

/* resolves once the desk photo is decoded (or straight away with placeholders) */
export function ready() {
  if (!img) return Promise.resolve();
  return (img.decode ? img.decode() : Promise.resolve()).catch(() => {});
}

export async function lightsUp() {
  vp.dataset.screen = "standby";
  vp.classList.add("lit");
  const led = $(".led", vp);
  let timer = 0, acted = false;
  const cancel = () => { acted = true; clearTimeout(timer); removeEventListener("pointerdown", cancel, true); removeEventListener("keydown", cancel, true); };
  addEventListener("pointerdown", cancel, true);
  addEventListener("keydown", cancel, true);
  await wait(reducedMotion() ? 0 : 1500);
  if (acted) return;
  timer = setTimeout(() => { cancel(); if (led && document.documentElement.dataset.mode === "desk") led.dataset.blink = "once"; }, 6000);
}

export const screenOn = () => { if (vp) vp.dataset.screen = "on"; };
export const lightsOn = () => { if (vp) vp.classList.add("lit", "instant"); };

function hookTip(b) {
  b.addEventListener("pointerenter", () => { clearTimeout(tipTimer); tipTimer = setTimeout(() => showTip(b), 300); });
  b.addEventListener("pointerleave", hideTip);
  b.addEventListener("focus", () => { if (b.matches(":focus-visible")) showTip(b); });
  b.addEventListener("blur", hideTip);
}
function showTip(b) {
  if (!b.isConnected || b.closest("[inert]")) return;
  const r = b.getBoundingClientRect(), below = r.top < 48;
  tip.textContent = b.getAttribute("aria-label");
  tip.classList.toggle("below", below);
  Object.assign(tip.style, { left: r.left + r.width / 2 + "px", top: (below ? r.bottom + 8 : r.top - 8) + "px" });
  tip.classList.add("on");
}
/* returns true if a tip was showing, so Esc can close it first */
export function hideTip() {
  clearTimeout(tipTimer);
  if (!tip || !tip.classList.contains("on")) return false;
  tip.classList.remove("on");
  return true;
}
