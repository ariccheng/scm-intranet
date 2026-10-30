/* ---- Intro --------------------------------------------------------------------------
   A black screen with one line ("Day 1 at {company}") and "Click anywhere to
   begin". The whole screen is one button, focused on load, so Enter or
   Space also start. The desk photo keeps loading meanwhile; after the click
   we wait for it at most 4 seconds so the desk does not appear in pieces. */
import { $, el, wait, reducedMotion } from "../core/dom.js";
import { t } from "../core/i18n.js";

export function runIntro(ready) {
  const root = $("#intro");
  const b = el("button.intro", { type: "button" }, el("span.intro-title", { text: t("intro.title") }), el("span.intro-hint", { text: t("intro.hint") }));
  root.replaceChildren(b);
  root.hidden = false;
  $("#viewport").inert = true;
  b.focus();
  return new Promise(done => b.addEventListener("click", async () => {
    b.classList.add("busy");
    await Promise.race([ready, wait(4000)]);
    root.classList.add("out");
    await wait(reducedMotion() ? 0 : 300);
    root.hidden = true;
    $("#viewport").inert = false;
    done();
  }, { once: true }));
}
