/* ---- Markdown ---------------------------------------------------------------------
   A small, safe subset for emails: paragraphs (a single line break stays a
   line break), # to ### headings, - and 1. lists, > quotes, --- rules,
   `code`, **bold**, *italic*, [links](url) and <https://autolinks>.
   Everything is escaped first, so HTML in a file shows as text. Links may
   only be http(s), mailto or relative; links to other sites carry
   data-external so the computer can say "you are leaving the intranet".
   {tokens} are filled in after rendering, with escaped values.            */
import { resolve, isExternal } from "./load.js";

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = s => String(s).replace(/[&<>"']/g, c => ESC[c]);
const unesc = s => s.replace(/&(amp|lt|gt|quot|#39);/g, m => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" }[m]));

function link(text, rawUrl, base) {
  const u = unesc(rawUrl).trim();
  if (!/^(https?:|mailto:)/i.test(u) && /^[a-z][a-z0-9+.-]*:/i.test(u)) return text;   // javascript:, data: ... -> plain text
  const href = u === "#" ? "#" : resolve(u, base);
  if (!href) return text;
  const ext = href !== "#" && !href.startsWith("mailto:") && isExternal(href);
  return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer"${ext ? " data-external" : ""}${href === "#" ? " data-unset" : ""}>${text}</a>`;
}

function inline(s, base) {
  const keep = [];
  const hold = html => `\u0000${keep.push(html) - 1}\u0000`;
  s = esc(s)
    .replace(/`([^`]+)`/g, (m, c) => hold(`<code>${c}</code>`))
    .replace(/\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, (m, txt, url) => hold(link(txt, url, base)))
    .replace(/&lt;((?:https?:\/\/|mailto:)[^\s]+?)&gt;/g, (m, url) => hold(link(url, url, base)))
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*(?=\S)(.+?)(?<=\S)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^\w])_(?=\S)(.+?)(?<=\S)_(?!\w)/g, "$1<em>$2</em>");
  for (let i = 0; i < 3 && s.includes("\u0000"); i++) s = s.replace(/\u0000(\d+)\u0000/g, (m, n) => keep[+n]);
  return s;
}

export function render(md, { base, tokens = {} } = {}) {
  const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let para = [], list = null, quote = [];
  const flushPara = () => { if (para.length) out.push(`<p>${para.map(l => inline(l, base)).join("<br>")}</p>`); para = []; };
  const flushList = () => {
    if (list) out.push(`<${list.tag}${list.start > 1 ? ` start="${list.start}"` : ""}>${list.items.map(i => `<li>${inline(i, base)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  const flushQuote = () => { if (quote.length) out.push(`<blockquote>${render(quote.join("\n"), { base })}</blockquote>`); quote = []; };
  const flush = () => { flushPara(); flushList(); flushQuote(); };
  for (const line of lines) {
    let m;
    if (/^>\s?/.test(line)) { flushPara(); flushList(); quote.push(line.replace(/^>\s?/, "")); continue; }
    flushQuote();
    if (!line.trim()) { flushPara(); continue; }   // a list stays open across blank lines
    if (list && !/^\s*([-*+]|\d+[.)])\s+/.test(line) && !/^\s{2,}\S/.test(line)) flushList();
    if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) { flush(); out.push(`<h${m[1].length + 2}>${inline(m[2], base)}</h${m[1].length + 2}>`); continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flush(); out.push("<hr>"); continue; }
    if ((m = /^\s*[-*+]\s+(.*)$/.exec(line)) || (m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
      const tag = /^\s*\d/.test(line) ? "ol" : "ul";
      flushPara();
      if (list && list.tag !== tag) flushList();
      (list ||= { tag, items: [], start: tag === "ol" ? parseInt(line, 10) : 1 }).items.push(m[1]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) { list.items[list.items.length - 1] += " " + line.trim(); continue; }
    flushList();
    para.push(line);
  }
  flush();
  return fill(out.join("\n"), tokens);
}

/* fill {tokens} in rendered HTML or in plain text meant for textContent */
export const fill = (html, tokens) => html.replace(/\{(\w+)\}/g, (m, k) => (k in tokens ? esc(tokens[k]) : m));
