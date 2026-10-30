/* ---- Dialogs -------------------------------------------------------------------------------
   Small dialogs on the computer's screen: a confirm (Reset this computer), a
   notice, and the "you are leaving the intranet" step before a colleague's
   chat or an outside link opens in a new tab. That step's Continue button
   is a real link, so the browser never blocks the new tab. A link set to
   "#" has not been configured yet and only shows a notice.             */
import { $, el, icon } from "../core/dom.js";
import { t } from "../core/i18n.js";
import * as layer from "../core/layer.js";

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

/* kind: "chat" (a colleague's bot) or "link" (a file or page on another site) */
export function openExternal({ url, kind = "link", name = "" }) {
  if (!url || url === "#") return notice({ title: t("external.unsetTitle"), text: t(kind === "chat" ? "external.unsetChat" : "external.unsetLink", { name }) });
  const go = el("a.btn.primary", { href: url, target: "_blank", rel: "noopener noreferrer" }, el("span", { text: t("external.continue") }), icon("external-link", 16));
  const back = el("button.btn", { type: "button", text: t("common.cancel") });
  const h = dialog({ iconName: kind === "chat" ? "message-circle" : "external-link", actions: [back, go],
    title: t(kind === "chat" ? "external.chatTitle" : "external.linkTitle", { name }), text: t(kind === "chat" ? "external.chatText" : "external.linkText", { name }) });
  go.addEventListener("click", () => setTimeout(() => h.close(), 0));
  back.addEventListener("click", () => h.close());
}
