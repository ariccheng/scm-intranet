/* ---- Sticky note: this week's to-do list -----------------------------------------------------
   The newest week's to-dos (week.json "todos"). Ticks are kept in this
   browser under "week-01/<todo id>", so a later week starts fresh.     */
import { el } from "../core/dom.js";
import { t } from "../core/i18n.js";
import * as store from "../core/store.js";

export function render(panel, ctx) {
  const { todos } = ctx.world;
  const done = () => store.get("todos", {}, store.isObj);
  const progress = el("p.sticky-progress", { "aria-live": "polite" });
  const count = () => { const d = done(); progress.textContent = t("sticky.progress", { done: todos.items.filter(x => d[x.key]).length, total: todos.items.length }); };
  const boxes = todos.items.map((x, i) => {
    const box = el("input", { type: "checkbox", id: "todo-" + i });
    box.checked = !!done()[x.key];
    box.addEventListener("change", () => { const d = done(); if (box.checked) d[x.key] = true; else delete d[x.key]; store.set("todos", d); count(); });
    return el("li", {}, box, el("label", { for: "todo-" + i, text: x.text }));
  });
  panel.append(el("div.sticky", {}, el("h2.sticky-title", { text: t("sticky.title") }),
    boxes.length ? el("ul.todo", {}, boxes) : el("p", { text: todos.errors.length ? t("error.partTitle") : t("sticky.empty") }),
    boxes.length ? progress : null));
  if (boxes.length) count();
  return { initial: () => panel.querySelector("input") };
}
