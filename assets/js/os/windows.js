/* ---- Window ---------------------------------------------------------------------------
   One app window at a time. Opening an app replaces the window; opening the
   same app again passes the argument on (for example, which email to show).
   The window can be maximized and closed; on phones it always fills the
   screen. An app that fails to load shows an error in its own window.    */
import { el, icon, bus, stateBox } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { findApp } from "../apps/registry.js";

export function createWindows(main, ctx) {
  let cur = null;

  async function open(id, arg) {
    const app = findApp(id);
    if (!app) return;
    if (cur && cur.id === id) {
      if (arg != null) { if (cur.inst) cur.inst.open?.(arg); else cur.arg = arg; }   // still loading: open it once mounted
      cur.title.focus({ preventScroll: true });
      return;
    }
    close(true);
    const title = el("h2.win-title", { tabindex: "-1", id: "win-title" }, icon(app.icon, 16), el("span", { text: t("app." + id) }));
    const max = el("button.icon-btn.win-max", { type: "button", "aria-label": t("window.maximize"), "aria-pressed": "false" }, icon("maximize-2", 16));
    const x = el("button.icon-btn.win-close", { type: "button", "aria-label": t("window.close") }, icon("x", 16));
    const body = el("div.win-body");
    const win = el("section.window.app-" + id, { "aria-labelledby": "win-title" }, el("header.win-bar", {}, title, el("div.win-ctl", {}, max, x)), body);
    max.addEventListener("click", () => {
      const on = win.classList.toggle("max");
      max.setAttribute("aria-pressed", String(on));
      max.replaceChildren(icon(on ? "minimize-2" : "maximize-2", 16));
      max.setAttribute("aria-label", t(on ? "window.restore" : "window.maximize"));
    });
    x.addEventListener("click", () => close());
    main.replaceChildren(win);
    cur = { id, win, title, inst: null, arg };
    bus.emit("app", id);
    title.focus({ preventScroll: true });
    try {
      const mod = await app.load();
      if (!cur || cur.win !== win) return;
      cur.inst = mod.mount(body, ctx) || {};
      if (cur.arg != null && cur.inst.open) cur.inst.open(cur.arg);
    } catch (e) {
      console.error(e);
      if (cur && cur.win === win) body.replaceChildren(stateBox({ name: "info", kind: "error", title: t("error.appTitle"), text: t("error.app") }));
    }
  }

  function close(quiet) {
    if (!cur) return;
    try { cur.inst?.destroy?.(); } catch (e) { console.error(e); }
    const id = cur.id, hadFocus = cur.win.contains(document.activeElement);
    main.replaceChildren();
    cur = null;
    if (!quiet) bus.emit("app", null);
    if (hadFocus && !quiet) bus.emit("app:closed", id);
  }

  return { open, close, current: () => cur && cur.id, focus: () => cur && cur.title.focus({ preventScroll: true }) };
}
