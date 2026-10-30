/* ---- Content -------------------------------------------------------------------------
   Reads content/ and merges the open weeks listed in weeks/index.json. In
   week N the student sees weeks 1..N: mail, files, calendar events, phone
   notifications, dashboards and the colleagues who can be messaged all add
   up (a later week may replace an item by reusing its id), and so do the
   people who join (week people.json), newspaper headlines (newspaper.json)
   and papers left on the desk (desk.json). To-dos and the login
   notification come from the newest week only. weekNow is the semester
   week of today's date, which can run ahead of the newest open week.
   Each part keeps its own error list, so a broken file only affects the app
   that shows it. A missing optional list (unlocks, files, emails,
   dashboards) counts as empty; a file that exists but cannot be read is an
   error.                                                                     */
import { CONTENT, SITE, getJSON, getText, resolve } from "./load.js";
import { parseFrontMatter } from "./frontmatter.js";
import * as time from "./simtime.js";

const arr = v => (Array.isArray(v) ? v : []);
const list = v => (typeof v === "string" && v.trim() ? [v.trim()] : arr(v));   // "a" or [a, b]
/* keep only {...} items; report the rest so a typo cannot take the page down */
const objs = (v, errs, where) => arr(v).filter((x, i) => {
  const ok = x && typeof x === "object" && !Array.isArray(x);
  if (!ok) errs.push(`${where}: item ${i + 1} should be {...}`);
  return ok;
});
const part = () => ({ items: [], errors: [] });
const missing = r => !r.ok && /\(404\)$/.test(r.error);
const WEEK_ID = /^week-(\d{2})$/;

export async function loadWorld() {
  const W = {
    company: {}, errors: [], people: { ...part(), byId: new Map() }, credits: part(),
    weeks: [], current: null, mail: part(), files: { ...part(), byId: new Map() },
    unlocks: { byPerson: new Map(), quota: new Map(), errors: [] }, calendar: part(), phone: part(), dashboards: part(),
    news: part(), desk: part(), todos: { ...part(), week: null }, loginNotification: null, weekNow: 1, breakNow: null
  };
  const [company, people, credits, index] = await Promise.all(
    ["company.json", "people.json", "credits.json", "weeks/index.json"].map(f => getJSON(new URL(f, CONTENT))));

  if (company.ok && company.value && typeof company.value === "object") {
    W.company = { ...company.value, logo: resolve(company.value.logo, SITE), wallpaper: resolve(company.value.wallpaper, SITE) };
  } else W.errors.push(company.error || "company.json is not an object");
  time.setZone(W.company.timeZone);
  time.setPreviewDay(new URLSearchParams(location.search).get("today"));
  W.errors.push(...time.setSchedule(W.company.classDays, W.company.breaks));
  W.weekNow = time.currentWeek();
  W.breakNow = time.breakAt(time.now());

  if (people.ok) addPeople(W, people.value, "people.json", 1); else W.people.errors.push(people.error);
  W.people.items = [...W.people.byId.values()];

  if (credits.ok) W.credits.items = objs(credits.value, W.credits.errors, "credits.json"); else W.credits.errors.push(credits.error);

  if (!index.ok) {
    for (const k of ["mail", "files", "unlocks", "calendar", "phone", "dashboards", "news", "desk", "todos"]) W[k].errors.push(index.error);
    return W;
  }
  for (const id of arr(index.value)) {
    const m = WEEK_ID.exec(id);
    if (!m) { W.errors.push(`weeks/index.json: "${id}" should look like week-01`); continue; }
    W.weeks.push({ id, n: +m[1], base: new URL(id + "/", new URL("weeks/", CONTENT)) });
  }
  W.weeks.sort((a, b) => a.n - b.n);
  W.current = W.weeks[W.weeks.length - 1] || null;

  const loaded = await Promise.all(W.weeks.map(loadWeek));
  const mail = new Map(), files = new Map(), cal = new Map(), phone = new Map(), dash = new Map(), news = new Map(), desk = new Map();
  for (const L of loaded) merge(W, L, { mail, files, cal, phone, dash, news, desk });
  W.people.items = [...W.people.byId.values()];
  W.mail.items = [...mail.values()].sort((a, b) => b.sentAt - a.sentAt || b.week - a.week || b.order - a.order);
  W.files.items = [...files.values()];
  W.files.byId = files;
  W.calendar.items = [...cal.values()].sort((a, b) => a.start - b.start);
  W.phone.items = [...phone.values()].sort((a, b) => b.time - a.time);
  W.dashboards.items = [...dash.values()];
  W.news.items = [...news.values()].sort((a, b) => b.week - a.week || a.order - b.order);
  W.desk.items = [...desk.values()];
  return W;
}

/* people.json at the top of content/, or a week's people.json for those who join later */
function addPeople(W, value, where, week) {
  for (const p of objs(value, W.people.errors, where)) {
    if (!p.id) { W.people.errors.push(`${where}: an entry has no id`); continue; }
    W.people.byId.set(p.id, { ...p, week, avatar: resolve(p.avatar, SITE) });
  }
}

async function loadWeek(wk) {
  const at = f => new URL(f, wk.base);
  const [week, unlocks, files, emailIndex, dashboards, people, news, desk] = await Promise.all(
    ["week.json", "unlocks.json", "files.json", "emails/index.json", "dashboards/index.json", "people.json", "newspaper.json", "desk.json"].map(f => getJSON(at(f))));
  const emails = emailIndex.ok
    ? await Promise.all(arr(emailIndex.value).filter(n => typeof n === "string").map(name => getText(at("emails/" + name)).then(r => ({ name, r }))))
    : [];
  return { wk, week, unlocks, files, emailIndex, emails, dashboards, people, news, desk };
}

function merge(W, L, maps) {
  const { wk } = L, latest = wk === W.current, tag = f => `${wk.id}/${f}`;
  const when = (s, where, errs) => {
    const ms = time.parse(s, wk.n);
    if (isNaN(ms)) { errs.push(`${where}: time "${s}" should look like "Mon 09:00"`); return time.weekStart(wk.n); }
    return ms;
  };

  if (L.week.ok) {
    const v = L.week.value && typeof L.week.value === "object" ? L.week.value : {};
    objs(v.calendarEvents, W.calendar.errors, tag("week.json calendarEvents")).forEach((e, i) => {
      const id = e.id || tag("event-" + i);
      maps.cal.set(id, { ...e, id, week: wk.n, start: when(e.start, tag("week.json"), W.calendar.errors),
        end: e.end ? when(e.end, tag("week.json"), W.calendar.errors) : null });
    });
    objs(v.phoneNotifications, W.phone.errors, tag("week.json phoneNotifications")).forEach((p, i) => {
      const id = p.id || tag("phone-" + i);
      maps.phone.set(id, { ...p, id, week: wk.n, time: when(p.time || "Mon 08:00", tag("week.json"), W.phone.errors) });
    });
    if (latest) {
      W.todos.week = wk.id;
      W.todos.items = objs(v.todos, W.todos.errors, tag("week.json todos")).filter((x, i) => {
        if (x.id && x.text) return true;
        W.todos.errors.push(`${tag("week.json todos")}: item ${i + 1} needs "id" and "text"`);
        return false;
      }).map(x => ({ ...x, text: String(x.text), key: tag(x.id) }));
      W.loginNotification = v.loginNotification || null;
    }
  } else {
    for (const k of ["calendar", "phone"]) W[k].errors.push(L.week.error);
    if (latest) W.todos.errors.push(L.week.error);
  }

  if (L.people.ok) addPeople(W, L.people.value, tag("people.json"), wk.n);
  else if (!missing(L.people)) W.people.errors.push(L.people.error);

  /* "quota": questions per week; leave it out (or null) for no limit.
     "botUrl": null takes a colleague offline again from this week on */
  if (L.unlocks.ok) for (const u of objs(L.unlocks.value, W.unlocks.errors, tag("unlocks.json"))) {
    if (!u.personId) continue;
    if (u.botUrl === null) { W.unlocks.byPerson.delete(u.personId); W.unlocks.quota.delete(u.personId); continue; }
    W.unlocks.byPerson.set(u.personId, u.botUrl === "#" ? "#" : resolve(u.botUrl, wk.base) || "#");
    const q = u.quota ?? null, ok = q === null || (Number.isInteger(q) && q > 0);
    if (!ok) W.unlocks.errors.push(`${tag("unlocks.json")}: "quota" for ${u.personId} should be a whole number above 0, or null for no limit`);
    W.unlocks.quota.set(u.personId, ok ? q : null);
  } else if (!missing(L.unlocks)) W.unlocks.errors.push(L.unlocks.error);

  if (L.news.ok) objs(L.news.value, W.news.errors, tag("newspaper.json")).forEach((n, i) => {
    if (!n.headline) { W.news.errors.push(`${tag("newspaper.json")}: story ${i + 1} has no headline`); return; }
    const id = n.id || tag("story-" + i);
    maps.news.set(id, { ...n, id, week: wk.n, order: i });
  }); else if (!missing(L.news)) W.news.errors.push(L.news.error);

  /* papers left on the desk: [{id, type: "memo" | "flyer", spot, ...}] */
  if (L.desk.ok) objs(L.desk.value, W.desk.errors, tag("desk.json")).forEach((d, i) => {
    if (!d.id || !d.type) { W.desk.errors.push(`${tag("desk.json")}: item ${i + 1} needs "id" and "type"`); return; }
    maps.desk.set(d.id, { ...d, week: wk.n, base: wk.base });
  }); else if (!missing(L.desk)) W.desk.errors.push(L.desk.error);

  if (L.files.ok) objs(L.files.value, W.files.errors, tag("files.json")).forEach((f, i) => {
    if (!f || !f.name) { W.files.errors.push(`${tag("files.json")}: entry ${i + 1} has no name`); return; }
    const id = f.id || tag("file-" + i);
    maps.files.set(id, { ...f, id, week: wk.n, url: resolve(f.url, wk.base) || "#" });
  }); else if (!missing(L.files)) W.files.errors.push(L.files.error);

  if (L.dashboards.ok) objs(L.dashboards.value, W.dashboards.errors, tag("dashboards/index.json")).forEach((d, i) => {
    if (!d || !d.file) { W.dashboards.errors.push(`${tag("dashboards/index.json")}: entry ${i + 1} has no file`); return; }
    const id = d.id || tag("dashboard-" + i);
    maps.dash.set(id, { ...d, id, week: wk.n, file: resolve(d.file, new URL("dashboards/", wk.base)) });
  }); else if (!missing(L.dashboards)) W.dashboards.errors.push(L.dashboards.error);

  if (!L.emailIndex.ok && !missing(L.emailIndex)) W.mail.errors.push(L.emailIndex.error);
  L.emails.forEach(({ name, r }, order) => {
    if (!r.ok) { W.mail.errors.push(r.error); return; }
    const { data, body, error } = parseFrontMatter(r.value);
    const where = tag("emails/" + name);
    if (error) { W.mail.errors.push(`${where}: ${error}`); return; }
    const lack = ["id", "fromPersonId", "subject", "sentAt"].filter(k => !data[k]);
    if (lack.length) { W.mail.errors.push(`${where}: header is missing ${lack.join(", ")}`); return; }
    maps.mail.set(data.id, { id: data.id, from: data.fromPersonId, subject: String(data.subject), folder: data.folder || "inbox",
      sentAt: when(data.sentAt, where, W.mail.errors), attachments: list(data.attachments), body, base: wk.base, week: wk.n, order });
  });
}
