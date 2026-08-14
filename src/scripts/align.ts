// The reveal interaction. Single source of truth is src/lib/chords.ts: every
// chord label on the page is (re)derived here from a tonic, never looked up
// per song, so "align" only has to change one number — the shared key — and
// all five songs snap to identical chords. The Roman-numeral row is rendered
// once in the markup and deliberately never touched here: it is the invariant.
//
// Audio is Phase 3. The [data-play] buttons are left inert on purpose.

import { SONGS } from "../data/songs";
import { ALIGN_KEY, chordLabelsForTonic, type Degree } from "../lib/chords";

const DEGREES: Degree[] = ["I", "V", "vi", "IV"];

const stage = document.querySelector<HTMLElement>("[data-stage]");
const keySelect = document.querySelector<HTMLSelectElement>("[data-key-select]");
const alignButton = document.querySelector<HTMLButtonElement>("[data-align]");
const resetButton = document.querySelector<HTMLButtonElement>("[data-reset]");
const status = document.querySelector<HTMLElement>("[data-align-status]");

// Unaligned = each song in its own released key. Aligned = every song forced
// onto one shared key, which is what makes them collapse into the same chords.
let aligned = false;
let sharedKey = ALIGN_KEY;

function songElement(title: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-song="${CSS.escape(title)}"]`,
  );
}

function render(): void {
  for (const song of SONGS) {
    const el = songElement(song.title);
    if (!el) continue;

    const key = aligned ? sharedKey : song.tonic;
    const labels = chordLabelsForTonic(key);

    DEGREES.forEach((degree, index) => {
      const cell = el.querySelector<HTMLElement>(
        `[data-testid="chords"] [data-degree="${degree}"] [data-chord-label]`,
      );
      if (cell) cell.textContent = labels[index];
    });

    el.dataset.currentKey = key;
    const keyLabel = el.querySelector<HTMLElement>("[data-current-key-label]");
    if (keyLabel) keyLabel.textContent = key;
  }

  if (stage) stage.dataset.aligned = String(aligned);
  if (status) {
    status.textContent = aligned
      ? `${sharedKey} major — identical`
      : "their own keys";
  }
}

function alignTo(key: string): void {
  aligned = true;
  sharedKey = key;
  if (keySelect) keySelect.value = key;
  render();
}

function splitApart(): void {
  aligned = false;
  if (keySelect) keySelect.value = "__none__";
  render();
}

keySelect?.addEventListener("change", () => {
  const value = keySelect.value;
  if (value === "__none__") {
    splitApart();
  } else {
    alignTo(value);
  }
});

alignButton?.addEventListener("click", () => alignTo(ALIGN_KEY));
resetButton?.addEventListener("click", splitApart);

// Draw the initial (unaligned) state from the module rather than trusting the
// server-rendered text, so the client and the pure logic can never disagree.
render();
