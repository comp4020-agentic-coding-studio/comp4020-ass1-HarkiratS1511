// The reveal interaction. Single source of truth is src/lib/chords.ts: every
// chord label on the page is (re)derived here from a tonic, never looked up
// per song, so "align" only has to change one number — the shared key — and
// all five songs snap to identical chords. The Roman-numeral row is rendered
// once in the markup and deliberately never touched here: it is the invariant.
//
// Audio is Phase 3. The [data-play] buttons are left inert on purpose.

import { SONGS } from "../data/songs";
import {
  ALIGN_KEY,
  chordLabelsForTonic,
  distinctChordNames,
  type Degree,
} from "../lib/chords";

const DEGREES: Degree[] = ["I", "V", "vi", "IV"];

const stage = document.querySelector<HTMLElement>("[data-stage]");
const keySelect = document.querySelector<HTMLSelectElement>("[data-key-select]");
const alignButton = document.querySelector<HTMLButtonElement>("[data-align]");
const resetButton = document.querySelector<HTMLButtonElement>("[data-reset]");
const status = document.querySelector<HTMLElement>("[data-align-status]");
const countEl = document.querySelector<HTMLElement>("[data-distinct-count]");
const captionEl = document.querySelector<HTMLElement>("[data-distinct-caption]");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
// Remember the last count we painted so we only pulse on a real change.
let lastCount: number | null = null;
let pulseTimer: ReturnType<typeof setTimeout> | undefined;

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

// The live "distinct chord count". Given the keys that just filled the cells,
// count the distinct chord names from the SAME source (distinctChordNames over
// chordLabelsForTonic) and write it into the tally, so the number provably
// equals what is on the page. Caption swaps to name the collapse when aligned;
// on a real change the number gets a short emphasis pulse (skipped under
// prefers-reduced-motion, where the text just swaps).
function updateTally(keys: string[]): void {
  const count = distinctChordNames(keys).length;
  if (countEl) countEl.textContent = String(count);
  if (captionEl) {
    captionEl.textContent =
      count === 4
        ? "chord names — the same four, in every song"
        : "different chord names across the five songs";
  }

  const changed = lastCount !== null && lastCount !== count;
  if (changed && countEl && !reducedMotion.matches) {
    countEl.classList.remove("reveal__tally-num--pulse");
    // Force a reflow so removing then re-adding the class restarts the keyframe.
    void countEl.offsetWidth;
    countEl.classList.add("reveal__tally-num--pulse");
    clearTimeout(pulseTimer);
    pulseTimer = setTimeout(() => {
      countEl.classList.remove("reveal__tally-num--pulse");
    }, 500);
  }
  lastCount = count;
}

// `animate` gates ONLY the CSS "snap" retrigger, defaulting to true so every
// align and every split gets the snap. No caller currently passes false; the
// gate is kept because render() is the single place that would need to
// suppress it if a future control (e.g. a continuous transpose) needed to.
function render(animate = true): void {
  // The keys actually driving the cells this paint, collected in the loop so
  // the tally below counts the EXACT same source that fills the chords — no
  // second lookup that could drift from the DOM.
  const currentKeys: string[] = [];
  for (const song of SONGS) {
    const el = songElement(song.title);
    if (!el) continue;

    const key = aligned ? sharedKey : song.tonic;
    currentKeys.push(key);
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

  updateTally(currentKeys);

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

// Draw the initial (unaligned) state from the module rather than trusting the
// server-rendered text, so the client and the pure logic can never disagree.
render();
