/* ---- Flyer: a customer promotion left on the desk -------------------------------------------------
   A printed handout from a week's desk.json entry: {headline, subhead,
   when, offer, details: [lines], fine, image}. "image" is a picture in the
   week folder (with "imageAlt" to describe it). Any field may be left out;
   the flyer prints whatever it has.                                    */
import { el } from "../core/dom.js";
import { t, getGlobal } from "../core/i18n.js";
import { resolve } from "../core/load.js";
import { initials } from "../core/color.js";

const str = v => (typeof v === "string" ? v.trim() : "");

export function render(panel, ctx, item) {
  const f = item || {}, co = ctx.world.company;
  const details = (Array.isArray(f.details) ? f.details : []).map(str).filter(Boolean);
  const src = str(f.image) && f.base ? resolve(f.image, f.base) : null;
  const img = src ? el("img.flyer-img", { src, alt: str(f.imageAlt) }) : null;
  if (img) img.addEventListener("error", () => img.remove(), { once: true });
  const logo = co.logo ? el("img.flyer-logo", { src: co.logo, alt: "" }) : el("span.flyer-logo.wordmark", { "aria-hidden": "true", text: initials(getGlobal("company")) });
  const empty = !str(f.headline) && !str(f.subhead) && !str(f.offer) && !details.length;
  panel.append(el("article.flyer", {},
    el("header.flyer-top", {}, str(f.when) ? el("p.flyer-when", { text: str(f.when) }) : null,
      el("h2.flyer-headline", { text: str(f.headline) || (empty ? t("flyer.empty") : getGlobal("company")) }),
      str(f.subhead) ? el("p.flyer-subhead", { text: str(f.subhead) }) : null),
    img,
    str(f.offer) ? el("p.flyer-offer", {}, el("span", { text: str(f.offer) })) : null,
    details.length ? el("ul.flyer-details", {}, details.map(d => el("li", { text: d }))) : null,
    el("footer.flyer-foot", {}, el("p.flyer-brand", {}, logo, el("span", { text: getGlobal("company") })),
      str(f.fine) ? el("p.flyer-fine", { text: str(f.fine) }) : null)));
}
