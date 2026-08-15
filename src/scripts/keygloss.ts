// Key-term gloss — the *tap* layer only.
//
// Each song's "key of X" readout carries a plain-language gloss on what a key
// is. Hover and keyboard focus reveal it purely in CSS (:hover / :focus-within),
// which needs no JavaScript. This script adds the one thing CSS can't: a touch
// tap that *pins* the gloss open and toggles it, with taps elsewhere (or another
// gloss, or Escape) closing it. It keeps aria-expanded in sync for assistive
// tech, never traps focus, and never writes into [data-current-key-label]
// (align.ts owns that). It mirrors roles.ts so the two behave identically.

// Isolated module scope so these top-level names don't collide with roles.ts,
// which shares the same globals-based pattern.
export {};

const OPEN_ATTR = "data-open";

const glosses = Array.from(
  document.querySelectorAll<HTMLElement>("[data-keygloss]"),
);

function toggleButton(gloss: HTMLElement): HTMLElement | null {
  return gloss.querySelector<HTMLElement>("[data-keygloss-toggle]");
}

function setOpen(gloss: HTMLElement, open: boolean): void {
  if (open) {
    gloss.setAttribute(OPEN_ATTR, "");
  } else {
    gloss.removeAttribute(OPEN_ATTR);
  }
  toggleButton(gloss)?.setAttribute("aria-expanded", String(open));
}

// Close every pinned-open gloss except an optional one being (re)opened.
function closeAll(except?: HTMLElement): void {
  for (const gloss of glosses) {
    if (gloss !== except && gloss.hasAttribute(OPEN_ATTR)) setOpen(gloss, false);
  }
}

for (const gloss of glosses) {
  const button = toggleButton(gloss);
  if (!button) continue;

  // Enter/Space fire click natively, so this covers keyboard activation too;
  // a fresh tap on an already-open gloss closes it (toggle semantics).
  button.addEventListener("click", () => {
    const wasOpen = gloss.hasAttribute(OPEN_ATTR);
    closeAll(gloss);
    setOpen(gloss, !wasOpen);
  });
}

// A tap/click outside any gloss dismisses the pinned tip; pointerdown fires
// before the click that would re-open it, and taps inside a gloss are ignored.
document.addEventListener("pointerdown", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("[data-keygloss]")) return;
  closeAll();
});

// Escape closes without moving focus — the buttons stay in normal tab order.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAll();
});
