/* ---- Email file header ------------------------------------------------------------
   An email file starts with a header between two "---" lines:

     ---
     id: w01-welcome
     fromPersonId: jordan-lee
     subject: Welcome to {company}
     sentAt: Mon 08:30
     attachments: [w01-handbook]
     ---

   fromPersonId is an id from people.json (the CEO is daniel-alvarez);
   sentAt is a time in the email's week ("Thu 12:00") or "W3 Fri 17:00".
   Values may be quoted. Lists are [a, b] on one line or "- item" lines below
   an empty key. Lines starting with # are comments.                          */
const unquote = v => (/^(["']).*\1$/.test(v) ? v.slice(1, -1) : v);

export function parseFrontMatter(text) {
  const lines = String(text).replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  if (lines[0].trim() !== "---") return { data: null, body: lines.join("\n"), error: 'the file must start with a "---" line' };
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end < 0) return { data: null, body: "", error: 'the header has no closing "---" line' };
  const data = {};
  let listKey = null;
  for (const raw of lines.slice(1, end)) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && listKey) { data[listKey].push(unquote(item[1].trim())); continue; }
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim(), v = line.slice(i + 1).trim();
    if (v === "") { data[key] = []; listKey = key; continue; }
    listKey = null;
    data[key] = /^\[.*\]$/.test(v) ? v.slice(1, -1).split(",").map(s => unquote(s.trim())).filter(Boolean) : unquote(v);
  }
  return { data, body: lines.slice(end + 1).join("\n").replace(/^\n+/, ""), error: null };
}
