/* ---- Desk (phone layout) -----------------------------------------------------------------------
   Phones have no desk scene, so this tab lists the desk objects; each one
   opens the same close-up as on a computer. Nothing here is lost on a
   phone: every object on the desk opens here too.          */
import { el, icon } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { TYPES } from "../objects/list.js";
import { objectName } from "../objects/open.js";

export function mount(body, ctx) {
  body.replaceChildren(el("div.desk-app", {}, el("p.muted", { text: t("desk.intro") }),
    el("ul.desk-grid", {}, ctx.desk.map(d => {
      const b = el("button.desk-item", { type: "button", "aria-haspopup": "dialog" }, el("span.desk-icon", {}, icon(TYPES[d.type].icon, 26)), el("span", { text: objectName(d) }));
      b.addEventListener("click", () => ctx.openObject(d));
      return el("li", {}, b);
    }))));
}
