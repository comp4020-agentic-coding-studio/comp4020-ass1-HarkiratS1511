// "Write your own hit" — the interactive four-chord songwriter.
//
// The visitor arranges the same four chords (I, V, vi, IV) into any order, in
// any key, and the page tells them — honestly — which famous progression they
// just built. This is the thesis proved by doing: the visitor becomes the
// songwriter and only a small handful of orders are the ones the world already
// knows, which is exactly the point.
//
// Two hard rules this module holds:
//  1. Every chord letter is DERIVED from src/lib/chords.ts, keyed on the chosen
//     tonic — never hard-coded. The chips relabel from the same single source
//     the exhibits use, so "your A is their A".
//  2. It plays through the ONE shared audio engine (audio.ts), reusing its
//     module-scoped session, so starting the songwriter stops any solo/collision
//     playback and vice-versa. It never spins up a second AudioContext.
//
// Isolated module scope, like the other per-feature scripts.
export {};

import { chordsForTonic, type Degree } from "../lib/chords";
import { playingButton, start, stop } from "./audio";

// --- The recognition table -------------------------------------------------
// Keyed on the ORDERED four degrees the visitor arranged. Song lists are kept
// short and musically bulletproof; the fourth case (any other permutation) is
// deliberate — it proves order is load-bearing, and it still plays.
interface Verdict {
  name: string;
  body: string;
  songs: string;
}

// The five exhibit keys → the exhibit that lives in that key, for the Axis case.
const AXIS_BY_KEY: Record<string, string> = {
  B: "“I’m Yours” (Jason Mraz)",
  F: "“Where Is the Love?” (Black Eyed Peas)",
  A: "“Someone Like You” (Adele)",
  D: "“With or Without You” (U2)",
  Eb: "“She Will Be Loved” (Maroon 5)",
};

const AXIS_ORDER = "I,V,vi,IV";
const ROCK_ORDER = "vi,IV,I,V";
const DOOWOP_ORDER = "I,vi,IV,V";

/** The themed verdict for an arrangement (ordered degrees) in a chosen key. */
function verdictFor(order: Degree[], key: string): Verdict {
  const sequence = order.join(",");

  if (sequence === AXIS_ORDER) {
    const exhibit = AXIS_BY_KEY[key];
    return {
      name: "The Axis",
      body:
        "The most-used order in pop — the one this whole newspaper is about. I → V → vi → IV.",
      songs: exhibit
        ? `In the key of ${key}, that’s the exact progression under ${exhibit}. Same four moves, all over again.`
        : `In ${key} it’s a hit nobody’s written yet — same four moves, new paint. Also the family of “Let It Be” and “Don’t Stop Believin’.”`,
    };
  }

  if (sequence === ROCK_ORDER) {
    return {
      name: "The Rock Axis",
      body:
        "Start on the sad chord and the same four turn to granite. vi → IV → I → V.",
      songs: "You just built “Zombie” (The Cranberries) and “Save Tonight” (Eagle-Eye Cherry).",
    };
  }

  if (sequence === DOOWOP_ORDER) {
    return {
      name: "The ’50s / Doo-Wop",
      body:
        "Slow-dance the six-chord in second and it’s 1958 again. I → vi → IV → V.",
      songs: "You just built “Stand By Me,” “Blue Moon,” and “Earth Angel.”",
    };
  }

  return {
    name: "Uncharted",
    body: "Same four chords — but that order never caught on. Hear it wander?",
    songs: "No famous hit lives here. Which is the whole point: the order is doing the work, not the chords.",
  };
}

// --- Elements --------------------------------------------------------------

const section = document.querySelector<HTMLElement>("[data-forge]");
const slotList = document.querySelector<HTMLElement>("[data-forge-slots]");
const keySelect = document.querySelector<HTMLSelectElement>("[data-forge-key]");
const playButton = document.querySelector<HTMLButtonElement>("[data-forge-play]");
const drumButton = document.querySelector<HTMLButtonElement>("[data-forge-drum]");
const verdictBox = document.querySelector<HTMLElement>("[data-forge-verdict]");

// Bail out cleanly if the markup isn't present (keeps the module import-safe).
if (section && slotList && keySelect && playButton && drumButton && verdictBox) {
  const slots = Array.from(
    slotList.querySelectorAll<HTMLElement>("[data-forge-slot]"),
  );
  // The four chips, indexed by their stable degree. They are moved BETWEEN
  // slots on reorder; the slot order is the visitor's arrangement.
  const chipByDegree = new Map<Degree, HTMLButtonElement>();
  for (const chip of slotList.querySelectorAll<HTMLButtonElement>(
    "[data-forge-chip]",
  )) {
    const degree = chip.dataset.degree as Degree;
    chipByDegree.set(degree, chip);
  }

  const nameEl = verdictBox.querySelector<HTMLElement>("[data-forge-verdict-name]");
  const bodyEl = verdictBox.querySelector<HTMLElement>("[data-forge-verdict-body]");
  const songsEl = verdictBox.querySelector<HTMLElement>("[data-forge-verdict-songs]");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // The arrangement: the ordered degrees, read once from the server-rendered
  // slot order so client and markup can never disagree on the starting state.
  let order: Degree[] = slots.map(
    (slot) =>
      (slot.querySelector<HTMLElement>("[data-forge-chip]")?.dataset
        .degree as Degree) ?? "I",
  );
  let drumOn = false;

  /** The four chord LABELS for the current arrangement + key, derived from chords.ts. */
  function currentLabels(): string[] {
    const info = chordsForTonic(keySelect!.value);
    const labelByDegree = new Map<Degree, string>(
      info.map((chord) => [chord.degree, chord.label]),
    );
    return order.map((degree) => labelByDegree.get(degree) ?? degree);
  }

  /** Re-seat each chip into its slot, relabel from chords.ts, refresh a11y + verdict. */
  function render(): void {
    const info = chordsForTonic(keySelect!.value);
    const labelByDegree = new Map<Degree, string>(
      info.map((chord) => [chord.degree, chord.label]),
    );

    order.forEach((degree, index) => {
      const chip = chipByDegree.get(degree);
      const slot = slots[index];
      if (!chip || !slot) return;
      if (chip.parentElement !== slot) slot.appendChild(chip);

      const label = labelByDegree.get(degree) ?? degree;
      const letter = chip.querySelector<HTMLElement>("[data-forge-chip-letter]");
      if (letter) letter.textContent = label;

      // The keyboard/screen-reader contract: announce position AND role.
      chip.setAttribute(
        "aria-label",
        `Chord ${index + 1} of 4, the ${degree} (${label}). Use arrow keys to reorder.`,
      );
    });

    renderVerdict();
  }

  function renderVerdict(): void {
    const verdict = verdictFor(order, keySelect!.value);
    if (nameEl) nameEl.textContent = verdict.name;
    if (bodyEl) bodyEl.textContent = verdict.body;
    if (songsEl) songsEl.textContent = verdict.songs;
    verdictBox!.dataset.forgeFamily = verdict.name;
  }

  /** Move `degree` to slot index `to` (a splice-reorder, shifting the rest). */
  function moveDegree(degree: Degree, to: number): void {
    const from = order.indexOf(degree);
    const target = Math.max(0, Math.min(order.length - 1, to));
    if (from === -1 || from === target) return;
    order.splice(from, 1);
    order.splice(target, 0, degree);
  }

  /** Restart playback in sync when the arrangement/key/drum changes mid-play. */
  function syncIfPlaying(): void {
    if (playingButton() === playButton) {
      start(playButton!, [currentLabels()], { drum: drumOn });
    }
  }

  // --- Keyboard reordering (mandatory, pointer-free) -----------------------
  for (const [degree, chip] of chipByDegree) {
    chip.addEventListener("keydown", (event) => {
      const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
      const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
      if (!back && !forward) return;
      event.preventDefault();
      const at = order.indexOf(degree);
      moveDegree(degree, at + (forward ? 1 : -1));
      render();
      syncIfPlaying();
      chip.focus(); // keep focus on the chip the visitor is moving
    });
  }

  // --- Pointer drag (pointer events + capture, NOT HTML5 draggable) --------
  // The chip FOLLOWS the pointer (an inline translate transform) but stays in
  // its home slot in the DOM for the whole gesture — it is NOT re-seated into
  // another slot mid-drag. Re-seating mid-drag was the bug: the chip's transform
  // is measured from its DOM position, so appendChild-ing it elsewhere made it
  // jump by the slot offset and fly away. Instead the target slot is only
  // highlighted during the move, and the real reorder happens ONCE on drop.
  let dragging: HTMLButtonElement | null = null;
  let dragDegree: Degree | null = null;
  let dropIndex = -1; // the slot index currently under the pointer
  let startX = 0;
  let startY = 0;

  /** The slot index nearest the pointer, by slot-centre distance (robust to wrap). */
  function slotIndexAt(clientX: number, clientY: number): number {
    let best = 0;
    let bestDist = Infinity;
    slots.forEach((slot, index) => {
      const rect = slot.getBoundingClientRect();
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    return best;
  }

  /** Mark one slot (or none, with -1) as the live drop target; clear the rest. */
  function markDropTarget(index: number): void {
    slots.forEach((slot, i) => {
      slot.classList.toggle("forge__slot--drop-target", i === index);
    });
  }

  for (const [degree, chip] of chipByDegree) {
    chip.addEventListener("pointerdown", (event) => {
      dragging = chip;
      dragDegree = degree;
      dropIndex = order.indexOf(degree);
      startX = event.clientX;
      startY = event.clientY;
      try {
        chip.setPointerCapture(event.pointerId);
      } catch {
        // Pointer id not capturable (e.g. a synthesized event) — the drag
        // still works; capture only keeps real pointers glued to the chip.
      }
      // Raise stacking + lift visual; the chip stays in its slot for now.
      chip.classList.add("forge__chip--dragging");
    });

    chip.addEventListener("pointermove", (event) => {
      if (dragging !== chip || !dragDegree) return;
      // Follow-pointer visual on the DRAGGED CHIP ONLY (skipped under
      // reduced-motion). The chip never leaves its home slot in the DOM, so the
      // transform is always measured from the same origin — no jump.
      if (!reducedMotion.matches) {
        chip.style.transform = `translate(${event.clientX - startX}px, ${
          event.clientY - startY
        }px)`;
      }
      // Highlight the slot the pointer is over — but do NOT reorder yet.
      dropIndex = slotIndexAt(event.clientX, event.clientY);
      markDropTarget(dropIndex);
    });

    function endDrag(event: PointerEvent, commit: boolean): void {
      if (dragging !== chip) return;
      const degreeAtDrop = dragDegree;
      const target = dropIndex;

      // Commit the reorder ONCE, on drop, only if the slot actually changed.
      if (commit && degreeAtDrop && order.indexOf(degreeAtDrop) !== target) {
        moveDegree(degreeAtDrop, target);
        render();
        syncIfPlaying();
      }

      // Full visual cleanup: clear the inline transform, drop the dragging
      // class + raised z-index, un-highlight every slot, release the capture.
      chip.style.transform = "";
      chip.classList.remove("forge__chip--dragging");
      markDropTarget(-1);
      try {
        chip.releasePointerCapture(event.pointerId);
      } catch {
        // Capture already released (e.g. pointercancel) — nothing to undo.
      }
      dragging = null;
      dragDegree = null;
      dropIndex = -1;
    }

    chip.addEventListener("pointerup", (event) => endDrag(event, true));
    chip.addEventListener("pointercancel", (event) => endDrag(event, false));
  }

  // --- Key selector --------------------------------------------------------
  keySelect.addEventListener("change", () => {
    render();
    syncIfPlaying();
  });

  // --- Play / Stop toggle --------------------------------------------------
  playButton.addEventListener("click", () => {
    if (playingButton() === playButton) {
      stop();
      return;
    }
    start(playButton!, [currentLabels()], { drum: drumOn });
  });

  // --- Drum-click toggle ---------------------------------------------------
  drumButton.addEventListener("click", () => {
    drumOn = !drumOn;
    drumButton!.setAttribute("aria-pressed", String(drumOn));
    syncIfPlaying(); // fold the click in/out live if already playing
  });

  // Initial paint: derive labels + verdict from the module, never trust the
  // server text (mirrors align.ts's render-on-load discipline).
  render();
}
