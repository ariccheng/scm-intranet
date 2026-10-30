/* ---- Interface text ------------------------------------------------------------
   Every word on screen comes from content/ui.json. t("mail.reply") looks a key
   up; {tokens} are filled from the call's values, then from the globals
   ({company}, {name}, {week}). A key with a count picks key.one / key.other.  */
import { $$ } from "./dom.js";

let UI = {};
const globals = {};
const warned = new Set();

export const setStrings = ui => { UI = ui && typeof ui === "object" ? ui : {}; };
export const setGlobals = o => Object.assign(globals, o);
export const getGlobal = k => globals[k];
export const has = key => typeof UI[key] === "string";

export const interpolate = (s, vars = {}) =>
  String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : k in globals ? String(globals[k]) : m));

export function t(key, vars = {}) {
  let s = UI[key];
  if (vars.count != null) { const f = UI[key + (vars.count === 1 ? ".one" : ".other")]; if (typeof f === "string") s = f; }
  if (typeof s !== "string") {
    if (!warned.has(key)) { warned.add(key); console.warn(`ui.json has no "${key}"`); }
    s = key;
  }
  return interpolate(s, vars);
}

/* data-i18n="key" sets text; data-i18n-label / -placeholder / -title set attributes */
export function applyStrings(root = document) {
  for (const n of $$("[data-i18n]", root)) n.textContent = t(n.dataset.i18n);
  for (const n of $$("[data-i18n-label]", root)) n.setAttribute("aria-label", t(n.dataset.i18nLabel));
  for (const n of $$("[data-i18n-placeholder]", root)) n.setAttribute("placeholder", t(n.dataset.i18nPlaceholder));
  for (const n of $$("[data-i18n-title]", root)) n.setAttribute("title", t(n.dataset.i18nTitle));
}
