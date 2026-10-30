/* ---- Phone ----------------------------------------------------------------------------------
   The screen lights up with the notifications of the open weeks, newest
   first (week.json "phoneNotifications"). Later weeks can use it for
   short notices, such as a colleague becoming available.              */
import { el, icon } from "../core/dom.js";
import { t, interpolate } from "../core/i18n.js";
import * as time from "../core/simtime.js";

export function render(panel, ctx) {
  const now = time.now(), phone = { ...ctx.world.phone, items: ctx.world.phone.items.filter(n => n.time <= now) };   // a notice shows from its own time
  panel.append(el("div.phone", {}, el("div.phone-screen", {},
    el("p.phone-time", { text: time.fmtTime(now) }), el("p.phone-date", { text: time.fmtLong(now) }),
    el("h2.sr-only", { text: t("phone.title") }),
    phone.items.length ? el("ul.phone-list", {}, phone.items.map(n => el("li.phone-note", {},
      el("p.phone-from", {}, icon("bell", 14), el("span", { text: n.sender || "" }), el("time", { text: Math.floor(n.time / 864e5) === Math.floor(now / 864e5) ? time.fmtTime(n.time) : `${time.fmtDay(n.time)}, ${time.fmtTime(n.time)}` })),
      el("p", { text: interpolate(n.text || "") }))))
      : el("p.phone-empty", { text: phone.errors.length ? t("error.partTitle") : t("phone.empty") }))));
}
