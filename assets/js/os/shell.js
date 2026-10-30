/* ---- Computer -------------------------------------------------------------------------------
   The company desktop inside the monitor: lock screen, top bar (logo, week,
   the date and time at the company, system menu), the app dock (a tab bar on
   phones), one app window, notifications, and the system menu with Lock,
   Credits and Reset this computer. On wide screens #os sits on the
   monitor's screen (place()); on phones it fills the window.

   It also hands apps what they share through ctx: openApp, openExternal,
   toast, person(id), botUrl(id), quota(id) and the unread count.                    */
import { $, el, icon, bus, wait, reducedMotion } from "../core/dom.js";
import { t, setGlobals, getGlobal } from "../core/i18n.js";
import * as store from "../core/store.js";
import * as time from "../core/simtime.js";
import * as layer from "../core/layer.js";
import { initials } from "../core/color.js";
import { APPS, EXTRA } from "../apps/registry.js";
import { renderLock } from "./lock.js";
import { createWindows } from "./windows.js";
import { toast } from "./notify.js";
import { confirmDialog, openExternal } from "./dialog.js";

const html = document.documentElement;
const phone = () => html.dataset.layout === "mobile";

export function createOS(ctx) {
  const { world } = ctx, co = world.company;
  const root = $("#os");
  const logo = cls => (co.logo ? el("img." + cls, { src: co.logo, alt: getGlobal("company") })
    : el("span." + cls + ".wordmark", { "aria-hidden": "true", text: initials(getGlobal("company")) }));

  const banner = el("p.os-banner", { role: "note" });
  const lockEl = el("section.os-lock", { "aria-label": t("lock.label") });
  const top = el("header.os-top");
  const main = el("div.os-main");
  const dock = el("nav.os-dock", { "aria-label": t("os.apps") });
  const deskEl = el("section.os-desk", { "aria-label": t("os.desktop") }, top, main, dock);
  const toasts = el("div.os-toasts");
  root.replaceChildren(el("div.os-frame", {}, banner, lockEl, deskEl, toasts));
  const exit = el("button.desk-exit", { type: "button", "aria-label": t("desk.leave"), title: t("desk.leave") });
  exit.addEventListener("click", () => bus.emit("leave"));
  root.after(exit);

  const win = createWindows(main, ctx);
  let unlocked = false, greeted = false, lock = null;

  /* top bar */
  const week = el("span.os-week", { text: world.breakNow && world.breakNow.label ? world.breakNow.label : t("os.week", { n: world.weekNow }) });
  const date = el("span.os-date"), clock = el("span.os-clock");
  const who = el("span.os-who");
  const menuBtn = el("button.os-menu-btn", { type: "button", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-labelledby": "menu-name os-who" },
    icon("circle-user", 18), el("span.sr-only", { id: "menu-name", text: t("menu.label") }), who);
  who.id = "os-who";
  top.append(el("div.os-brand", {}, logo("os-logo"), el("span.os-company", { text: getGlobal("company") })),
    el("div.os-status", {}, week, el("span.os-when", {}, date, clock), menuBtn));
  menuBtn.addEventListener("click", openMenu);
  const tick = () => { const now = time.now(); date.textContent = time.fmtDate(now); clock.textContent = time.fmtTime(now); if (lock) lock.tick(); };
  setInterval(tick, 10000);

  /* dock; the Desk tab only shows in the phone layout */
  const buttons = {};
  for (const app of [...APPS, EXTRA.find(a => a.id === "desk")]) {
    const b = el("button.dock-btn" + (app.id === "desk" ? ".phone-only" : ""), { type: "button", dataset: { app: app.id } },
      el("span.dock-icon", {}, icon(app.icon, 22)), el("span.dock-label", { text: t("app." + app.id) }),
      app.id === "mail" ? el("span.badge", { "aria-hidden": "true", hidden: true }) : null);
    b.addEventListener("click", () => win.open(app.id));
    buttons[app.id] = b;
    dock.append(b);
  }
  const readMap = () => store.get("mailRead", {}, store.isObj);
  const unread = () => { const r = readMap(); return world.mail.items.filter(m => !r[m.id]).length; };
  function badge() {
    const n = unread(), b = buttons.mail, s = b.querySelector(".badge");
    s.textContent = n > 99 ? "99+" : String(n);
    s.hidden = !n;
    b.setAttribute("aria-label", n ? t("dock.mailUnread", { count: n }) : t("app.mail"));
  }
  badge();
  bus.on("mail:read", badge);
  bus.on("app", id => { for (const [k, b] of Object.entries(buttons)) if (k === id) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  bus.on("app:closed", id => (buttons[id] || buttons.mail).focus({ preventScroll: true }));

  /* system menu */
  function openMenu() {
    const item = (name, key, fn) => {
      const b = el("button.menu-item", { type: "button" }, icon(name, 16), el("span", { text: t(key) }));
      b.addEventListener("click", () => { h.close(); fn(); });
      return b;
    };
    const panel = el("div.os-menu", {}, el("p.menu-who", { text: t("menu.signedInAs", { name: getGlobal("name") }) }),
      item("lock", "menu.lock", () => bus.emit("lock")), item("info", "menu.credits", () => win.open("credits")),
      item("rotate-ccw", "menu.reset", reset));
    const h = layer.open({ host: root, panel, label: t("menu.label"), className: "menu-layer", dim: false,
      onClose: () => menuBtn.setAttribute("aria-expanded", "false") });
    menuBtn.setAttribute("aria-expanded", "true");
  }
  async function reset() {
    if (await confirmDialog({ title: t("reset.title"), text: t("reset.text"), ok: t("reset.ok"), danger: true })) {
      store.clearAll();
      location.reload();
    }
  }

  /* lock screen and sign-in */
  const show = () => { root.dataset.screen = unlocked ? "desktop" : "lock"; };
  const drawLock = () => { lock = renderLock(lockEl, logo("lock-logo"), signIn); };
  function signIn(name) {
    setGlobals({ name });
    who.textContent = name;
    unlocked = true;
    show();
    if (phone() && !win.current()) win.open("mail");
    else if (win.current()) win.focus();
    else buttons.mail.focus({ preventScroll: true });
    if (!greeted) { greeted = true; setTimeout(loginNote, 1000); }
  }
  function loginNote() {
    const n = world.loginNotification;
    if (!n || !unlocked || (n.emailId && readMap()[n.emailId])) return;
    const mail = world.mail.items.find(m => m.id === n.emailId);
    ctx.toast({ title: n.text || t("notify.newMail"), text: mail ? mail.subject.replace(/\{(\w+)\}/g, (m, k) => getGlobal(k) ?? m) : "",
      iconName: "mail", onOpen: () => win.open("mail", n.emailId) });
  }
  drawLock();

  Object.assign(ctx, {
    openApp: (id, arg) => win.open(id, arg),
    openExternal,
    toast: o => toast(toasts, { ...o, refocus: () => (win.current() ? win.focus() : buttons.mail.focus({ preventScroll: true })) }),
    person: id => world.people.byId.get(id),
    botUrl: id => world.unlocks.byPerson.get(id),
    quota: id => world.unlocks.quota.get(id) ?? null,
    unread
  });

  return {
    place(r) {
      root.classList.toggle("placed", !!r);
      if (!r) { root.removeAttribute("style"); return; }
      Object.assign(root.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px", borderRadius: r.r + "px",
        transform: r.matrix || "", transformOrigin: r.matrix ? "0 0" : "" });
    },
    async show(instant) {
      banner.textContent = t(html.dataset.why === "no-scene" ? "error.scene" : "mobile.banner");
      root.hidden = false;
      show();
      tick();
      if (instant || reducedMotion()) { root.classList.add("on"); return; }
      void root.offsetWidth;
      root.classList.add("on");
      await wait(160);
    },
    async hide() {
      root.classList.remove("on");
      await wait(reducedMotion() ? 0 : 120);
      if (!root.classList.contains("on")) root.hidden = true;
    },
    lock() {
      unlocked = false;
      layer.closeAll();
      win.close(true);
      drawLock();
      show();
    },
    focus() {
      if (!unlocked) lock.focus();
      else if (win.current()) win.focus();
      else buttons.mail.focus({ preventScroll: true });
    }
  };
}
