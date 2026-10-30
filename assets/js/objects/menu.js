/* ---- Paper menu: this season's bowls and sauces -----------------------------------------------
   A printed take-away menu from company.json "menu": the season, the bowls
   and salads (items with "new": true get a small gold New tag) and the
   house sauces. It shows names only, never prices.                     */
import { el } from "../core/dom.js";
import { t, getGlobal } from "../core/i18n.js";
import { initials } from "../core/color.js";

export function render(panel, ctx) {
  const co = ctx.world.company, menu = co.menu || {};
  const items = (Array.isArray(menu.items) ? menu.items : []).filter(x => x && x.name);
  const sauces = (Array.isArray(menu.sauces) ? menu.sauces : []).filter(s => typeof s === "string" && s);
  const logo = co.logo ? el("img.fmenu-logo", { src: co.logo, alt: "" }) : el("span.fmenu-logo.wordmark", { "aria-hidden": "true", text: initials(getGlobal("company")) });
  panel.append(el("article.fmenu", {},
    el("header.fmenu-head", {}, logo, el("p.fmenu-co", { text: getGlobal("company") }),
      el("h2.fmenu-title", { text: t("foodmenu.title", { season: menu.season || "" }).trim() })),
    items.length ? el("section.fmenu-sec", { "aria-labelledby": "fmenu-bowls" }, el("h3", { id: "fmenu-bowls", text: t("foodmenu.bowls") }),
      el("ul.fmenu-list", {}, items.map(x => el("li", {}, el("span.fmenu-name", { text: x.name }),
        x.new ? el("span.tag-new", { text: t("foodmenu.new") }) : null)))) : el("p.fmenu-empty", { text: t("foodmenu.empty") }),
    sauces.length ? el("section.fmenu-sec", { "aria-labelledby": "fmenu-sauces" }, el("h3", { id: "fmenu-sauces", text: t("foodmenu.sauces") }),
      el("ul.fmenu-sauces", {}, sauces.map(s => el("li", { text: s })))) : null,
    el("p.fmenu-foot", { text: t("foodmenu.foot") })));
}
