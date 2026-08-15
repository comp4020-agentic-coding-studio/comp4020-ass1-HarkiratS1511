// Chord-role explainer — the *tap* layer only.
//
// Each chord plays the same degree-based role in every key (I = home,
// V = tension, vi = the turn, IV = the lift), so the copy is constant per
// degree and rendered once in the markup. Hover and keyboard focus reveal the
// role purely in CSS (:hover / :focus-within), which needs no JavaScript. This
// script adds the one thing CSS can't: a touch tap that *pins* the role open
// and toggles it, with taps elsewhere (or another chord, or Escape) closing it.
// It keeps aria-expanded in sync for assistive tech, never traps focus, and
// never writes the role text or touches [data-chord-label] (align.ts owns that).

const OPEN_ATTR = "data-open";

const cells = Array.from(
  document.querySelectorAll<HTMLElement>("[data-chord-cell]"),
);

function toggleButton(cell: HTMLElement): HTMLElement | null {
  return cell.querySelector<HTMLElement>("[data-chord-toggle]");
}

function setOpen(cell: HTMLElement, open: boolean): void {
  if (open) {
    cell.setAttribute(OPEN_ATTR, "");
  } else {
    cell.removeAttribute(OPEN_ATTR);
  }
  toggleButton(cell)?.setAttribute("aria-expanded", String(open));
}

// Close every pinned-open chord except an optional one being (re)opened.
function closeAll(except?: HTMLElement): void {
  for (const cell of cells) {
    if (cell !== except && cell.hasAttribute(OPEN_ATTR)) setOpen(cell, false);
  }
}

for (const cell of cells) {
  const button = toggleButton(cell);
  if (!button) continue;

  // Enter/Space fire click natively, so this covers keyboard activation too;
  // a fresh tap on an already-open chord closes it (toggle semantics).
  button.addEventListener("click", () => {
    const wasOpen = cell.hasAttribute(OPEN_ATTR);
    closeAll(cell);
    setOpen(cell, !wasOpen);
  });
}

// A tap/click outside any chord dismisses the pinned role; pointerdown fires
// before the click that would re-open it, and taps inside a chord are ignored.
document.addEventListener("pointerdown", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("[data-chord-cell]")) return;
  closeAll();
});

// Escape closes without moving focus — the buttons stay in normal tab order.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAll();
});
