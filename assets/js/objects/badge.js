/* ---- ID badge --------------------------------------------------------------------------------
   The front shows the company and the word Employee; Flip turns it over to
   the student's name, role (company.json newHireTitle) and start date
   (the first day of week 1).                                          */
import { el, icon } from "../core/dom.js";
import { t, getGlobal } from "../core/i18n.js";
import * as store from "../core/store.js";
import * as time from "../core/simtime.js";
import { initials } from "../core/color.js";

export function render(panel, ctx) {
  const co = ctx.world.company, name = store.get("name", "", store.isStr);
  const logo = co.logo ? el("img.badge-logo", { src: co.logo, alt: "" }) : el("span.badge-logo.wordmark", { text: initials(getGlobal("company")) });
  const row = (k, v) => el("div.badge-row", {}, el("dt", { text: t(k) }), el("dd", { text: v }));
  const card = el("div.badge-card", {},
    el("div.badge-face.badge-front", {}, el("div.badge-clip", { "aria-hidden": "true" }), logo, el("p.badge-co", { text: getGlobal("company") }),
      el("span.badge-photo", { "aria-hidden": "true", text: name ? initials(name) : "" }), el("p.badge-emp", { text: t("badge.employee") })),
    el("div.badge-face.badge-back", {}, el("dl", {},
      row("badge.name", name || t("badge.noName")), row("badge.role", co.newHireTitle || ""), row("badge.start", time.fmtLong(time.weekStart(1))))));
  const flip = el("button.btn.badge-flip", { type: "button", "aria-pressed": "false" }, icon("rotate-ccw", 16), el("span", { text: t("badge.flip") }));
  flip.addEventListener("click", () => {
    const on = card.classList.toggle("flipped");
    flip.setAttribute("aria-pressed", String(on));
  });
  card.addEventListener("click", () => flip.click());
  setTimeout(() => { if (card.isConnected && !card.classList.contains("flipped")) flip.click(); }, 350);   // show the details, front first
  panel.append(el("div.badge-stage", {}, card), flip);
  return { initial: () => flip };
}
