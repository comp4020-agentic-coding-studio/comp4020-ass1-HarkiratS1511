// Chord-role explainer — the *tap* layer, plus the cross-song degree lighting
// that rides on top of it.
//
// Each chord plays the same degree-based role in every key (I = home,
// V = tension, vi = the turn, IV = the lift), so the copy is constant per
// degree and rendered once in the markup. Hover and keyboard focus reveal the
// role purely in CSS (:hover / :focus-within), which needs no JavaScript. This
// script adds the two things CSS can't do alone:
//
//   1. A touch tap that *pins* the role open and toggles it, with taps
//      elsewhere (or another chord, or Escape) closing it. Keeps
//      aria-expanded in sync for assistive tech, never traps focus, and
//      never writes the role text or touches [data-chord-label] (align.ts
//      owns that).
//   2. Cross-song degree lighting — the actual thesis, made interactive.
//      Hovering, focusing, or pinning any one chord sets a single attribute
//      on the stage, [data-lit-degree], naming that chord's degree (I, V,
//      vi, or IV). CSS alone fans that out to the matching cell in *every*
//      song's row, so touching one "V" visibly lights up the V in all five
//      songs at once — the same slot recurs everywhere, not just here.
//
// Isolated module scope (like keygloss.ts) so nothing here leaks into the
// global scope this file would otherwise contribute to.
export {};

const OPEN_ATTR = "data-open";
const LIT_ATTR = "data-lit-degree";

const cells = Array.from(
  document.querySelectorAll<HTMLElement>("[data-chord-cell]"),
);

const stage = document.querySelector<HTMLElement>("[data-stage]");

function toggleButton(cell: HTMLElement): HTMLElement | null {
  return cell.querySelector<HTMLElement>("[data-chord-toggle]");
}

// Transient highlight source: whichever chord is currently hovered or
// keyboard-focused. It takes precedence over whatever's pinned for as long
// as it's active, and is only ever cleared by the same cell losing hover/
// focus — so a stray pointerleave from a *different* cell (e.g. the pointer
// crossing one chord on its way to another) can never clobber it or a pin.
let hoveredCell: HTMLElement | null = null;

// Recompute the stage-wide lit degree from, in priority order: the
// transiently hovered/focused chord, else whichever chord is pinned open,
// else nothing. One attribute on [data-stage] is all CSS needs to fan the
// highlight out across all five songs — no per-cell class churn from here.
function updateLitDegree(): void {
  if (!stage) return;
  const source =
    hoveredCell ?? cells.find((cell) => cell.hasAttribute(OPEN_ATTR));
  const degree = source?.dataset.degree;
  if (degree) {
    stage.setAttribute(LIT_ATTR, degree);
  } else {
    stage.removeAttribute(LIT_ATTR);
  }
}

function setOpen(cell: HTMLElement, open: boolean): void {
  if (open) {
    cell.setAttribute(OPEN_ATTR, "");
  } else {
    cell.removeAttribute(OPEN_ATTR);
  }
  toggleButton(cell)?.setAttribute("aria-expanded", String(open));
  updateLitDegree();
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

  // Hover/focus lights this chord's degree everywhere for as long as the
  // pointer or keyboard stays on it. pointerenter/pointerleave/focusin/
  // focusout don't bubble from descendants in a way that double-fires here
  // (one pair of listeners per cell is enough), and each only clears the
  // highlight if *it* was the one that set it.
  cell.addEventListener("pointerenter", () => {
    hoveredCell = cell;
    updateLitDegree();
  });
  cell.addEventListener("pointerleave", () => {
    if (hoveredCell === cell) hoveredCell = null;
    updateLitDegree();
  });
  cell.addEventListener("focusin", () => {
    hoveredCell = cell;
    updateLitDegree();
  });
  cell.addEventListener("focusout", () => {
    if (hoveredCell === cell) hoveredCell = null;
    updateLitDegree();
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
