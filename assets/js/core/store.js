/* ---- Local state -------------------------------------------------------------
   Only conveniences live here: the student's name, read mail, ticked to-dos,
   the notebook and the sound switch. Keys carry a prefix because the rest of
   ariccheng.github.io shares this browser storage. If storage is blocked
   (private mode, strict settings) everything still works for the visit.     */
const PREFIX = "scm-intranet:v1:";
const mem = new Map();
let ls = null;
try { const k = PREFIX + "probe"; localStorage.setItem(k, "1"); localStorage.removeItem(k); ls = localStorage; } catch (e) { ls = null; }

export const persistent = () => !!ls;

export function get(key, def, ok = () => true) {
  let raw = mem.has(key) ? mem.get(key) : null;
  if (raw == null && ls) try { raw = ls.getItem(PREFIX + key); } catch (e) { raw = null; }
  if (raw == null) return def;
  try { const v = JSON.parse(raw); return ok(v) ? v : def; } catch (e) { return def; }
}

export function set(key, value) {
  const raw = JSON.stringify(value);
  mem.set(key, raw);
  if (ls) try { ls.setItem(PREFIX + key, raw); } catch (e) { /* full or blocked: keep the in-memory copy */ }
}

/* Reset this computer: remove only this site's keys */
export function clearAll() {
  mem.clear();
  if (!ls) return;
  try {
    const keys = [];
    for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith(PREFIX)) keys.push(k); }
    keys.forEach(k => ls.removeItem(k));
  } catch (e) { /* nothing more to do */ }
}

export const isObj = v => v && typeof v === "object" && !Array.isArray(v);
export const isStr = v => typeof v === "string";
