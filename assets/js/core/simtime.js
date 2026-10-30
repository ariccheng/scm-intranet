/* ---- Company time ---------------------------------------------------------------------
   The company runs on the real calendar, in its own time zone (company.json
   timeZone, America/Phoenix by default). Content writes times as
   "Mon 09:00" (in the week whose folder holds the file) or "W3 Fri 17:00"
   (a given week). Weeks follow the class meetings in company.json
   "classDays" (one date per class, e.g. every Thursday): week n is the
   Monday-to-Sunday week of the n-th class, so a break with no class
   (company.json "breaks") simply falls between two weeks.
   Every time is kept as the company's wall-clock time stored in UTC, so it
   is formatted with timeZone "UTC" and never shifts with the viewer's own
   time zone. ?today=2027-01-13 in the address pretends it is that day
   (same time of day), for previewing a week ahead of time.               */
const DAY = 864e5;
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
let mondays = [], breaks = [], locale = "en-US", zone = "America/Phoenix", shift = 0, parts = null;

/* "2027-01-11" -> ms; a day that does not exist (2027-02-30) is NaN, not rolled over */
const isoDay = s => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); if (!m) return NaN;
  const d = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return new Date(d).getUTCDate() === +m[3] && new Date(d).getUTCMonth() === +m[2] - 1 ? d : NaN;
};

const monday = ms => ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY;
/* classDays: ["2027-01-14", ...]; breakList: [{date, label}]. Returns the problems found */
export function setSchedule(classDays, breakList) {
  const errs = [];
  mondays = (Array.isArray(classDays) ? classDays : []).map(d => { const ms = isoDay(d); if (isNaN(ms)) errs.push(`company.json classDays: "${d}" should look like 2027-01-14`); return monday(ms); })
    .filter(ms => !isNaN(ms)).sort((a, b) => a - b);
  if (!mondays.length) {
    errs.push("company.json classDays is missing; weeks start from this week's Monday");
    mondays = [monday(Math.floor(wall() / DAY) * DAY)];
  }
  breaks = (Array.isArray(breakList) ? breakList : []).filter(b => b && !isNaN(isoDay(b.date))).map(b => ({ start: monday(isoDay(b.date)), label: String(b.label || "") }));
  return errs;
}
export function setZone(z) {
  if (typeof z !== "string" || !z) return;
  try { new Intl.DateTimeFormat("en-US", { timeZone: z }); zone = z; parts = null; }
  catch { console.warn(`company.json timeZone "${z}" is not a known time zone; using ${zone}.`); }
}
export const setLocale = l => { if (typeof l === "string" && l) locale = l; };
/* ?today=YYYY-MM-DD: move the clock to that day, keeping the time of day */
export function setPreviewDay(iso) {
  const d = isoDay(iso);
  shift = isNaN(d) ? 0 : d - Math.floor(wall(0) / DAY) * DAY;
}
export const weekCount = () => mondays.length;
/* the Monday that starts week n; weeks past the last class carry on weekly */
export const weekStart = n => (n >= 1 && n <= mondays.length ? mondays[n - 1] : n < 1 ? mondays[0] - (1 - n) * 7 * DAY : mondays[mondays.length - 1] + (n - mondays.length) * 7 * DAY);
/* the week a time falls in: the last week that has started by then (0 before week 1) */
export function weekOf(ms) {
  let n = 0;
  while (n < mondays.length && mondays[n] <= ms) n++;
  return n === mondays.length && n ? n + Math.floor((ms - mondays[n - 1]) / (7 * DAY)) : n;
}
/* the break (e.g. "Spring break") whose week contains this time, if any */
export const breakAt = ms => breaks.find(b => ms >= b.start && ms < b.start + 7 * DAY) || null;
export const breakWeeks = () => breaks.map(b => ({ ...b, after: weekOf(b.start) }));

export function parse(s, week = 1) {
  if (typeof s !== "string") return NaN;
  s = s.trim();
  const m = /^(?:W(\d{1,2})\s+)?(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2}):(\d{2})$/i.exec(s);
  if (m && (m[1] === "0" || m[1] === "00" || +m[3] > 23 || +m[4] > 59)) return NaN;
  if (m) return weekStart(m[1] ? +m[1] : week) + DAYS.indexOf(m[2].toLowerCase()) * DAY + (+m[3]) * 36e5 + (+m[4]) * 6e4;
  const d = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s);
  if (d) return d[2] && (+d[2] > 23 || +d[3] > 59) ? NaN : isoDay(d[1]) + (d[2] ? +d[2] * 36e5 + +d[3] * 6e4 : 0);
  return NaN;
}

/* the real time now, as the company's wall-clock time */
function wall(add = shift) {
  try { parts = parts || new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric" }); }
  catch { return Date.now() + add; }
  const p = Object.fromEntries(parts.formatToParts(Date.now()).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) + add;
}
export const now = () => wall();
/* the class week of today, kept within 1..the last class */
export const currentWeek = () => Math.min(Math.max(weekOf(now()), 1), mondays.length);

const fmts = new Map();
export function fmt(ms, opts) {
  const key = JSON.stringify(opts);
  if (!fmts.has(key)) fmts.set(key, new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...opts }));
  return fmts.get(key).format(ms);
}
export const fmtTime = ms => fmt(ms, { hour: "numeric", minute: "2-digit" });
export const fmtDate = ms => fmt(ms, { weekday: "short", month: "short", day: "numeric" });
export const fmtLong = ms => fmt(ms, { weekday: "long", month: "long", day: "numeric" });
export const fmtDay = ms => fmt(ms, { month: "short", day: "numeric" });
export const dayIndex = ms => (new Date(ms).getUTCDay() + 6) % 7;
