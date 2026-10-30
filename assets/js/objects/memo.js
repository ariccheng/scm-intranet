/* ---- Memo: an office memo left on the desk ------------------------------------------------------
   A printed sheet on company letterhead from a week's desk.json entry:
   {from, to, date, subject, body}. "from" may be a person id from
   people.json (shown as name and title) or plain text; "date" is a time
   such as "W2 Mon 08:00"; "body" is a Markdown file in the week folder,
   rendered like an email. If the body cannot be read, the memo still
   shows its header and says so.                                        */
import { el } from "../core/dom.js";
import { t, getGlobal } from "../core/i18n.js";
import * as time from "../core/simtime.js";
import { getText } from "../core/load.js";
import { render as markdown } from "../core/markdown.js";
import { guardLinks, tokens } from "../apps/common.js";
import { initials } from "../core/color.js";

export function render(panel, ctx, item) {
  const m = item || {}, co = ctx.world.company;
  const who = id => { const p = typeof id === "string" && ctx.world.people.byId.get(id); return p ? `${p.name}${p.title ? ", " + p.title : ""}` : id ? String(id) : ""; };
  const when = time.parse(m.date, m.week), date = isNaN(when) ? (m.date ? String(m.date) : "") : `${time.fmtLong(when)}, ${time.fmtTime(when)}`;
  const logo = co.logo ? el("img.memo-logo", { src: co.logo, alt: "" }) : el("span.memo-logo.wordmark", { "aria-hidden": "true", text: initials(getGlobal("company")) });
  const row = (k, v) => (v ? el("div", {}, el("dt", { text: t(k) }), el("dd", { text: v })) : null);
  const body = el("div.memo-body.prose");
  guardLinks(body, ctx);
  panel.append(el("article.memo", {},
    el("header.memo-letterhead", {}, logo, el("span.memo-co", { text: getGlobal("company") })),
    el("h2.memo-title", { text: t("memo.title") }),
    el("dl.memo-fields", {}, row("memo.to", m.to), row("memo.from", who(m.from)), row("memo.date", date), row("memo.subject", m.subject)),
    body));
  const initial = () => panel.querySelector(".obj-close");   // not the first link in the body
  if (!m.body || !m.base) return { initial };
  body.append(el("p.memo-status", { text: t("memo.loading") }));
  let url = null;
  try { url = new URL(String(m.body), m.base); } catch (e) { url = null; }
  (url ? getText(url) : Promise.resolve({ ok: false, error: `desk.json: "${m.id}" body "${m.body}" is not a valid path` })).then(r => {
    if (!r.ok) { console.error(r.error); body.replaceChildren(el("p.memo-status", { role: "alert", text: t("memo.bodyError") })); return; }
    body.innerHTML = markdown(r.value, { base: url, tokens: tokens() });   // markdown() escapes everything first
  });
  return { initial };
}
