/* ---- CSV ---------------------------------------------------------------------------
   Comma-separated, first row is the header, "quoted" fields may hold commas,
   line breaks and "" for a quote. A column counts as numeric when every
   non-empty cell parses as a number (commas, $ and % are allowed).        */
export function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  const s = String(text).replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"' && cell === "") q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const all = rows.filter(r => r.some(v => v.trim() !== ""));
  const header = all.shift() || [];
  const numeric = header.map((h, j) => all.length > 0 && all.every(r => (r[j] ?? "").trim() === "" || !isNaN(num(r[j]))));
  return { header, rows: all, numeric };
}
export const num = v => { const s = String(v).replace(/[$,%\s]/g, ""); return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s) ? Number(s) : NaN; };
