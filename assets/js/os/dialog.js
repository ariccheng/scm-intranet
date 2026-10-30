/* ---- Dialogs -------------------------------------------------------------------------------
   Small dialogs on the computer's screen: a confirm (Reset this computer), a
   notice, and the "you are leaving the intranet" step before a colleague's
   chat or an outside link opens in a new tab. That step's Continue button
   is a real link, so the browser never blocks the new tab. A link set to
   "#" has not been configured yet and only shows a notice.

   A colleague's chat opens in a window named after that colleague, so a
   second click goes back to the same chat instead of opening another. On
   a computer it is a narrow window at the right edge of the screen, beside
   the intranet; on a phone, a tab. The explanation (where the chat opens,
   the ASU sign-in) shows the first time only, unless the student unticks
   "Don't show this again" (kept in this browser).                      */
import { $, el, icon } from "../core/dom.js";
import { t } from "../core/i18n.js";
import * as layer from "../core/layer.js";
import * as store from "../core/store.js";

/* on the computer's screen, unless a desk object's close-up is open (it sits above the computer) */
const host = () => ($("#layer-root").children.length ? $("#layer-root") : $("#os"));

function dialog({ title, text, actions, iconName }) {
  const panel = el("div.dialog", {}, iconName ? el("span.dialog-icon", {}, icon(iconName, 22)) : null,
    el("h2.dialog-title", { text: title }), text ? el("p.dialog-text", { text }) : null, el("div.dialog-actions", {}, actions));
  return layer.open({ host: host(), panel, label: title, className: "dialog-layer" });
}

export function confirmDialog({ title, text, ok, danger }) {
  return new Promise(done => {
    let answer = false;
    const yes = el("button.btn." + (danger ? "danger" : "primary"), { type: "button", text: ok });
    const no = el("button.btn", { type: "button", text: t("common.cancel"), "data-autofocus": "" });
    const h = layer.open({ host: host(), className: "dialog-layer", label: title, onClose: () => done(answer),
      panel: el("div.dialog", {}, el("h2.dialog-title", { text: title }), el("p.dialog-text", { text }), el("div.dialog-actions", {}, no, yes)) });
    yes.addEventListener("click", () => { answer = true; h.close(); });
    no.addEventListener("click", () => h.close());
  });
}

export function notice({ title, text }) {
  const ok = el("button.btn.primary", { type: "button", text: t("common.ok") });
  const h = dialog({ title, text, actions: [ok], iconName: "info" });
  ok.addEventListener("click", () => h.close());
}

/* opens (or goes back to) a colleague's chat window; false if the browser blocked it */
const chats = new Map();
function launch(url, id) {
  const name = "saguaro-chat-" + String(id || url).replace(/[^\w-]/g, "");
  const open = chats.get(name);
  if (open && !open.closed) { open.focus(); return true; }
  let w = null;
  if (document.documentElement.dataset.layout === "desk") {
    const width = Math.min(480, screen.availWidth), left = (screen.availLeft || 0) + screen.availWidth - width;
    w = window.open(url, name, `popup,width=${width},height=${screen.availHeight},left=${left},top=${screen.availTop || 0}`);
  } else w = window.open(url, name);
  if (!w) return false;   // the opener link is kept: without it the browser cannot find this window again by name after a reload
  chats.set(name, w);
  return true;
}

function openChat({ url, name, id }) {
  if (store.get("chatIntroSeen", false, v => typeof v === "boolean") && launch(url, id)) return;
  const skip = el("input", { type: "checkbox", id: "chat-skip", checked: true });
  const go = el("a.btn.primary", { href: url, target: "_blank", rel: "noopener" }, el("span", { text: t("external.continue") }), icon("external-link", 16));
  const back = el("button.btn", { type: "button", text: t("common.cancel") });
  const h = dialog({ iconName: "message-circle", title: t("external.chatTitle", { name }), text: t("external.chatText", { name }),
    actions: [el("label.dialog-check", { for: "chat-skip" }, skip, el("span", { text: t("external.dontAsk") })), back, go] });
  go.addEventListener("click", e => {
    store.set("chatIntroSeen", skip.checked);
    if (launch(url, id)) e.preventDefault();   // otherwise the link itself opens a tab
    setTimeout(() => h.close(), 0);
  });
  back.addEventListener("click", () => h.close());
}

/* kind: "chat" (a colleague's bot; id is the person) or "link" (a file or page on another site) */
export function openExternal({ url, kind = "link", name = "", id = "" }) {
  if (!url || url === "#") return notice({ title: t("external.unsetTitle"), text: t(kind === "chat" ? "external.unsetChat" : "external.unsetLink", { name }) });
  if (kind === "chat") return openChat({ url, name, id });
  const go = el("a.btn.primary", { href: url, target: "_blank", rel: "noopener noreferrer" }, el("span", { text: t("external.continue") }), icon("external-link", 16));
  const back = el("button.btn", { type: "button", text: t("common.cancel") });
  const h = dialog({ iconName: "external-link", actions: [back, go],
    title: t("external.linkTitle"), text: t("external.linkText") });
  go.addEventListener("click", () => setTimeout(() => h.close(), 0));
  back.addEventListener("click", () => h.close());
}
