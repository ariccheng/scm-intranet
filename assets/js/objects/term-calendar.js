/* ---- Desk calendar --------------------------------------------------------------------------------
   The whole semester on one page: one square per class week (company.json
   classDays), each with its class date, and a square for each break with
   no class (company.json breaks) between the weeks around it. Weeks that
   are open on the site are filled in; the current week (or the break, while
   it lasts) is outlined. It follows weeks/index.json, so it updates itself
   each week.                                                          */
import { el } from "../core/dom.js";
import { t } from "../core/i18n.js";
import * as time from "../core/simtime.js";

const DAY = 864e5;

/* the class date of week n: its classDays entry, or the Thursday of that week */
export function classDay(world, n) {
  const d = time.parse(Array.isArray(world.company.classDays) ? world.company.classDays[n - 1] : "");
  return isNaN(d) ? time.weekStart(n) + 3 * DAY : d;
}
/* [{n} or {brk}] in calendar order: each break after the week it follows */
export function termRows(world) {
  const term = Math.max(time.weekCount(), world.weekNow), breaks = time.breakWeeks(), rows = [];
  for (const b of breaks) if (b.after < 1) rows.push({ brk: b });
  for (let n = 1; n <= term; n++) { rows.push({ n }); for (const b of breaks) if (b.after === n) rows.push({ brk: b }); }
  return rows;
}
/* a break's date: the same weekday as the classes in the weeks around it */
export const breakDay = (world, b) => b.start + time.dayIndex(classDay(world, 1)) * DAY;

export function render(panel, ctx) {
  const { world } = ctx, brk = world.breakNow, cur = brk ? 0 : world.weekNow, open = new Set(world.weeks.map(w => w.n));
  const square = r => {
    if (r.brk) {
      const now = !!brk && brk.start === r.brk.start;
      return el("li.tcal-wk.break" + (now ? ".current" : ""), { "aria-current": now ? "true" : null },
        el("strong", { text: r.brk.label || t("tcal.break") }), el("span", { text: time.fmtDay(breakDay(world, r.brk)) }),
        el("span.sr-only", { text: now ? `${t("tcal.noClass")}, ${t("tcal.current")}` : t("tcal.noClass") }));
    }
    const n = r.n, state = n === cur ? t("tcal.current") : open.has(n) ? t("tcal.open") : "";
    return el("li.tcal-wk" + (open.has(n) ? ".open" : "") + (n === cur ? ".current" : ""), { "aria-current": n === cur ? "true" : null },
      el("strong", { text: t("tcal.week", { n }) }), el("span", { text: time.fmtDay(classDay(world, n)) }), state ? el("span.sr-only", { text: state }) : null);
  };
  const key = (k, label) => el("span.tcal-item", {}, el("span.key." + k, { "aria-hidden": "true" }), el("span", { text: t(label) }));
  panel.append(el("div.tcal", {}, el("h2.tcal-title", { text: t("tcal.title") }),
    el("ol.tcal-grid", {}, termRows(world).map(square)),
    el("p.tcal-legend", {}, key("open", "tcal.legendOpen"), key("current", "tcal.legendNow"), time.breakWeeks().length ? key("break", "tcal.legendBreak") : null)));
}
