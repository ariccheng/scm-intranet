/* ---- Notebook ---------------------------------------------------------------------------------
   Opens to a lined page the student can type on. Notes are saved in this
   browser as they type (and once more when the page is left). The footer
   reminds them that team records belong in the communication log.     */
import { el } from "../core/dom.js";
import { t } from "../core/i18n.js";
import * as store from "../core/store.js";

const MAX = 20000;

export function render(panel) {
  const area = el("textarea.notebook-text", { id: "notebook-text", maxlength: String(MAX), spellcheck: "true", placeholder: t("notebook.placeholder") });
  area.value = store.get("notebook", "", store.isStr);
  const status = el("p.notebook-status", { "aria-live": "polite" });
  let timer = 0;
  const save = () => { clearTimeout(timer); store.set("notebook", area.value.slice(0, MAX)); status.textContent = t(store.persistent() ? "notebook.saved" : "notebook.notSaved"); };
  area.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(save, 400); });
  addEventListener("pagehide", save);
  panel.append(el("div.notebook", {}, el("label.notebook-label", { for: "notebook-text", text: t("notebook.label") }), area,
    el("div.notebook-foot", {}, el("p", { text: t("notebook.footer") }), status)));
  return { initial: () => area, onClose: () => { save(); removeEventListener("pagehide", save); } };
}
