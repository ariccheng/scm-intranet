/* ---- Files ------------------------------------------------------------------------------------
   Folders on the left (chips in a narrow window), files on the right. A
   click opens the file in a new tab; files on other sites go through the
   "leaving the intranet" dialog.                                        */
import { el, icon, stateBox } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { fileLink, partError } from "./common.js";

export function mount(body, ctx) {
  const { world } = ctx, files = world.files.items;
  if (!files.length && world.files.errors.length)
    return void body.replaceChildren(stateBox({ name: "folder", kind: "error", title: t("error.partTitle"), text: t("error.app"), details: world.files.errors }));

  const folders = [...new Set(files.map(f => f.folder).filter(Boolean))];
  let folder = "*";
  const nav = el("nav.files-folders", { "aria-label": t("files.folders") });
  const list = el("ul.files-list");

  function draw() {
    nav.replaceChildren(...[["*", t("files.all")], ...folders.map(f => [f, f])].map(([v, name]) => {
      const b = el("button.files-folder", { type: "button", "aria-current": v === folder ? "true" : null }, icon("folder", 16), el("span", { text: name }));
      b.addEventListener("click", () => { folder = v; draw(); nav.querySelector("[aria-current]")?.focus(); });
      return b;
    }));
    const shown = files.filter(f => folder === "*" || f.folder === folder);
    list.replaceChildren(...(shown.length ? shown.map(f => el("li", {}, fileLink(ctx, f, "file-row-item"),
      folder === "*" && f.folder ? el("span.files-in.muted", { text: f.folder }) : null)) : [el("li.files-none", {}, stateBox({ name: "folder", text: t("files.empty") }))]));
  }

  body.replaceChildren(el("div.files", {}, nav, el("div.files-col", {}, partError(world.files.errors), list)));
  draw();
}
