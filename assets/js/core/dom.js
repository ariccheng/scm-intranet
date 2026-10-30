/* ---- DOM helpers -----------------------------------------------------------
   el("div.card", {attrs}, ...children) builds a node; strings always go in as
   text, never as HTML. bus is a tiny event hub between scene, OS and apps.  */
import { ICONS } from "./icons.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex='-1'])";

export function el(tag, attrs, ...kids) {
  const [name, ...cls] = tag.split(".");
  const n = document.createElement(name || "div");
  if (cls.length) n.className = cls.join(" ");
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = (n.className + " " + v).trim();
    else if (k === "text") n.textContent = v;
    else if (k === "dataset") Object.assign(n.dataset, v);
    else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) n.append(c instanceof Node ? c : String(c));
  return n;
}
export const clear = n => (n.replaceChildren(), n);

const SVG = "http://www.w3.org/2000/svg";
export function icon(name, size = 20) {
  const s = document.createElementNS(SVG, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor",
    "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" })) s.setAttribute(k, v);
  for (const [tag, attrs] of ICONS[name] || []) {
    const c = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) c.setAttribute(k, v);
    s.append(c);
  }
  return s;
}

const handlers = {};
export const bus = {
  on(ev, fn) { (handlers[ev] ||= []).push(fn); },
  emit(ev, data) { for (const fn of handlers[ev] || []) try { fn(data); } catch (e) { console.error(e); } }
};

/* empty and error states inside apps: an icon, a title, a line of text, optional details */
export function stateBox({ name = "info", title, text, details = [], kind = "empty" }) {
  return el("div.state.state-" + kind, { role: kind === "error" ? "alert" : null }, el("span.state-icon", {}, icon(name, 28)),
    title ? el("h3", { text: title }) : null, text ? el("p", { text }) : null,
    details.length ? el("ul.state-details", {}, details.map(d => el("li", { text: d }))) : null);
}

export const wait = ms => new Promise(r => setTimeout(r, ms));
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
