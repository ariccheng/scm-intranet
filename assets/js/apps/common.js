/* ---- Shared app parts -----------------------------------------------------------------------
   File cards (used by Mail and Files), avatars, the "some content could not
   be loaded" note, and link handling for rendered Markdown. A file stored
   in this site opens in a new tab directly; a file on another site goes
   through the "leaving the intranet" dialog; "#" is not set up yet.     */
import { el, icon } from "../core/dom.js";
import { t, has, getGlobal } from "../core/i18n.js";
import { isExternal } from "../core/load.js";
import { avatarColor, initials } from "../core/color.js";

const FILE_ICONS = { pdf: "file-text", doc: "file-text", sheet: "file-spreadsheet", slides: "presentation", csv: "file-spreadsheet", link: "link" };
export const fileType = f => (f.url === "#" ? t("files.notSet") : has("files.type." + f.type) ? t("files.type." + f.type) : "");

export function fileLink(ctx, f, cls = "file-card") {
  const kids = [el("span.file-icon", {}, icon(FILE_ICONS[f.type] || "file", 20)),
    el("span.file-meta", {}, el("span.file-name", { text: f.name }), el("span.file-type", { text: fileType(f) })),
    el("span.file-go", {}, icon("external-link", 15))];
  if (f.url && f.url !== "#" && !isExternal(f.url)) return el("a." + cls, { href: f.url, target: "_blank", rel: "noopener" }, kids);
  const b = el("button." + cls, { type: "button" }, kids);
  b.addEventListener("click", () => ctx.openExternal({ url: f.url, kind: "link" }));
  return b;
}

export function avatar(p, size = 36) {
  const style = { width: size + "px", height: size + "px", fontSize: Math.round(size * .38) + "px" };
  const letters = () => el("span.avatar", { "aria-hidden": "true", style: { ...style, background: avatarColor(p ? p.id : "?") }, text: initials(p ? p.name : "?") });
  if (!p || !p.avatar) return letters();
  const img = el("img.avatar", { src: p.avatar, alt: "", style });
  img.addEventListener("error", () => img.replaceWith(letters()), { once: true });
  return img;
}

export function partError(errors) {
  if (!errors || !errors.length) return null;
  return el("div.part-error", { role: "alert" }, icon("info", 16),
    el("div", {}, el("strong", { text: t("error.partTitle") }), el("p", { text: t("error.partText") }),
      el("ul", {}, errors.map(e => el("li", { text: e })))));
}

/* links inside rendered Markdown: outside links and unset ("#") links go through the dialog */
export function guardLinks(root, ctx) {
  root.addEventListener("click", e => {
    const a = e.target.closest("a[data-external], a[data-unset]");
    if (!a) return;
    e.preventDefault();
    ctx.openExternal({ url: a.hasAttribute("data-unset") ? "#" : a.href, kind: "link" });
  });
}

export const tokens = () => ({ name: getGlobal("name"), company: getGlobal("company"), week: getGlobal("week") });

/* a row of toggle buttons used as filters and view switches */
export function chips(options, current, onPick, label) {
  const row = el("div.chips", { role: "group", "aria-label": label });
  const paint = v => { for (const b of row.children) b.setAttribute("aria-pressed", String(b.dataset.v === v)); };
  for (const [v, text] of options) {
    const b = el("button.chip", { type: "button", dataset: { v }, text });
    b.addEventListener("click", () => { paint(v); onPick(v); });
    row.append(b);
  }
  paint(current);
  return row;
}
