/* ---- Paper menu: this season's bowls and sauces -----------------------------------------------
   A printed fold-out menu from company.json "menu": the season, what is new
   (items with "new": true, shown first as featured cards), the classic bowls
   and salads with what is in them and dietary marks ("tags": vegetarian,
   vegan, gf, spicy), the house sauces, how to order (company.json
   "channels"), and a footer with the key to the dietary marks and an
   allergen note. It never shows prices. On a wide screen the menu opens
   in two columns; on a phone it is one.                                */
import { el } from "../core/dom.js";
import { t, getGlobal } from "../core/i18n.js";
import { initials } from "../core/color.js";

const TAGS = ["vegetarian", "vegan", "gf", "spicy"];
const arr = v => (Array.isArray(v) ? v : []);
const str = v => (typeof v === "string" ? v.trim() : "");

/* the small dietary marks after a dish name; screen readers hear the full word */
const marks = tags => {
  const known = TAGS.filter(k => arr(tags).includes(k));
  return known.length ? el("span.fmenu-marks", {}, known.map(k => el("span", { title: t("foodmenu.tag." + k) },
    el("span.fmenu-mark.m-" + k, { "aria-hidden": "true", text: t("foodmenu.tagShort." + k) }), el("span.sr-only", { text: t("foodmenu.tag." + k) })))) : null;
};
const dish = (x, featured) => el("li.fmenu-dish" + (featured ? ".featured" : ""), {},
  el("p.fmenu-name", {}, el("span", { text: str(x.name) }), marks(x.tags)),
  str(x.description) ? el("p.fmenu-desc", { text: str(x.description) }) : null);

export function render(panel, ctx) {
  const co = ctx.world.company, menu = co.menu || {};
  const items = arr(menu.items).filter(x => x && str(x.name));
  const fresh = items.filter(x => x.new), classics = items.filter(x => !x.new);
  const sauces = arr(menu.sauces).map(s => (typeof s === "string" ? { name: s } : s)).filter(s => s && str(s.name));
  /* bottled sauces are not a way to order a bowl, so they go under the sauces */
  const channels = arr(co.channels).filter(c => c && str(c.name) && c.id !== "sauces"), bottled = arr(co.channels).find(c => c && c.id === "sauces");
  const stores = arr(co.stores).length, used = new Set(items.flatMap(x => arr(x.tags)));
  const logo = co.logo ? el("img.fmenu-logo", { src: co.logo, alt: "" }) : el("span.fmenu-logo.wordmark", { "aria-hidden": "true", text: initials(getGlobal("company")) });
  const sec = (id, title, ...kids) => el("section.fmenu-sec", { "aria-labelledby": "fmenu-" + id }, el("h3", { id: "fmenu-" + id, text: title }), ...kids);

  const main = el("div.fmenu-main", {},
    fresh.length ? sec("new", t("foodmenu.newTitle"), el("p.fmenu-lead", { text: t("foodmenu.newLead") }), el("ul.fmenu-feature", {}, fresh.map(x => dish(x, true)))) : null,
    classics.length ? sec("bowls", t("foodmenu.bowls"), el("ul.fmenu-list", {}, classics.map(x => dish(x, false)))) : null,
    items.length ? null : el("p.fmenu-empty", { text: t("foodmenu.empty") }));
  const side = el("aside.fmenu-side", {},
    sauces.length ? sec("sauces", t("foodmenu.sauces"), el("ul.fmenu-sauces", {}, sauces.map(s => el("li", {},
      el("strong", { text: str(s.name) }), str(s.description) ? el("span", { text: str(s.description) }) : null))),
      bottled && str(bottled.text) ? el("p.fmenu-note", { text: t("foodmenu.bottled", { text: str(bottled.text) }) }) : null) : null,
    channels.length ? sec("order", t("foodmenu.order"), el("ul.fmenu-order", {}, channels.map(c => el("li", {},
      el("strong", { text: str(c.name) }), str(c.text) ? el("span", { text: str(c.text) }) : null)))) : null);
  const key = used.size ? el("ul.fmenu-key", { "aria-label": t("foodmenu.key") }, TAGS.filter(k => used.has(k)).map(k => el("li", {},
    el("span.fmenu-mark.m-" + k, { "aria-hidden": "true", text: t("foodmenu.tagShort." + k) }), el("span", { text: t("foodmenu.tag." + k) })))) : null;

  panel.append(el("article.fmenu", {},
    el("header.fmenu-head", {}, logo,
      el("div", {}, el("p.fmenu-co", { text: getGlobal("company") }), el("h2.fmenu-title", { text: str(menu.season) ? t("foodmenu.title", { season: str(menu.season) }) : t("foodmenu.titlePlain") })),
      stores ? el("p.fmenu-where", { text: t("foodmenu.where", { count: stores }) }) : null),
    el("div.fmenu-body", {}, main, side),
    el("footer.fmenu-foot", {}, key, el("p", { text: t("foodmenu.foot") }))));
}
