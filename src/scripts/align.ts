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

// The 12 transpose targets, in the SAME order the range slider steps through
// and the same order index.astro's <select> lists — index 0 = "C" … 11 = "B".
// The slider maps its integer value straight into this array, so slider
// position and rendered key can never disagree. (Mirrors chords.ts's internal
// TONIC_SPELLING_BY_PITCH_CLASS, but the markup order is the contract here.)
const KEYS = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

const stage = document.querySelector<HTMLElement>("[data-stage]");
const keySelect = document.querySelector<HTMLSelectElement>("[data-key-select]");
const keySlider = document.querySelector<HTMLInputElement>("[data-key-slider]");
const keyReadout = document.querySelector<HTMLElement>("[data-key-readout]");
const alignButton = document.querySelector<HTMLButtonElement>("[data-align]");
const resetButton = document.querySelector<HTMLButtonElement>("[data-reset]");
const status = document.querySelector<HTMLElement>("[data-align-status]");

// Unaligned = each song in its own released key. Aligned = every song forced
// onto one shared key, which is what makes them collapse into the same chords.
let aligned = false;
let sharedKey = ALIGN_KEY;
// Skip the "snap" on the very first (server-state) paint; only animate real
// aligns and splits the visitor triggers.
let hasRendered = false;

function songElement(title: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-song="${CSS.escape(title)}"]`,
  );
}

// Keep the slider thumb, its aria-valuetext (so screen readers announce the
// key name, not "5 of 11"), and the visible readout in step with the shared
// key whenever it changes — including aligns driven by the select or button,
// not just by scrubbing the slider itself.
function reflectSlider(key: string): void {
  const index = KEYS.indexOf(key as (typeof KEYS)[number]);
  if (index === -1) return;
  if (keySlider) {
    keySlider.value = String(index);
    keySlider.setAttribute("aria-valuetext", `${key} major`);
  }
  if (keyReadout) keyReadout.textContent = `${key} major`;
}

// `animate` gates ONLY the CSS "snap" retrigger. Every scrub step passes
// false so the labels roll smoothly through keys without strobing; aligns and
// splits keep the default (true) and still snap exactly as before.
function render(animate = true): void {
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

  if (stage) {
    stage.dataset.aligned = String(aligned);
    // Retrigger the CSS "snap" animation: drop the attribute, force a reflow,
    // then re-add it so the keyframes restart on every align and every split.
    if (animate && hasRendered) {
      stage.removeAttribute("data-snapping");
      stage.getBoundingClientRect();
      stage.setAttribute("data-snapping", "");
    }
  }
  if (status) {
    status.textContent = aligned
      ? `${sharedKey} major — identical`
      : "their own keys";
  }
  hasRendered = true;
}

function alignTo(key: string, animate = true): void {
  aligned = true;
  sharedKey = key;
  if (keySelect) keySelect.value = key;
  reflectSlider(key);
  render(animate);
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

// The key-morph slider: every integer step maps to KEYS[value] and drives the
// EXISTING alignTo() path — no parallel transpose. `input` fires continuously
// while dragging, so the chords roll through each key together; we pass
// animate=false to suppress the per-step snap (strobing). `change` (thumb
// released) settles with a single default snap.
keySlider?.addEventListener("input", () => {
  const key = KEYS[Number(keySlider.value)];
  if (key) alignTo(key, false);
});
keySlider?.addEventListener("change", () => {
  const key = KEYS[Number(keySlider.value)];
  if (key) alignTo(key);
});

// Draw the initial (unaligned) state from the module rather than trusting the
// server-rendered text, so the client and the pure logic can never disagree.
render();
