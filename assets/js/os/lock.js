/* ---- Lock screen ----------------------------------------------------------------------
   Shows the date and time at the company over the company wallpaper and asks for
   the student's name. This is not a real sign-in: the name is kept in this
   browser only and used to greet the student in mail. On a later visit the
   name is filled in and the greeting says "Welcome back".              */
import { el } from "../core/dom.js";
import { t } from "../core/i18n.js";
import * as store from "../core/store.js";
import * as time from "../core/simtime.js";

export function renderLock(root, logo, onSignIn) {
  const saved = store.get("name", "", store.isStr);
  const clockT = el("p.lock-time"), clockD = el("p.lock-date");
  const input = el("input.lock-input", { id: "lock-name", type: "text", name: "name", autocomplete: "given-name", maxlength: "40",
    spellcheck: "false", "aria-describedby": "lock-note lock-err" });
  input.value = saved;
  const err = el("p.lock-err", { id: "lock-err", "aria-live": "polite" });
  const form = el("form.lock-form", { novalidate: true },
    el("label.lock-label", { for: "lock-name", text: t("lock.nameLabel") }),
    el("div.lock-row", {}, input, el("button.btn.primary.lock-go", { type: "submit", text: t("lock.signIn") })),
    err, el("p.lock-note", { id: "lock-note", text: t("lock.note") }));
  root.replaceChildren(el("div.lock-card", {}, logo, clockT, clockD,
    el("h1.lock-greet", { text: saved ? t("lock.welcomeBack", { name: saved }) : t("lock.welcome") }), form));

  form.addEventListener("submit", e => {
    e.preventDefault();
    const v = input.value.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!v) { err.textContent = t("lock.empty"); input.setAttribute("aria-invalid", "true"); input.focus(); return; }
    input.removeAttribute("aria-invalid");
    err.textContent = "";
    store.set("name", v);
    onSignIn(v);
  });
  const tick = () => { const now = time.now(); clockT.textContent = time.fmtTime(now); clockD.textContent = time.fmtLong(now); };
  tick();
  return { tick, focus: () => input.focus({ preventScroll: true }) };
}
