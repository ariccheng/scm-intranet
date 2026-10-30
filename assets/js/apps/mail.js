/* ---- Mail ---------------------------------------------------------------------------------
   Three panes: folders, the message list, the reading pane. Unread mail is
   bold; opening a message marks it read (kept in this browser). Bodies are
   Markdown; attachments are file cards. There is no compose: Reply opens
   the sender's chat when they can be reached this week, and says why not
   otherwise. In a narrow window the panes stack: the list, then the
   message with a Back button. open(id) shows one message directly.     */
import { el, icon, bus, stateBox } from "../core/dom.js";
import { t, has, interpolate } from "../core/i18n.js";
import * as store from "../core/store.js";
import * as time from "../core/simtime.js";
import { render } from "../core/markdown.js";
import { announce } from "../core/layer.js";
import { fileLink, avatar, partError, guardLinks, tokens } from "./common.js";

export function mount(body, ctx) {
  const { world } = ctx, items = world.mail.items;
  if (!items.length && world.mail.errors.length)
    return void body.replaceChildren(stateBox({ name: "mail", kind: "error", title: t("error.partTitle"), text: t("error.app"), details: world.mail.errors }));

  const folders = [...new Set(["inbox", ...items.map(m => m.folder)])];
  const folderName = f => (has("mail.folder." + f) ? t("mail.folder." + f) : f.charAt(0).toUpperCase() + f.slice(1));
  const read = () => store.get("mailRead", {}, store.isObj);
  let folder = "inbox", sel = null;

  const nav = el("nav.mail-folders", { "aria-label": t("mail.folders") });
  const list = el("ul.mail-list", { "aria-label": t("mail.messages") });
  const reader = el("article.mail-reader", { "aria-live": "off" });
  const root = el("div.mail", { dataset: { view: "list" } }, nav, el("div.mail-col", {}, partError(world.mail.errors), list), reader);
  body.replaceChildren(root);
  guardLinks(reader, ctx);

  function drawFolders() {
    const r = read();
    nav.replaceChildren(...folders.map(f => {
      const n = items.filter(m => m.folder === f && !r[m.id]).length;
      const b = el("button.mail-folder", { type: "button", "aria-current": f === folder ? "true" : null },
        icon(f === "inbox" ? "inbox" : "folder", 16), el("span", { text: folderName(f) }), n ? el("span.count", { text: n }) : null);
      b.addEventListener("click", () => { folder = f; sel = null; drawAll(); nav.querySelector("[aria-current]")?.focus(); });
      return b;
    }));
  }

  function drawList() {
    const r = read(), mine = items.filter(m => m.folder === folder);
    if (!mine.length) { list.replaceChildren(el("li.mail-none", { text: t("mail.empty") })); return; }
    list.replaceChildren(...mine.map(m => {
      const p = ctx.person(m.from), unread = !r[m.id];
      const b = el("button.mail-item" + (unread ? ".unread" : ""), { type: "button", "aria-current": m.id === sel ? "true" : null },
        el("span.mail-line", {}, el("span.mail-from", { text: p ? p.name : t("mail.unknownSender") }), el("time.mail-time", { text: time.fmtDay(m.sentAt) })),
        el("span.mail-subject", {}, unread ? el("span.sr-only", { text: t("mail.unread") + ": " }) : null, interpolate(m.subject)));
      b.addEventListener("click", () => show(m.id, true));
      return el("li", {}, b);
    }));
  }

  function drawReader() {
    const m = items.find(x => x.id === sel);
    if (!m) { reader.replaceChildren(el("p.mail-pick", {}, icon("mail", 28), el("span", { text: t("mail.pick") }))); return; }
    const p = ctx.person(m.from), name = p ? p.name : t("mail.unknownSender"), url = p && p.contact === "email" ? undefined : ctx.botUrl(m.from);
    const back = el("button.btn.mail-back", { type: "button" }, icon("arrow-left", 16), el("span", { text: t("common.back") }));
    back.addEventListener("click", () => { root.dataset.view = "list"; list.querySelector("[aria-current]")?.focus(); });
    const reply = el("button.btn" + (url !== undefined ? ".primary" : ""), { type: "button", disabled: url === undefined, "aria-describedby": url === undefined ? "reply-why" : null },
      icon("reply", 16), el("span", { text: t("mail.reply") }));
    reply.addEventListener("click", () => ctx.openExternal({ url, kind: "chat", name, id: m.from }));
    const files = m.attachments.map(id => world.files.byId.get(id));
    const content = el("div.mail-body.prose");
    content.innerHTML = render(m.body, { base: m.base, tokens: tokens() });
    reader.replaceChildren(...[back,
      el("h3.mail-title", { tabindex: "-1", text: interpolate(m.subject) }),
      el("div.mail-head", {}, avatar(p, 40), el("div.mail-who", {},
        el("p", {}, el("strong", { text: name }), p && p.title ? el("span.muted", { text: " · " + p.title }) : null),
        el("p.muted", { text: `${t("mail.to")}: ${t("mail.toYou")} · ${time.fmtDate(m.sentAt)}, ${time.fmtTime(m.sentAt)}` }))),
      files.length ? el("section.mail-files", { "aria-label": t("mail.attachments") }, el("h4", {}, icon("paperclip", 14), el("span", { text: t("mail.attachments") })),
        el("div.file-row", {}, files.map((f, i) => f ? fileLink(ctx, f) : el("p.muted", { text: `${m.attachments[i]}: ${t("mail.attachmentMissing")}` })))) : null,
      content,
      el("div.mail-actions", {}, reply, url === undefined ? el("p.muted", { id: "reply-why", text: t(p && p.contact === "email" ? "mail.replyEmailOnly" : "mail.replyOff", { name }) }) : null)].filter(Boolean));
  }

  function drawAll() { drawFolders(); drawList(); drawReader(); }

  function show(id, user) {
    const m = items.find(x => x.id === id);
    if (!m) return;
    folder = m.folder; sel = id;
    const r = read();
    if (!r[id]) { r[id] = true; store.set("mailRead", r); bus.emit("mail:read"); }
    drawAll();
    root.dataset.view = "read";
    reader.scrollTop = 0;
    reader.querySelector(".mail-title").focus({ preventScroll: true });
    if (!user) announce(interpolate(m.subject));
  }

  drawAll();
  return { open: id => show(id, false) };
}
