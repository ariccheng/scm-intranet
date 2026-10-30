/* ---- Supplier card file -----------------------------------------------------------------------
   A Rolodex with one card per supplier in company.json "suppliers": the
   name, what they supply and where from. One card shows at a time; the
   buttons or the arrow keys flip through them, round and round. Every card
   stays in the page as a list, so a screen reader can read them all.
   The contact person, phone and email (all fictional) are typed on the
   card as plain text, never as call or mail links: the block is a button,
   and pressing it says that supplier contact goes through Procurement, in
   a polite live region under the cards. Prices, lead times and contract
   terms are deliberately left out.                                    */
import { el, icon } from "../core/dom.js";
import { t } from "../core/i18n.js";

export function render(panel, ctx) {
  const list = (Array.isArray(ctx.world.company.suppliers) ? ctx.world.company.suppliers : []).filter(s => s && typeof s.name === "string" && s.name.trim());
  const box = el("article.rolo", { "aria-labelledby": "rolo-title" }, el("h2.rolo-title", { id: "rolo-title", text: t("suppliers.title") }));
  panel.append(box);
  if (!list.length) { box.append(el("p.rolo-empty", { text: t("suppliers.empty") })); return; }

  const str = v => (typeof v === "string" ? v.trim() : "");
  const row = (k, v) => (v ? el("div", {}, el("dt", { text: t(k) }), el("dd", { text: v })) : null);
  /* an email address may wrap after its "@" on a narrow card */
  const wrapAt = v => { const i = v.indexOf("@"); return i > 0 ? [v.slice(0, i + 1), el("wbr"), v.slice(i + 1)] : v; };
  const line = (k, v) => (v ? el("span.rolo-line", {}, el("span.rolo-key", { text: t(k) }), el("span.rolo-val", {}, wrapAt(v))) : null);
  const note = el("p.rolo-notice", { role: "status", "aria-live": "polite" });
  const contact = s => {
    if (!str(s.contact) && !str(s.phone) && !str(s.email)) return null;
    const label = `${t("suppliers.contactAt", { name: s.name.trim() })}: ${[str(s.contact), str(s.phone), str(s.email)].filter(Boolean).join(", ")}`;
    const b = el("button.rolo-contact", { type: "button", "aria-label": label }, line("suppliers.contact", str(s.contact)), line("suppliers.phone", str(s.phone)), line("suppliers.email", str(s.email)));
    b.addEventListener("click", () => { note.textContent = ""; requestAnimationFrame(() => { note.textContent = t("suppliers.procurement"); }); });
    return b;
  };
  const cards = list.map(s => el("li.rolo-card", {}, el("span.rolo-tab", { "aria-hidden": "true", text: s.name.trim().charAt(0).toUpperCase() }),
    el("h3.rolo-name", { text: s.name }), el("dl.rolo-fields", {}, row("suppliers.supplies", str(s.supplies)), row("suppliers.from", str(s.from))), contact(s)));
  const pos = el("p.rolo-pos", { "aria-live": "polite" });
  const prev = el("button.icon-btn.rolo-btn", { type: "button", "aria-label": t("suppliers.prev") }, icon("chevron-left", 20));
  const next = el("button.icon-btn.rolo-btn", { type: "button", "aria-label": t("suppliers.next") }, icon("chevron-right", 20));
  let cur = 0;
  const show = (i, dir) => {
    cur = (i + cards.length) % cards.length;
    cards.forEach((c, j) => {
      c.classList.toggle("on", j === cur); c.classList.remove("turn-next", "turn-prev");
      const b = c.querySelector(".rolo-contact"); if (b) b.tabIndex = j === cur ? 0 : -1;   // only the card in front takes focus
    });
    if (dir) { void cards[cur].offsetWidth; cards[cur].classList.add(dir > 0 ? "turn-next" : "turn-prev"); }
    pos.textContent = t("suppliers.position", { n: cur + 1, total: cards.length });
    note.textContent = "";
  };
  prev.addEventListener("click", () => show(cur - 1, -1));
  next.addEventListener("click", () => show(cur + 1, 1));
  /* flipping from a card's contact block moves focus to the same block on the new card, so it never sits on a hidden card */
  box.addEventListener("keydown", e => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const inCard = e.target.closest && e.target.closest(".rolo-card");
    show(cur + dir, dir);
    if (inCard) (cards[cur].querySelector(".rolo-contact") || next).focus();
  });
  box.append(el("div.rolo-stage", {}, el("ul.rolo-cards", {}, cards), el("span.rolo-base", { "aria-hidden": "true" })), note,
    cards.length > 1 ? el("div.rolo-nav", {}, prev, pos, next) : null,
    cards.length > 1 ? el("p.rolo-hint", { text: t("suppliers.hint") }) : null);
  show(0);
  return { initial: () => (cards.length > 1 ? next : null) };
}
