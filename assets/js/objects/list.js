/* ---- What is on the desk ---------------------------------------------------------------------
   The objects that are always there, the newspaper (once an open week has a
   headline) and the papers a week folder leaves on the desk (desk.json,
   type "memo" or "flyer"). The desk scene and the phone layout's Desk tab
   both draw from this list, so they always show the same things.       */
export const TYPES = {
  sticky: { file: "sticky", icon: "sticky-note" }, badge: { file: "badge", icon: "id-card" }, phone: { file: "phone", icon: "smartphone" },
  notebook: { file: "notebook", icon: "notebook-pen" }, calendar: { file: "term-calendar", icon: "calendar-days" }, coffee: { file: "coffee", icon: "coffee" },
  menu: { file: "menu", icon: "utensils" }, map: { file: "store-map", icon: "map" }, suppliers: { file: "suppliers", icon: "contact" },
  newspaper: { file: "newspaper", icon: "newspaper", when: w => w.news.items.length > 0 },
  memo: { file: "memo", icon: "file-text", weekly: true }, flyer: { file: "flyer", icon: "megaphone", weekly: true }
};
const FIXED = ["sticky", "badge", "phone", "notebook", "calendar", "coffee", "menu", "map", "suppliers", "newspaper"];

/* [{id, type, item}]; item is the desk.json entry for papers from a week folder.
   A spot holds one paper: when two open weeks use the same spot, the newer week's paper stays */
export function deskList(world) {
  const fixed = FIXED.filter(id => !TYPES[id].when || TYPES[id].when(world)).map(id => ({ id, type: id, item: null }));
  const bySpot = new Map();
  for (const d of world.desk.items) {
    if (!TYPES[d.type]?.weekly) { world.desk.errors.push(`desk.json: "${d.id}" has unknown type "${d.type}" (use memo or flyer)`); continue; }
    const old = bySpot.get(d.spot);
    if (old && old.week > d.week) continue;
    if (old) console.info(`desk.json: "${d.id}" (week ${d.week}) takes spot "${d.spot}" from "${old.id}" (week ${old.week})`);
    bySpot.set(d.spot, d);
  }
  return [...fixed, ...[...bySpot.values()].map(d => ({ id: d.id, type: d.type, item: d }))];
}
