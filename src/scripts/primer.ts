// Primer Q&A — tap-to-reveal glossary cards.
//
// The primer's four definition cards used to show the question (term) and
// the full answer (definition) at once — a wall of text before the reader
// ever reaches the evidence below. This turns each answer into content that's
// hidden until the reader activates its question, so the primer opens short
// and grows only for the concepts a given reader actually needs.
//
// Unlike keygloss.ts / roles.ts (which pin one tooltip open at a time and
// close it on outside tap), these four toggles are independent: opening one
// card must not close another, and there's no overlay to dismiss by tapping
// elsewhere on the page — the reveal pushes the page down in place, so a tap
// on the table below it should do nothing to it. Escape is the one shared
// dismissal, closing whatever is open.
//
// Isolated module scope (like keygloss.ts and roles.ts) so nothing here
// leaks into the global scope this file would otherwise contribute to.
export {};

const OPEN_ATTR = "data-open";

const cards = Array.from(
  document.querySelectorAll<HTMLElement>("[data-primer-card]"),
);

function toggleButton(card: HTMLElement): HTMLElement | null {
  return card.querySelector<HTMLElement>("[data-primer-toggle]");
}

function setOpen(card: HTMLElement, open: boolean): void {
  if (open) {
    card.setAttribute(OPEN_ATTR, "");
  } else {
    card.removeAttribute(OPEN_ATTR);
  }
  toggleButton(card)?.setAttribute("aria-expanded", String(open));
}

for (const card of cards) {
  const button = toggleButton(card);
  if (!button) continue;

  // Enter/Space fire click natively, so this covers keyboard activation too.
  // Each card toggles independently — no closing the others on open.
  button.addEventListener("click", () => {
    setOpen(card, !card.hasAttribute(OPEN_ATTR));
  });
}

// Escape closes every open card without moving focus — the buttons stay in
// normal tab order. No pointerdown/outside-tap dismissal: these are inline
// expanding answers, not overlay tooltips, so a tap on the worked table below
// must not surprise-collapse them.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  for (const card of cards) setOpen(card, false);
});
