/* ---- Newspaper: the local paper --------------------------------------------------------------
   A folded broadsheet built from the open weeks' newspaper.json stories
   (world.news.items, newest week first). The front page carries the newest
   week's stories, dated the Monday of that week; earlier weeks' stories
   sit under "Earlier editions", one fold-out per week. The paper's name
   is in ui.json (newspaper.masthead).                                  */
import { el } from "../core/dom.js";
import { t } from "../core/i18n.js";
import * as time from "../core/simtime.js";
import { partError } from "../apps/common.js";

const paras = b => (Array.isArray(b) ? b : typeof b === "string" ? [b] : []).filter(p => typeof p === "string" && p.trim());

function story(s, lead, level) {
  return el("article.np-story" + (lead ? ".lead" : ""), {},
    s.section ? el("p.np-section", { text: s.section }) : null,
    el(level, { class: "np-headline", text: s.headline }),
    s.dek ? el("p.np-dek", { text: s.dek }) : null,
    el("div.np-body", {}, paras(s.body).map(p => el("p", { text: p }))));
}

export function render(panel, ctx) {
  const items = ctx.world.news.items, weeks = [...new Set(items.map(s => s.week))];
  const front = items.filter(s => s.week === weeks[0]), date = n => time.fmtLong(time.weekStart(n));
  const paper = el("div.np", {}, partError(ctx.world.news.errors),
    el("header.np-mast", {}, el("h2.np-name", { text: t("newspaper.masthead") }),
      el("p.np-dateline", {}, el("span", { text: weeks.length ? date(weeks[0]) : "" }), el("span", { text: t("newspaper.edition") }))),
    el("section.np-front", { "aria-label": t("newspaper.frontPage") }, front.map((s, i) => story(s, i === 0, "h3"))),
    weeks.length > 1 ? el("section.np-earlier", { "aria-labelledby": "np-earlier" }, el("h3.np-earlier-title", { id: "np-earlier", text: t("newspaper.earlier") }),
      weeks.slice(1).map(n => el("details.np-edition", {}, el("summary", { text: t("newspaper.editionOf", { date: date(n) }) }),
        items.filter(s => s.week === n).map(s => story(s, false, "h4"))))) : null);
  panel.append(paper);
}
