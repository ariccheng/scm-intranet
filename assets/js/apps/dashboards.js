/* ---- Dashboards --------------------------------------------------------------------------------
   Each dashboard is a CSV file listed in a week's dashboards/index.json:
   {"id", "title", "file", "description"}. It is shown as a table that can
   be sorted by any column, with a link to download the file. Until the
   first dashboard opens, the app explains that more will come.        */
import { el, icon, stateBox } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { getText } from "../core/load.js";
import { parseCSV, num } from "../core/csv.js";
import { partError, chips } from "./common.js";

export function mount(body, ctx) {
  const { world } = ctx, boards = world.dashboards.items;
  if (!boards.length) {
    body.replaceChildren(el("div.dashboards", {}, partError(world.dashboards.errors),
      stateBox({ name: "layout-dashboard", title: t("dashboards.emptyTitle"), text: t("dashboards.emptyText") })));
    return;
  }
  const panel = el("div.dash-panel");
  let cur = boards[boards.length - 1].id, token = 0;

  async function show(id) {
    const d = boards.find(b => b.id === id), mine = ++token;
    panel.replaceChildren(el("p.muted", { text: "…" }));
    const r = await getText(d.file);
    if (mine !== token) return;
    if (!r.ok) { panel.replaceChildren(stateBox({ name: "table-2", kind: "error", title: d.title, text: t("dashboards.loadError"), details: [r.error] })); return; }
    const { header, rows, numeric } = parseCSV(r.value);
    let sortCol = -1, dir = 1;
    const tbody = el("tbody");
    const heads = header.map((h, j) => {
      const b = el("button.sort", { type: "button", "aria-label": t("dashboards.sortBy", { col: h }) }, el("span", { text: h }), el("span.sort-mark", { "aria-hidden": "true" }));
      b.addEventListener("click", () => { dir = sortCol === j ? -dir : 1; sortCol = j; fill(); });
      return el("th", { scope: "col", class: numeric[j] ? "num" : null }, b);
    });
    function fill() {
      const list = [...rows];
      if (sortCol >= 0) list.sort((a, b) => dir * (numeric[sortCol] ? (num(a[sortCol]) || 0) - (num(b[sortCol]) || 0)
        : String(a[sortCol] ?? "").localeCompare(String(b[sortCol] ?? ""), undefined, { numeric: true })));
      heads.forEach((th, j) => {
        th.setAttribute("aria-sort", j === sortCol ? (dir > 0 ? "ascending" : "descending") : "none");
        th.querySelector(".sort-mark").replaceChildren(j === sortCol ? icon(dir > 0 ? "chevron-up" : "chevron-down", 14) : "");
      });
      tbody.replaceChildren(...list.map(r => el("tr", {}, header.map((_, j) => el("td", { class: numeric[j] ? "num" : null, text: r[j] ?? "" })))));
    }
    fill();
    panel.replaceChildren(el("div.dash-head", {}, el("div", {}, el("h3", { text: d.title }), d.description ? el("p.muted", { text: d.description }) : null,
      el("p.muted", { text: t("dashboards.rows", { count: rows.length }) })),
      el("a.btn", { href: d.file, download: "" }, icon("download", 16), el("span", { text: t("dashboards.download") }))),
      el("div.table-wrap", { tabindex: "0", role: "region", "aria-label": d.title }, el("table.dash-table", {}, el("thead", {}, el("tr", {}, heads)), tbody)));
  }

  body.replaceChildren(el("div.dashboards", {}, partError(world.dashboards.errors),
    boards.length > 1 ? chips(boards.map(b => [b.id, b.title]), cur, v => { cur = v; show(v); }, t("dashboards.list")) : null, panel));
  show(cur);
}
