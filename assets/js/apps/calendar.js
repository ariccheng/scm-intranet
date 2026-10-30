/* ---- Calendar --------------------------------------------------------------------------------
   Two views. Week: Monday to Friday of the current week (weekend days only
   when something is on them), with class times and deadlines; during a
   break it shows the break week under the break's name. Semester: all class
   weeks of the term (company.json classDays) with their class dates, the
   breaks between them, and what is scheduled in each open week; weeks not
   yet open are greyed out.                                            */
import { el, stateBox } from "../core/dom.js";
import { t } from "../core/i18n.js";
import * as time from "../core/simtime.js";
import { partError, chips } from "./common.js";
import { classDay, termRows, breakDay } from "../objects/term-calendar.js";

const DAY = 864e5;

export function mount(body, ctx) {
  const { world } = ctx, events = world.calendar.items;
  const brk = world.breakNow, cur = world.weekNow, open = new Set(world.weeks.map(w => w.n));
  const view = el("div.cal-view");
  let mode = "week";

  const when = e => (e.kind === "deadline" ? t("calendar.due", { time: time.fmtTime(e.start) })
    : time.fmtTime(e.start) + (e.end ? "–" + time.fmtTime(e.end) : ""));
  const card = e => el("li.cal-event", { dataset: { kind: e.kind || "event" } },
    el("span.cal-kind", { text: t("calendar.kind." + (["class", "deadline"].includes(e.kind) ? e.kind : "event")) }),
    el("strong", { text: e.title }), el("span.cal-when", { text: when(e) }), e.location ? el("span.muted", { text: e.location }) : null);

  function week() {
    const start = brk ? brk.start : time.weekStart(cur), today = Math.floor(time.now() / DAY) * DAY;
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => start + i * DAY)
      .filter((d, i) => i < 5 || events.some(e => e.start >= d && e.start < d + DAY));
    view.replaceChildren(el("h3.cal-head", { text: `${brk ? brk.label || t("calendar.break") : t("calendar.weekN", { n: cur })} · ${time.fmtDay(start)} – ${time.fmtDay(days[days.length - 1])}` }),
      el("ol.cal-week", { style: { "--days": days.length } }, days.map(d => {
        const evs = events.filter(e => e.start >= d && e.start < d + DAY);
        return el("li.cal-day" + (d === today ? ".today" : ""), { "aria-current": d === today ? "date" : null },
          el("h4.cal-date", {}, el("span", { text: time.fmt(d, { weekday: "short" }) }), el("span.muted", { text: time.fmtDay(d) })),
          evs.length ? el("ul.cal-events", {}, evs.map(card)) : el("p.muted.cal-free", { text: "—" }));
      })));
  }

  /* events in a break week are listed under the break, not under the week before it */
  const mini = evs => (evs.length ? el("ul.cal-mini", {}, evs.map(e => el("li", {},
    el("span.cal-dot", { dataset: { kind: e.kind || "event" }, "aria-hidden": "true" }), el("span", { text: `${time.fmt(e.start, { weekday: "short" })} · ${e.title}` })))) : null);
  function semester() {
    view.replaceChildren(el("ol.cal-term", {}, termRows(world).map(({ n, brk: b }) => {
      if (b) {
        const now = !!brk && brk.start === b.start;
        return el("li.cal-wk.cal-break" + (now ? ".current" : ""), { "aria-current": now ? "true" : null },
          el("div.cal-wk-head", {}, el("strong", { text: b.label || t("calendar.break") }), el("span.muted", { text: time.fmtDay(breakDay(world, b)) })),
          now ? el("span.cal-tag", { text: t("calendar.current") }) : null, el("span.muted.cal-closed", { text: t("calendar.noClass") }),
          mini(events.filter(e => time.breakAt(e.start)?.start === b.start)));
      }
      const here = n === cur && !brk;
      return el("li.cal-wk" + (open.has(n) ? ".open" : ".closed") + (here ? ".current" : ""), { "aria-current": here ? "true" : null },
        el("div.cal-wk-head", {}, el("strong", { text: t("calendar.weekN", { n }) }), el("span.muted", { text: time.fmtDay(classDay(world, n)) })),
        here ? el("span.cal-tag", { text: t("calendar.current") }) : null,
        !open.has(n) ? el("span.muted.cal-closed", { text: t("calendar.notOpen") }) : mini(events.filter(e => time.weekOf(e.start) === n && !time.breakAt(e.start))));
    })));
  }

  const draw = () => (mode === "week" ? week() : semester());
  body.replaceChildren(el("div.calendar", {}, partError(world.calendar.errors),
    el("div.cal-bar", {}, chips([["week", t("calendar.week")], ["term", t("calendar.term")]], mode, v => { mode = v; draw(); }, t("calendar.views"))),
    events.length || world.weeks.length ? view : stateBox({ name: "calendar-days", text: t("calendar.empty") })));
  draw();
}
