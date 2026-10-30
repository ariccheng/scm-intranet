/* ---- Coffee mug: a small easter egg -------------------------------------------------------------
   Steam rises once from the mug, with one light line from ui.json.     */
import { el } from "../core/dom.js";
import { t } from "../core/i18n.js";

const SVG = "http://www.w3.org/2000/svg";
const svg = (tag, attrs) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };

export function render(panel) {
  const art = svg("svg", { viewBox: "0 0 120 140", width: "150", height: "175", "aria-hidden": "true", class: "coffee-art" });
  for (const [i, x] of [44, 60, 76].entries())
    art.append(svg("path", { class: "steam s" + i, d: `M${x} 54c-8-9 8-15 0-25s8-15 0-24`, fill: "none", stroke: "currentColor", "stroke-width": "4", "stroke-linecap": "round" }));
  art.append(svg("path", { d: "M90 76h6a14 14 0 0 1 0 28h-6", fill: "none", stroke: "#CFC9C0", "stroke-width": "8" }),
    svg("path", { d: "M26 64h66v44a22 22 0 0 1-22 22H48a22 22 0 0 1-22-22Z", fill: "#ECE8E2" }),
    svg("ellipse", { cx: "59", cy: "64", rx: "33", ry: "6", fill: "#6B4A33" }));
  panel.append(el("div.coffee", {}, art, el("p.coffee-line", { text: t("coffee.line") })));
}
