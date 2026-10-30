/* ---- Loading -------------------------------------------------------------------
   getJSON / getText never throw: they return {ok, value} or {ok: false, error}
   so one bad file only breaks the app that needs it. Content is fetched with
   cache "no-cache" so a weekly update shows up on the next visit.

   Paths in content/*.json are relative to the site folder (the one holding
   index.html); paths inside a week folder are relative to that week folder. */
export const SITE = new URL("../../../", import.meta.url);
export const CONTENT = new URL("content/", SITE);

const cache = new Map();
export const short = url => String(url).replace(SITE.href, "");

function get(url, kind) {
  const key = kind + " " + url;
  if (!cache.has(key)) cache.set(key, (async () => {
    try {
      const r = await fetch(url, { cache: "no-cache" });
      if (!r.ok) return { ok: false, error: `${short(url)} (${r.status})` };
      const text = await r.text();
      if (kind === "text") return { ok: true, value: text };
      try { return { ok: true, value: JSON.parse(text) }; }
      catch (e) { return { ok: false, error: `${short(url)}: ${e.message}` }; }
    } catch (e) { return { ok: false, error: `${short(url)}: ${e.message}` }; }
  })());
  return cache.get(key);
}
export const getJSON = url => get(String(url), "json");
export const getText = url => get(String(url), "text");

/* resolve a content path; "#" means "not configured yet" and is kept as is. Only
   web (http, https) and mailto addresses are allowed; anything else becomes null */
export function resolve(path, base) {
  if (typeof path !== "string" || !path.trim()) return null;
  path = path.trim();
  if (path === "#") return "#";
  if (path.startsWith("/") && !path.startsWith("//")) {
    console.warn(`Path "${path}" starts with "/"; it is read as relative to the site folder instead.`);
    path = path.slice(1); base = SITE;
  }
  try { const u = new URL(path, base); return /^(https?|mailto):$/.test(u.protocol) ? u.href : null; } catch (e) { return null; }
}
export const isExternal = url => { try { return new URL(url).origin !== location.origin; } catch (e) { return false; } };
