/* ---- Store map: where our stores are --------------------------------------------------------
   A printed map card of the Phoenix area, built as an inline SVG from
   company.json "stores" and "centralKitchen" (lat/lon) and content/map.json:
   the freeways (real routes from OpenStreetMap, simplified), city names and
   the sports venues. The projection is a plain equirectangular one, with
   longitudes shortened by cos(latitude) so the shapes are not stretched.
   Store codes are placed one by one in the first free spot around their
   dot; a code pushed further out gets a short leader line. Venues are
   numbered markers, named in the key below the map. If map.json cannot be
   read the stores are still drawn. The same stores are listed in a table
   next to (or under) the map, with each store's type (urban, suburban...),
   which is what screen readers use. Store types are not shown as colours
   on the map, and the map shows no delivery routes.                     */
import { el } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { CONTENT, getJSON } from "../core/load.js";

const SVG = "http://www.w3.org/2000/svg";
const svg = (tag, attrs, text) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text != null) n.textContent = text; return n; };

/* the Salt River, then the Gila past Buckeye, simplified to a few points (lon, lat) */
const RIVER = [[-111.55, 33.56], [-111.68, 33.51], [-111.8, 33.465], [-111.9, 33.437], [-111.97, 33.43], [-112.05, 33.418], [-112.14, 33.405],
  [-112.24, 33.392], [-112.33, 33.38], [-112.46, 33.36], [-112.7, 33.345]];
const W = 640, M = 26;
const DIRS = [[1, 0], [-1, 0], [.71, -.71], [.71, .71], [-.71, -.71], [-.71, .71], [0, -1], [0, 1]];
const num = v => typeof v === "number" && isFinite(v);
const arr = v => (Array.isArray(v) ? v : []);
const ll = p => p && num(p.lat) && num(p.lon);

export function render(panel, ctx) {
  const co = ctx.world.company, ck = ll(co.centralKitchen) ? co.centralKitchen : null;
  const stores = arr(co.stores).filter(ll).sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const card = el("article.smap", {}, el("header.smap-head", {}, el("h2", { text: t("map.title") }),
    el("p", { text: t("map.count", { count: stores.length }) })));
  panel.append(card);
  if (!stores.length) { card.append(el("p", { text: t("map.empty") })); return; }

  const fig = el("figure.smap-fig");
  const table = el("table.smap-table", {}, el("caption", { text: t("map.tableCaption") }),
    el("thead", {}, el("tr", {}, ["map.code", "map.name", "map.type", "map.opened"].map(key => el("th", { scope: "col", text: t(key) })))),
    el("tbody", {}, stores.map(s => el("tr", {}, el("th", { scope: "row", text: String(s.code || "") }), el("td", { text: s.name || "" }), el("td", { text: s.type ? String(s.type) : "" }), el("td", { text: s.opened != null ? String(s.opened) : "" })))));
  card.append(el("div.smap-body", {}, fig, el("div.smap-list", {}, table)));
  draw(fig, co, ck, stores, {});
  getJSON(new URL("map.json", CONTENT)).then(r => {
    if (!r.ok || !r.value || typeof r.value !== "object") { console.error(r.error || "map.json is not an object"); return; }
    if (fig.isConnected) draw(fig, co, ck, stores, r.value);
  });
}

function draw(fig, co, ck, stores, extra) {
  const cities = arr(extra.cities).filter(c => ll(c) && c.name);
  const venues = arr(extra.venues).filter(v => ll(v) && v.name);
  const roads = arr(extra.roads).filter(r => r && Array.isArray(r.lines));

  /* projection: fit stores, kitchen, cities and venues into a W-wide box */
  const pts = [...stores, ...(ck ? [ck] : []), ...cities, ...venues];
  const lat0 = Math.min(...pts.map(p => p.lat)) - .03, lat1 = Math.max(...pts.map(p => p.lat)) + .03;
  const lon0 = Math.min(...pts.map(p => p.lon)) - .03, lon1 = Math.max(...pts.map(p => p.lon)) + .03;
  const cos = Math.cos((lat0 + lat1) / 2 * Math.PI / 180), k = (W - 2 * M) / ((lon1 - lon0) * cos), H = Math.round((lat1 - lat0) * k + 2 * M);
  const xy = (lat, lon) => [M + (lon - lon0) * cos * k, M + (lat1 - lat) * k];
  const inside = ([x, y]) => x > 14 && x < W - 14 && y > 14 && y < H - 14;

  const river = RIVER.map(([lon, lat]) => xy(lat, lon));
  const map = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "smap-svg", role: "img",
    "aria-label": t("map.alt", { count: stores.length, city: ck ? ck.city || "" : "" }) + (venues.length ? " " + t("map.altVenues", { count: venues.length }) : "") });
  const clip = "smap-clip-" + Math.random().toString(36).slice(2, 8);
  const defs = svg("defs", {}), cp = svg("clipPath", { id: clip });
  cp.append(svg("rect", { x: 1, y: 1, width: W - 2, height: H - 2, rx: 6 }));
  defs.append(cp);
  const roadG = svg("g", { class: "smap-roads", "clip-path": `url(#${clip})` }), shields = svg("g", {});
  const lines = svg("g", { class: "smap-leaders" }), marks = svg("g", {}), labels = svg("g", {});
  map.append(defs, svg("rect", { class: "smap-land", x: 1, y: 1, width: W - 2, height: H - 2, rx: 6 }),
    svg("polyline", { class: "smap-river", points: river.map(p => p.join(",")).join(" ") }), roadG, lines, marks, shields, labels);

  /* label placement: the first spot around a point that overlaps nothing placed so far */
  const taken = [];
  const free = b => b.x >= 4 && b.y >= 4 && b.x + b.w <= W - 4 && b.y + b.h <= H - 4 &&
    !taken.some(o => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h);
  const block = (x, y, r) => taken.push({ x: x - r, y: y - r, w: 2 * r, h: 2 * r });
  function place([px, py], w, h, rings, dirs, optional) {
    let best = null;
    for (const d of rings) for (const [ux, uy] of dirs) {
      const cx = px + ux * (d + w / 2), cy = py + uy * (d + h / 2), b = { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy, d, ux, uy };
      if (free(b)) { taken.push(b); return b; }
      best ||= b;
    }
    if (optional) return null;   // a city name or road shield that does not fit is left out; it is only there for orientation
    taken.push(best);
    return best;
  }

  /* freeways: a pale casing under a darker line, like a printed road map */
  const paths = roads.map(r => ({ r, segs: arr(r.lines).map(l => arr(l).filter(p => Array.isArray(p) && num(p[0]) && num(p[1])).map(([lon, lat]) => xy(lat, lon))).filter(s => s.length > 1) }));
  for (const { r, segs } of paths) for (const s of segs) {
    const d = "M" + s.map(p => p.map(v => v.toFixed(1)).join(" ")).join("L");
    roadG.append(svg("path", { class: "smap-road-case", d }), svg("path", { class: "smap-road" + (/^I-/.test(r.ref || "") ? " interstate" : ""), d }));
  }

  /* the river line is an obstacle too: small blocks every few pixels along it */
  for (let i = 1; i < river.length; i++) {
    const [ax, ay] = river[i - 1], [bx, by] = river[i], n = Math.ceil(Math.hypot(bx - ax, by - ay) / 4);
    for (let j = 0; j <= n; j++) block(ax + (bx - ax) * j / n, ay + (by - ay) * j / n, 2);
  }
  /* north arrow in the top left corner, kept clear of labels */
  const north = svg("g", { class: "smap-north", transform: "translate(30 36)" });
  north.append(svg("path", { d: "M0 -14 L7 8 L0 3 L-7 8 Z" }), svg("text", { x: 0, y: 24 }, t("map.north")));
  map.append(north);
  taken.push({ x: 14, y: 14, w: 32, h: 52 });

  const sp = stores.map(s => xy(s.lat, s.lon)), kp = ck ? xy(ck.lat, ck.lon) : null, vp = venues.map(v => xy(v.lat, v.lon));
  sp.forEach(([x, y]) => block(x, y, 5));
  if (kp) block(kp[0], kp[1], 8);
  vp.forEach(([x, y]) => block(x, y, 6));
  /* venues first, so a store next to a stadium stays on top */
  vp.forEach(([x, y]) => marks.append(svg("path", { class: "smap-venue", d: `M${x} ${y - 6.5}L${x + 6} ${y}L${x} ${y + 6.5}L${x - 6} ${y}Z` })));
  sp.forEach(([x, y]) => marks.append(svg("circle", { class: "smap-store", cx: x, cy: y, r: 4.5 })));
  if (kp) marks.append(svg("rect", { class: "smap-kitchen", x: kp[0] - 7, y: kp[1] - 7, width: 14, height: 14, rx: 2 }));

  const label = (p, text, cls, w) => {
    const b = place(p, w, 13, [7, 17, 29, 43], DIRS);
    if (b.d > 7) lines.append(svg("line", { x1: p[0] + b.ux * 5, y1: p[1] + b.uy * 5, x2: b.cx - b.ux * b.w / 2, y2: b.cy - b.uy * b.h / 2 }));
    labels.append(svg("text", { class: cls, x: b.cx, y: b.cy, dy: ".35em" }, text));
  };
  if (kp) label(kp, t("map.kitchenShort"), "smap-code smap-code-kitchen", t("map.kitchenShort").length * 8 + 4);
  stores.forEach((s, i) => label(sp[i], String(s.code || ""), "smap-code", String(s.code || "").length * 7.4 + 4));
  venues.forEach((v, i) => label(vp[i], String(i + 1), "smap-code smap-code-venue", 13));

  /* one shield per freeway, at the first free point along its longest stretch */
  for (const { r, segs } of paths) {
    const text = String(r.shield || r.name || "").replace(/^(I-|US |SR |Loop )/, "");
    if (!text || !segs.length) continue;
    const s = segs.reduce((a, b) => (b.length > a.length ? b : a)).filter(inside), w = text.length * 6.4 + 9;
    for (const f of [.5, .35, .65, .2, .8, .1, .9]) {
      const p = s[Math.floor(f * (s.length - 1))];
      const b = p && place(p, w, 14, [-7], [[0, 1]], true);
      if (!b) continue;
      shields.append(svg("rect", { class: "smap-shield" + (/^I-/.test(r.ref || "") ? " interstate" : ""), x: b.x, y: b.y, width: w, height: 14, rx: /^I-/.test(r.ref || "") ? 3 : 7 }),
        svg("text", { class: "smap-shield-text", x: b.cx, y: b.cy, dy: ".35em" }, text));
      break;
    }
  }
  /* city names get extra room (a taller box) so two of them never read as one label */
  for (const c of cities) {
    const name = String(c.name);
    const b = place(xy(c.lat, c.lon), name.length * 7.6 + 6, 21, [-10.5, 5, 14, 24], [[0, 1], [0, -1], [1, 0], [-1, 0], ...DIRS.slice(2, 6)], true);
    if (b) labels.append(svg("text", { class: "smap-city", x: b.cx, y: b.cy, dy: ".35em" }, name.toUpperCase()));
  }

  const legend = el("ul.smap-legend", {}, el("li", {}, el("span.key.store", { "aria-hidden": "true" }), el("span", { text: t("map.store") })),
    ck ? el("li", {}, el("span.key.kitchen", { "aria-hidden": "true" }), el("span", { text: `${ck.name || ""}${ck.city ? ", " + ck.city : ""}` }),
      el("span.smap-hq", { "aria-hidden": "true", text: `(${t("map.kitchenShort")})` })) : null,
    roads.length ? el("li", {}, el("span.key.road", { "aria-hidden": "true" }), el("span", { text: t("map.freeway") })) : null,
    el("li.smap-note", { text: t("map.schematic") }));
  const key = venues.length ? el("div.smap-venues", {}, el("h3", {}, el("span.key.venue", { "aria-hidden": "true" }), el("span", { text: t("map.venues") })),
    el("ol", {}, venues.map(v => el("li", {}, el("strong", { text: String(v.name) }), v.what ? el("span", { text: ` · ${v.what}` }) : null)))) : null;
  const credit = extra.attribution ? el("p.smap-credit", { text: String(extra.attribution) }) : null;
  fig.replaceChildren(el("div.smap-scroll", { role: "group", "aria-label": t("map.title") }, map), el("figcaption", {}, legend, key, credit));
}
