/* ---- Contacts -------------------------------------------------------------------------------
   Everyone at the company, as cards that can be filtered by department.
   A colleague is Available when the open weeks' unlocks.json lists them; only
   they get a working Message button, with their weekly question allowance.
   People marked "contact": "email" in people.json (the CEO, the IT Service
   Desk) only send email; everyone else is Out of office until their week.
   "external": true marks someone from another company; "listed": false
   keeps a sender (the IT Service Desk mailbox) out of the directory.     */
import { el, icon, stateBox } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { avatar, partError, chips } from "./common.js";

export function mount(body, ctx) {
  const { world } = ctx, people = world.people.items.filter(p => p.listed !== false);   // "listed": false = a mailbox, not in the directory
  if (!people.length)
    return void body.replaceChildren(stateBox({ name: "users", kind: "error", title: t("error.partTitle"), text: t("error.app"), details: world.people.errors }));

  const online = p => ctx.botUrl(p.id) !== undefined;
  const status = p => (p.contact === "email" ? "email" : online(p) ? "online" : "away");   // email-only people never chat
  const rank = { online: 0, email: 1, away: 2 };
  const sorted = [...people].sort((a, b) => rank[status(a)] - rank[status(b)]);
  const depts = [...new Set(people.map(p => p.department).filter(Boolean))];
  const count = el("p.muted.contacts-count", { "aria-live": "polite" });
  const grid = el("ul.contact-grid");
  let dept = "*";

  function draw() {
    const shown = sorted.filter(p => dept === "*" || p.department === dept);
    count.textContent = t("contacts.count", { count: shown.length });
    grid.replaceChildren(...shown.map(p => {
      const st = status(p), on = st === "online", url = ctx.botUrl(p.id), quota = ctx.quota(p.id);
      const msg = el("button.btn" + (on ? ".primary" : ""), { type: "button", disabled: !on, "aria-label": t("contacts.messageTo", { name: p.name }) },
        icon("message-circle", 16), el("span", { text: t("contacts.message") }));
      msg.addEventListener("click", () => ctx.openExternal({ url, kind: "chat", name: p.name, id: p.id }));
      return el("li.contact" + (on ? ".online" : ""), {},
        el("div.contact-top", {}, avatar(p, 44), el("div", {}, el("h3.contact-name", { text: p.name }), el("p.muted", { text: p.title || "" }))),
        el("p.contact-dept", {}, el("span", { text: p.department || "" }), p.external ? el("span.tag", { text: t("contacts.external") }) : null),
        el("p.status", { dataset: { status: st } }, el("span.dot", { "aria-hidden": "true" }), el("span", { text: t("contacts.status." + st) })),
        p.bio ? el("p.contact-bio", { text: p.bio }) : null,
        el("div.contact-actions", {}, p.contact === "email" ? null : msg,
          el("span.muted", { text: on ? (quota ? t("contacts.quota", { count: quota }) : t("contacts.noLimit")) : t("contacts.note." + st) })));
    }));
  }

  body.replaceChildren(el("div.contacts", {}, partError([...world.people.errors, ...world.unlocks.errors]),
    el("div.contacts-bar", {}, chips([["*", t("contacts.all")], ...depts.map(d => [d, d])], dept, v => { dept = v; draw(); }, t("contacts.department")), count),
    grid));
  draw();
}
