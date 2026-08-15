// Phase 3 — the audio engine. This is the only place that makes sound; all of
// the *pitch* logic lives in src/lib/chords.ts (chordLabelsForTonic +
// chordFrequencies), so this file is pure Web Audio plumbing: it schedules the
// four chords of a progression as soft triads and loops them until stopped.
//
// Two invariants it holds:
//  1. It never derives align state itself. A song's current key is whatever
//     align.ts wrote to [data-song]'s data-current-key, so the notes you hear
//     can never disagree with the chord letters you see.
//  2. Only one thing plays at a time. Starting anything stops whatever was
//     playing first, ramping gain down so there is no click.

import { ALIGN_KEY, chordFrequencies, chordLabelsForTonic } from "../lib/chords";

// --- Musical constants -----------------------------------------------------

const CHORD_SECONDS = 0.68; // how long each chord sounds before the next
const ATTACK = 0.015; // fade-in, seconds
const DECAY = 0.12; // fall from peak to the sustain level
const RELEASE = 0.14; // fade-out tail after the chord's slot ends
const PEAK_GAIN = 0.16; // per-note level; ×3 stacked stays under the master
const SUSTAIN_GAIN = 0.11; // held level between decay and release
const MASTER_GAIN = 0.9; // shared output trim, low enough to avoid clipping
const STOP_RAMP = 0.06; // gain ramp when stopping, seconds — kills clicks

// Lookahead scheduler: a JS timer wakes often and queues any chords that fall
// due within the next LOOKAHEAD seconds, so timing rides the accurate audio
// clock rather than setInterval's jitter.
const LOOKAHEAD = 0.1; // seconds of audio scheduled ahead of the clock
const TICK_MS = 25; // how often the scheduler wakes

// The play/stop affordance glyphs (▶ / ■), mirroring the markup's play glyph.
const PLAY_GLYPH = "▶";
const STOP_GLYPH = "■";

// Chord index → scale degree, in the same order chordLabelsForTonic yields its
// labels (I, V, vi, IV). Used to pick the [data-degree] chord cell(s) to light.
const DEGREES = ["I", "V", "vi", "IV"] as const;

// The class toggled on a `.chord` element while its chord is sounding.
const PLAYING_CLASS = "chord--playing";

// --- Audio context (created on first gesture, never at module load) --------

let audioContext: AudioContext | null = null;

/** The shared AudioContext, created lazily and resumed on the first click. */
function getAudioContext(): AudioContext {
  audioContext ??= new window.AudioContext();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

// --- Playback state --------------------------------------------------------

// A single in-flight loop. `master` is per-session so stopping can fade just
// this session out; `voices` tracks live oscillators for a clean teardown.
interface Session {
  button: HTMLButtonElement;
  labels: string[];
  master: GainNode;
  voices: Set<OscillatorNode>;
  timer: number;
  nextChordTime: number;
  step: number;
  // Sync: cells to light per chord index (0..3), a schedule of when each
  // scheduled chord sounds on the audio clock, and the running rAF handle.
  targets: HTMLElement[][];
  schedule: { index: number; start: number; end: number }[];
  raf: number;
  litIndex: number; // chord index currently highlighted, -1 = none
}

let session: Session | null = null;

/** Schedule one chord (a soft triad) to start at `startTime` on the clock. */
function scheduleChord(active: Session, label: string, startTime: number): void {
  const context = getAudioContext();
  const end = startTime + CHORD_SECONDS;

  for (const hz of chordFrequencies(label)) {
    const osc = context.createOscillator();
    osc.type = "triangle"; // softer than sine's plainness, no square harshness
    osc.frequency.value = hz;

    // A short A/D/S/R envelope per note so chords sound plucked, not switched.
    const gain = context.createGain();
    const level = gain.gain;
    level.setValueAtTime(0, startTime);
    level.linearRampToValueAtTime(PEAK_GAIN, startTime + ATTACK);
    level.linearRampToValueAtTime(SUSTAIN_GAIN, startTime + ATTACK + DECAY);
    level.setValueAtTime(SUSTAIN_GAIN, end - RELEASE);
    level.linearRampToValueAtTime(0, end);

    osc.connect(gain).connect(active.master);
    osc.start(startTime);
    osc.stop(end + RELEASE);

    active.voices.add(osc);
    osc.onended = (): void => {
      osc.disconnect();
      gain.disconnect();
      active.voices.delete(osc);
    };
  }
}

/** The scheduler tick: queue every chord that falls due within LOOKAHEAD. */
function pump(active: Session): void {
  const context = getAudioContext();
  while (active.nextChordTime < context.currentTime + LOOKAHEAD) {
    const index = active.step % active.labels.length;
    const start = active.nextChordTime;
    scheduleChord(active, active.labels[index], start);
    // Record when this chord actually sounds on the audio clock so the rAF
    // highlight can follow the ear, not the (lookahead-early) scheduling.
    active.schedule.push({ index, start, end: start + CHORD_SECONDS });
    active.nextChordTime += CHORD_SECONDS;
    active.step += 1;
  }
  // Drop entries that have already finished sounding, so the list stays small.
  const cutoff = context.currentTime - CHORD_SECONDS;
  active.schedule = active.schedule.filter((entry) => entry.end >= cutoff);
}

// --- Button affordance -----------------------------------------------------

// Original label text is captured once so stopping can restore it exactly
// (the hero button and per-song buttons carry different wording).
const originalLabels = new WeakMap<HTMLButtonElement, string>();

function labelSpan(button: HTMLButtonElement): HTMLElement | null {
  return button.querySelector<HTMLElement>("span:not(.playbtn__glyph)");
}

function glyphSpan(button: HTMLButtonElement): HTMLElement | null {
  return button.querySelector<HTMLElement>(".playbtn__glyph");
}

function setButtonPlaying(button: HTMLButtonElement, playing: boolean): void {
  const label = labelSpan(button);
  const glyph = glyphSpan(button);

  if (playing) {
    if (label && !originalLabels.has(button)) {
      originalLabels.set(button, label.textContent ?? "");
    }
    button.setAttribute("aria-pressed", "true");
    if (glyph) glyph.textContent = STOP_GLYPH;
    if (label) label.textContent = "Stop";
  } else {
    button.setAttribute("aria-pressed", "false");
    if (glyph) glyph.textContent = PLAY_GLYPH;
    if (label) label.textContent = originalLabels.get(button) ?? label.textContent;
  }
}

// --- Playback highlight (synced off the audio clock via rAF) ---------------

// The chord cells a session lights, indexed by chord position (0→I .. 3→IV).
// Per-song play scopes to that song's four cells; hero play scopes to the
// whole document, so every song's cell for a degree lights at once — the
// I→V→vi→IV sweep moves across all five songs together.
function highlightTargets(button: HTMLButtonElement): HTMLElement[][] {
  const isHero = button.dataset.play === "hero";
  const scope: ParentNode = isHero
    ? document
    : (button.closest<HTMLElement>("[data-song]") ?? document);
  return DEGREES.map((degree) =>
    Array.from(
      scope.querySelectorAll<HTMLElement>(`.chord[data-degree="${degree}"]`),
    ),
  );
}

/** Remove the playing state from every cell this session could light. */
function clearHighlight(active: Session): void {
  for (const cells of active.targets) {
    for (const cell of cells) cell.classList.remove(PLAYING_CLASS);
  }
}

/** Light the cells for chord `index` (and only those); -1 lights nothing. */
function setHighlight(active: Session, index: number): void {
  clearHighlight(active);
  if (index >= 0) {
    for (const cell of active.targets[index]) cell.classList.add(PLAYING_CLASS);
  }
}

/** rAF loop: read the audio clock, light the chord that is sounding *now*. */
function followPlayhead(active: Session): void {
  if (session !== active) return; // stopped or superseded — do not reschedule
  const now = getAudioContext().currentTime;
  let index = -1;
  for (const entry of active.schedule) {
    if (entry.start <= now && now < entry.end) {
      index = entry.index;
      break;
    }
  }
  if (index !== active.litIndex) {
    setHighlight(active, index);
    active.litIndex = index;
  }
  active.raf = window.requestAnimationFrame(() => followPlayhead(active));
}

// --- Start / stop ----------------------------------------------------------

/** Stop the current loop (if any), fading out cleanly and freeing its nodes. */
function stop(): void {
  if (!session) return;
  const active = session;
  session = null;

  window.clearInterval(active.timer);
  window.cancelAnimationFrame(active.raf);
  clearHighlight(active); // the highlight must never linger past stop
  setButtonPlaying(active.button, false);

  const context = getAudioContext();
  const now = context.currentTime;

  // Fade the whole session out, then silence and drop every live oscillator.
  active.master.gain.cancelScheduledValues(now);
  active.master.gain.setValueAtTime(active.master.gain.value, now);
  active.master.gain.linearRampToValueAtTime(0, now + STOP_RAMP);

  for (const osc of active.voices) {
    try {
      osc.stop(now + STOP_RAMP);
    } catch {
      // Already stopped/ended — onended will have cleaned it up.
    }
  }

  // Disconnect the master once its tail has finished.
  window.setTimeout(
    () => active.master.disconnect(),
    (STOP_RAMP + RELEASE) * 1000,
  );
}

/** Start looping `labels` (a four-chord progression), driven from `button`. */
function start(button: HTMLButtonElement, labels: string[]): void {
  stop(); // enforce the "only one thing plays" invariant

  const context = getAudioContext();
  const master = context.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(context.destination);

  const active: Session = {
    button,
    labels,
    master,
    voices: new Set<OscillatorNode>(),
    timer: 0,
    nextChordTime: context.currentTime + 0.05, // tiny lead-in for a clean onset
    step: 0,
    targets: highlightTargets(button),
    schedule: [],
    raf: 0,
    litIndex: -1,
  };
  session = active;

  setButtonPlaying(button, true);
  pump(active); // queue the first chords immediately, then keep topping up
  active.timer = window.setInterval(() => pump(active), TICK_MS);
  active.raf = window.requestAnimationFrame(() => followPlayhead(active));
}

// --- Wiring ----------------------------------------------------------------

// The key a song is currently in is owned by align.ts, published on the
// enclosing [data-song] as data-current-key. Hero has no song, so it always
// uses the shared alignment key.
function keyForButton(button: HTMLButtonElement): string {
  if (button.dataset.play === "hero") return ALIGN_KEY;
  const song = button.closest<HTMLElement>("[data-song]");
  return song?.dataset.currentKey ?? ALIGN_KEY;
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-play]")) {
  button.addEventListener("click", () => {
    // Pressing the button that is already playing is a toggle: stop it.
    if (session?.button === button) {
      stop();
      return;
    }
    start(button, chordLabelsForTonic(keyForButton(button)));
  });
}
