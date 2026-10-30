/* ---- Notifications ------------------------------------------------------------------------
   Cards slide in at the top right and leave after 6 seconds; the timer
   pauses while the pointer or keyboard focus is on them. Clicking a card
   runs its action (for example, opening the email it announces).       */
import { el, icon, wait, reducedMotion } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { announce } from "../core/layer.js";

export function toast(host, { title, text, iconName = "bell", onOpen, refocus }) {
  const card = el("button.toast", { type: "button" }, el("span.toast-icon", {}, icon(iconName, 18)),
    el("span.toast-text", {}, el("strong", { text: title }), text ? el("span", { text }) : null));
  const dismiss = el("button.icon-btn.toast-x", { type: "button", "aria-label": t("notify.dismiss") }, icon("x", 14));
  const item = el("div.toast-item", {}, card, dismiss);
  host.append(item);
  announce(title + (text ? ". " + text : ""));
  requestAnimationFrame(() => item.classList.add("in"));

  let left = 6000, started = performance.now(), timer = setTimeout(leave, left), gone = false;
  const pause = () => { clearTimeout(timer); left -= performance.now() - started; };
  const resume = () => { started = performance.now(); clearTimeout(timer); timer = setTimeout(leave, Math.max(left, 1500)); };
  item.addEventListener("pointerenter", pause);
  item.addEventListener("pointerleave", resume);
  item.addEventListener("focusin", pause);
  item.addEventListener("focusout", resume);
  card.addEventListener("click", () => { leave(); if (onOpen) onOpen(); });
  dismiss.addEventListener("click", leave);

  async function leave() {
    if (gone) return;
    gone = true;
    clearTimeout(timer);
    if (item.contains(document.activeElement) && refocus) refocus();
    item.classList.remove("in");
    await wait(reducedMotion() ? 0 : 240);
    item.remove();
  }
  return { leave };
}
