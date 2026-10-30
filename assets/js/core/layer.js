/* ---- Layer stack -----------------------------------------------------------------
   Desk-object close-ups, dialogs and the system menu open on one stack. While
   a layer is open everything outside it is inert, so Tab stays inside. Esc or
   a click on the dimmed backdrop closes the top layer and focus returns to
   the control that opened it. A layer can live in #layer-root (over the desk)
   or inside #os, so the computer's dialogs stay on the computer's screen.  */
import { $, el, FOCUSABLE } from "./dom.js";

const stack = [];

export function open({ host = $("#layer-root"), panel, label, className = "", initial, onClose, dim = true }) {
  const back = el("div.layer-back" + (dim ? "" : ".clear"));
  const wrap = el("div.layer" + (className ? "." + className.split(" ").join(".") : ""),
    { role: "dialog", "aria-modal": "true", "aria-label": label }, back, panel);
  host.append(wrap);
  const entry = { wrap, prev: document.activeElement, inerted: [], onClose };
  for (let n = wrap; n.parentElement && n !== document.body; n = n.parentElement)
    for (const s of n.parentElement.children)
      if (s !== n && !s.inert && s.id !== "live" && s.tagName !== "SCRIPT") { s.inert = true; entry.inerted.push(s); }
  stack.push(entry);
  back.addEventListener("click", () => close(entry));
  requestAnimationFrame(() => {
    wrap.classList.add("in");
    const f = (initial && initial()) || panel.querySelector("[data-autofocus]") || panel.querySelector(FOCUSABLE) || panel;
    if (f === panel && !panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
    f.focus({ preventScroll: true });
  });
  return { el: wrap, close: () => close(entry) };
}

export function close(entry = stack[stack.length - 1]) {
  const i = stack.indexOf(entry);
  if (i < 0) return false;
  while (stack.length > i) {
    const e = stack.pop();
    e.inerted.forEach(n => { n.inert = false; });
    e.wrap.remove();
    try { e.onClose && e.onClose(); } catch (err) { console.error(err); }
    if (e.prev && e.prev.isConnected && !e.prev.closest("[inert]")) e.prev.focus({ preventScroll: true });
  }
  return true;
}

export const depth = () => stack.length;
export const closeAll = () => { while (stack.length) close(); };

/* screen-reader announcement through the polite live region */
export function announce(text) {
  const live = $("#live");
  live.textContent = "";
  setTimeout(() => { live.textContent = text; }, 50);
}
