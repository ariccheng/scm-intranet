/* ---- Desk objects -----------------------------------------------------------------------
   Opens one object as a close-up over the desk (or over the phone layout's
   Desk tab). Each object module exports render(panel, ctx, item) and may
   return {initial} to choose what gets focus first; item is the desk.json
   entry for papers from a week folder. Modules load on first use, so one
   broken object cannot stop the rest of the site.                       */
import { el, icon } from "../core/dom.js";
import { t, has } from "../core/i18n.js";
import * as layer from "../core/layer.js";
import { TYPES } from "./list.js";

let pending = false;
const html = document.documentElement;
const where = () => html.dataset.layout + "/" + html.dataset.mode;
/* "Memo: <subject>" or "Flyer: <headline>" for papers from a week folder, unless desk.json gives a label */
export function objectName(o) {
  if (!o.item) return has("object." + o.id) ? t("object." + o.id) : t("object." + o.type);
  if (o.item.label) return String(o.item.label);
  const what = o.item.subject || o.item.headline;
  return what ? `${t("object." + o.type)}: ${String(what)}` : t("object." + o.type);
}

export async function openObject(o, ctx) {
  if (!o || !TYPES[o.type] || pending || layer.depth()) return;
  pending = true;
  const from = where(), panel = el("div.obj-panel.panel-" + o.type);
  let r = {};
  try { r = (await import(`./${TYPES[o.type].file}.js`)).render(panel, ctx, o.item) || {}; }
  catch (e) { console.error(e); panel.append(el("p.obj-error", { text: t("error.object") })); }
  finally { pending = false; }
  if (where() !== from) return;   // the student moved on (zoomed in, switched layout) while the module loaded
  const close = el("button.icon-btn.obj-close", { type: "button", "aria-label": t("common.close") }, icon("x", 18));
  panel.append(close);
  const h = layer.open({ panel, label: objectName(o), className: "obj-layer obj-layer-" + o.type, initial: r.initial, onClose: r.onClose });
  close.addEventListener("click", () => h.close());
}
