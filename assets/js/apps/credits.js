/* ---- Credits ----------------------------------------------------------------------------------
   Fonts, icons and (later) desk photos and icon packs used on this site,
   from content/credits.json: {"item", "author", "license", "url"}.      */
import { el, icon, stateBox } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { partError } from "./common.js";

export function mount(body, ctx) {
  const { world } = ctx;
  body.replaceChildren(el("div.credits", {}, partError(world.credits.errors), el("p", { text: t("credits.intro") }),
    world.credits.items.length ? el("ul.credit-list", {}, world.credits.items.map(c => {
      const link = c.url ? el("button.btn", { type: "button" }, icon("external-link", 15), el("span", { text: c.url.replace(/^https?:\/\//, "") })) : null;
      if (link) link.addEventListener("click", () => ctx.openExternal({ url: c.url, kind: "link" }));
      return el("li.credit", {}, el("strong", { text: c.item }), c.author ? el("span", { text: t("credits.by", { author: c.author }) }) : null,
        c.license ? el("span.muted", { text: t("credits.license", { license: c.license }) }) : null, link);
    })) : stateBox({ name: "info", text: "—" })));
}
