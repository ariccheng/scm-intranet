/* ---- Colour checks ---------------------------------------------------------------
   The accent comes from company.json, so it is checked at start-up: white text
   on it and the accent itself on the page background must both reach 4.5:1.
   If not, it is darkened in small steps until both do.                     */
const hex = h => /^#?([0-9a-f]{6})$/i.exec(h || "")?.[1];
const rgb = h => [0, 2, 4].map(i => parseInt(hex(h).slice(i, i + 2), 16));
const lum = h => {
  const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * r + .7152 * g + .0722 * b;
};
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const darken = (h, f) => "#" + rgb(h).map(v => Math.round(v * (1 - f)).toString(16).padStart(2, "0")).join("");

export function safeAccent(h, bg = "#FAFAFA") {
  if (!hex(h)) return null;
  let c = "#" + hex(h);
  for (let i = 0; i < 30 && (contrast("#FFFFFF", c) < 4.5 || contrast(c, bg) < 4.5); i++) c = darken(c, .06);
  return c;
}

/* initials avatars: muted slate, teal, plum, clay, navy, olive, sand and rose that sit quietly next to the greys;
   white text on each of these is at least 5.9:1 */
const AVATAR = ["#4A5A6A", "#3D6B6B", "#6A4C63", "#8A4B35", "#36506B", "#5E6338", "#6B5B45", "#864657"];
export function avatarColor(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR[h % AVATAR.length];
}
export const initials = name => String(name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
