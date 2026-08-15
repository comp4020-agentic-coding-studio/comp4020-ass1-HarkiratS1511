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

const CHORD_SECONDS = 0.7; // one chord per beat (~86 bpm) before the next slot

// Each chord slot is played as a little DOWN/UP pop strum rather than one held
// block: a firm downbeat, then a softer off-beat lift. Both strikes re-voice the
// SAME triad from the SAME frequencies, so the slot still sounds one chord — it
// just breathes with a rhythm instead of droning like an organ. `at` is the
// fraction of the slot the strike lands on; `velocity` scales its loudness;
// `up` reverses the strum direction (an upstroke sweeps high string → low).
// This pattern is identical for every song, so two aligned songs still produce
// an identical set of frequencies at identical times — the thesis holds.
const STRUM_PATTERN = [
  { at: 0, velocity: 1, up: false },
  { at: 0.5, velocity: 0.62, up: true },
] as const;
const STRUM_SPREAD = 0.014; // s between adjacent strings within one strum
const RING_SECONDS = 0.62; // how long a struck note rings before its release tail

// Per-note pluck envelope: fast attack, quick fall to a low sustain that rings
// out — plucked, not switched on, so each re-strike reads as rhythm.
const ATTACK = 0.008; // fade-in, seconds — a pluck, not a swell
const DECAY = 0.11; // fall from the attack peak to the ringing sustain
const RELEASE = 0.16; // fade-out tail after a struck note stops ringing
const CHORD_PEAK = 0.13; // a chord tone's attack level; ×3 stacked + bass stays under master
const CHORD_SUSTAIN = 0.055; // the level a chord tone rings at between strikes
const BASS_PEAK = 0.15; // the root dropped an octave — carries the low end
const BASS_SUSTAIN = 0.07; // the bass note's ringing level
const BASS_OCTAVE = 0.5; // ×0.5 = one octave down, for weight under the triad
const MASTER_GAIN = 0.82; // shared output trim, lowered now that a bass note stacks
const STOP_RAMP = 0.06; // gain ramp when stopping, seconds — kills clicks

// --- Warmth chain: a lowpass to round the tone + a small synthetic room -----
// These only shape *timbre and space*, never pitch or timing: the triangle's
// upper partials are the harsh part, so a gentle lowpass rounds them off, and a
// short reverb tail (a small room, not a hall) glues the triad together. The
// reverb is a parallel wet send mixed softly under a near-unity dry signal, so
// chords stay clearly articulated.
const FILTER_CUTOFF = 2800; // Hz — well above the triad tones, tames triangle fizz
const FILTER_Q = 0.7; // gentle slope, no resonant bump
const REVERB_SECONDS = 1.5; // impulse length — short, small-room decay
const REVERB_DECAY = 3.2; // exponential steepness of the impulse tail
const DRY_GAIN = 0.9; // the direct, un-reverbed path
const WET_GAIN = 0.3; // the reverb send, kept soft so it warms without washing out

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

// One shared AnalyserNode taps whatever is currently playing (each session's
// `master` connects here in parallel — see start()). It is a pure *observer*:
// it reads the summed signal and connects onward to nothing, so it adds no
// audio path and — crucially — no oscillator and no frequency. The
// thesis-in-sound invariant (two aligned songs → an identical set of oscillator
// frequencies) is therefore untouched by the visualizer.
const VIS_FFT = 1024; // small window: cheap, plenty of detail for a calm wave

let analyser: AnalyserNode | null = null;
let visData: Uint8Array<ArrayBuffer> | null = null;

/** The shared AnalyserNode, created lazily alongside the AudioContext. */
function getAnalyser(context: AudioContext): AnalyserNode {
  if (analyser) return analyser;
  const node = context.createAnalyser();
  node.fftSize = VIS_FFT;
  node.smoothingTimeConstant = 0.8; // gentle, un-jittery swell — no flicker
  analyser = node;
  visData = new Uint8Array(node.fftSize);
  return node;
}

// The reverb's impulse response: an exponentially-decaying burst of noise,
// synthesised in code (there is no network/asset to fetch). Convolving the dry
// signal with this is what produces the "room" tail. Randomness lives ONLY here
// in the reverb tail — it never touches a note's pitch or a chord's timing — so
// the thesis-in-sound invariant (identical oscillator frequencies per play) is
// untouched. Cached at module scope because the buffer is immutable, read-only
// data safely shared across sessions; each session still gets its own
// ConvolverNode so stopping one silences it completely.
let impulseBuffer: AudioBuffer | null = null;
function reverbImpulse(context: AudioContext): AudioBuffer {
  if (impulseBuffer) return impulseBuffer;
  const length = Math.floor(context.sampleRate * REVERB_SECONDS);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      // White noise faded out along an exponential curve → a natural decay.
      const remaining = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * remaining ** REVERB_DECAY;
    }
  }
  impulseBuffer = buffer;
  return buffer;
}

// --- Playback state --------------------------------------------------------

// A single in-flight loop. `master` is per-session so stopping can fade just
// this session out; `voices` tracks live oscillators for a clean teardown.
// `parts` is the set of four-chord progressions playing together on this one
// shared clock: a single song is one part; "all five at once" is five parts,
// each scheduled at the same beat so they start, loop and land in lock-step.
interface Session {
  button: HTMLButtonElement;
  parts: string[][];
  master: GainNode;
  // The per-session warmth chain, held so stop() can disconnect every node and
  // leave nothing lingering: voices → filter → {dry, convolver→wet} → master.
  filter: BiquadFilterNode;
  convolver: ConvolverNode;
  dry: GainNode;
  wet: GainNode;
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

/** Schedule one plucked note (a chord tone or the bass) into the warmth chain. */
function scheduleNote(
  active: Session,
  hz: number,
  startTime: number,
  ringEnd: number,
  peak: number,
  sustain: number,
  type: OscillatorType,
): void {
  const context = getAudioContext();
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.value = hz;

  // A short A/D/S/R envelope so the note is plucked, not switched on: quick
  // attack to `peak`, fall to a ringing `sustain`, then a soft release tail.
  const gain = context.createGain();
  const level = gain.gain;
  const sustainAt = Math.max(startTime + ATTACK + DECAY, ringEnd - RELEASE);
  level.setValueAtTime(0, startTime);
  level.linearRampToValueAtTime(peak, startTime + ATTACK);
  level.linearRampToValueAtTime(sustain, startTime + ATTACK + DECAY);
  level.setValueAtTime(sustain, sustainAt);
  level.linearRampToValueAtTime(0, ringEnd);

  // Into the warmth chain (filter → dry/wet → master), not straight to master.
  osc.connect(gain).connect(active.filter);
  osc.start(startTime);
  osc.stop(ringEnd + 0.02);

  active.voices.add(osc);
  osc.onended = (): void => {
    osc.disconnect();
    gain.disconnect();
    active.voices.delete(osc);
  };
}

/** Schedule one chord slot: a down/up strum of the triad over its bass root. */
function scheduleChord(active: Session, label: string, startTime: number): void {
  // Sort ascending so a downstrum sweeps low string → high. The sort is a pure
  // function of the label's own frequencies, so every song voices the chord the
  // same way — two aligned songs stay bit-for-bit identical (thesis-in-sound).
  const triad = [...chordFrequencies(label)].sort((a, b) => a - b);
  const rootHz = triad[0] * BASS_OCTAVE; // bass = chord root, one octave down

  for (const strike of STRUM_PATTERN) {
    const strikeStart = startTime + strike.at * CHORD_SECONDS;
    const ringEnd = strikeStart + RING_SECONDS;

    // The triad, strummed: stagger each string's onset so they don't all hit at
    // once (upstrokes sweep the other way). Still one chord — just articulated.
    const order = strike.up ? [...triad].reverse() : triad;
    for (const [i, hz] of order.entries()) {
      scheduleNote(
        active,
        hz,
        strikeStart + i * STRUM_SPREAD,
        ringEnd,
        CHORD_PEAK * strike.velocity,
        CHORD_SUSTAIN * strike.velocity,
        "triangle", // softer than sine's plainness, no square harshness
      );
    }

    // The bass root anchors each strike with clean low end (a sine has no fizz
    // to tame). Its pitch is the chord root octave-down, so it too is identical
    // across aligned songs and never disagrees with the chord you see.
    scheduleNote(
      active,
      rootHz,
      strikeStart,
      ringEnd,
      BASS_PEAK * strike.velocity,
      BASS_SUSTAIN * strike.velocity,
      "sine",
    );
  }
}

/** The scheduler tick: queue every chord that falls due within LOOKAHEAD. */
function pump(active: Session): void {
  const context = getAudioContext();
  const cycle = active.parts[0].length; // every progression is I–V–vi–IV (4)
  while (active.nextChordTime < context.currentTime + LOOKAHEAD) {
    const index = active.step % cycle;
    const start = active.nextChordTime;
    // Every part hits the SAME slot at the SAME time on the shared clock, so
    // five songs stay synchronized: aligned they reinforce into one unison,
    // unaligned they pile into a clash. Both read live from chords.ts.
    for (const part of active.parts) scheduleChord(active, part[index], start);
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
  // Hero and "all five at once" both sound every song, so they sweep the whole
  // document's cells; a single song scopes to just its own four.
  const wholeDocument =
    button.dataset.play === "hero" || button.hasAttribute("data-play-all");
  const scope: ParentNode = wholeDocument
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
  stopVisualizer(); // no lingering visual once sound stops; loop idles cheaply
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

  // Disconnect the whole graph once its tail has finished — master AND the
  // warmth chain — so no node (or reverb tail) lingers past the fade.
  window.setTimeout(() => {
    active.master.disconnect();
    active.filter.disconnect();
    active.convolver.disconnect();
    active.dry.disconnect();
    active.wet.disconnect();
  }, (STOP_RAMP + RELEASE) * 1000);
}

/**
 * Start looping `parts` — one or more four-chord progressions — off a single
 * shared clock, driven from `button`. One part is a single song; five parts is
 * "all five at once". The master trim is divided by the part count so five
 * aligned progressions (identical tones, summing coherently) stay under the
 * ceiling as a fat unison instead of clipping.
 */
function start(button: HTMLButtonElement, parts: string[][]): void {
  stop(); // enforce the "only one thing plays" invariant

  const context = getAudioContext();
  const master = context.createGain();
  master.gain.value = MASTER_GAIN / parts.length;
  master.connect(context.destination);
  // Additionally tap this session's master into the shared analyser, in
  // parallel with the destination connection above. The analyser only observes
  // (it connects onward to nothing); stop() disconnects master entirely, so a
  // stopped session no longer drives the visualizer.
  master.connect(getAnalyser(context));

  // Build the warmth chain per session (mirroring how `master` is owned per
  // session) so stopping this session disconnects it and fully silences it.
  // A lowpass rounds off the triangle's fizz, then the signal splits into a
  // near-unity DRY path and a soft WET reverb send, both summing into master:
  //   filter → dry ─────────────→ master
  //   filter → convolver → wet ─→ master
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = FILTER_CUTOFF;
  filter.Q.value = FILTER_Q;

  const convolver = context.createConvolver();
  convolver.buffer = reverbImpulse(context);

  const dry = context.createGain();
  dry.gain.value = DRY_GAIN;
  const wet = context.createGain();
  wet.gain.value = WET_GAIN;

  filter.connect(dry).connect(master);
  filter.connect(convolver).connect(wet).connect(master);

  const active: Session = {
    button,
    parts,
    master,
    filter,
    convolver,
    dry,
    wet,
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
  startVisualizer(); // the decorative canvas only animates while something plays
  pump(active); // queue the first chords immediately, then keep topping up
  active.timer = window.setInterval(() => pump(active), TICK_MS);
  active.raf = window.requestAnimationFrame(() => followPlayhead(active));
}

// --- Live visualizer (a decorative analyser tap) ---------------------------
// A small canvas that draws the live master signal as a calm waveform with a
// beat pulse that swells on each chord's attack. It is purely decorative
// (aria-hidden). Its rAF loop is deliberately SEPARATE from followPlayhead so
// it can never perturb the .chord--playing highlight timing; it also idles for
// free (no rAF scheduled) whenever nothing is playing.

const canvas = document.querySelector<HTMLCanvasElement>("[data-visualizer]");
const canvasCtx = canvas?.getContext("2d") ?? null;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let visRaf = 0;

// The warm palette is read once from the CSS custom properties so the canvas
// matches the page's degree hues and paper aesthetic without duplicating them.
let degColors: string[] = [];
let inkFaint = "#8a867b";

function cacheColors(): void {
  const styles = getComputedStyle(document.documentElement);
  degColors = DEGREES.map(
    (degree) =>
      styles.getPropertyValue(`--deg-${degree.toLowerCase()}`).trim() ||
      inkFaint,
  );
  inkFaint = styles.getPropertyValue("--ink-faint").trim() || inkFaint;
}

// Size the backing store to the CSS box × devicePixelRatio so the line stays
// crisp on high-DPI screens; the CSS width is 100% of the container, so there
// is no fixed pixel width to overflow the 390px viewport.
function sizeCanvas(): void {
  if (!canvas || !canvasCtx) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
  canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
}

/** The current chord's degree hue, or a faint neutral when nothing is lit. */
function litColor(): string {
  const index = session?.litIndex ?? -1;
  return index >= 0 && degColors[index] ? degColors[index] : inkFaint;
}

/** Idle: a flat, faint baseline — quiet, never noisy, when nothing plays. */
function drawIdle(): void {
  if (!canvas || !canvasCtx) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvasCtx.clearRect(0, 0, width, height);
  canvasCtx.globalAlpha = 0.35;
  canvasCtx.strokeStyle = inkFaint;
  canvasCtx.lineWidth = 2;
  canvasCtx.beginPath();
  canvasCtx.moveTo(0, height / 2);
  canvasCtx.lineTo(width, height / 2);
  canvasCtx.stroke();
  canvasCtx.globalAlpha = 1;
}

/** Reduced motion: one static, representative waveform frame — no animation. */
function drawStaticFrame(): void {
  if (!canvas || !canvasCtx) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const mid = height / 2;
  canvasCtx.clearRect(0, 0, width, height);
  canvasCtx.globalAlpha = 0.5;
  canvasCtx.strokeStyle = inkFaint;
  canvasCtx.lineWidth = 2;
  canvasCtx.beginPath();
  for (let x = 0; x <= width; x += 1) {
    const y = mid - Math.sin((x / width) * Math.PI * 4) * mid * 0.3;
    if (x === 0) canvasCtx.moveTo(x, y);
    else canvasCtx.lineTo(x, y);
  }
  canvasCtx.stroke();
  canvasCtx.globalAlpha = 1;
}

/** One live frame: a soft degree-hued pulse band + the sampled waveform. */
function drawFrame(): void {
  if (!canvas || !canvasCtx || !analyser || !visData) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const mid = height / 2;

  analyser.getByteTimeDomainData(visData);

  // RMS of the time-domain signal → the beat pulse swell on each attack.
  let sumSquares = 0;
  for (let i = 0; i < visData.length; i += 1) {
    const sample = (visData[i] - 128) / 128;
    sumSquares += sample * sample;
  }
  const rms = Math.sqrt(sumSquares / visData.length);
  const swell = Math.min(1, rms * 4);
  const color = litColor();

  canvasCtx.clearRect(0, 0, width, height);

  // A soft filled band behind the wave, in the sounding chord's hue, that
  // breathes with the amplitude — the "beat pulse", kept low-contrast.
  const band = mid * (0.2 + swell * 0.9);
  canvasCtx.globalAlpha = 0.1 + swell * 0.22;
  canvasCtx.fillStyle = color;
  canvasCtx.fillRect(0, mid - band, width, band * 2);

  // The waveform itself, drawn as a single smooth line in the same hue.
  canvasCtx.globalAlpha = 0.9;
  canvasCtx.strokeStyle = color;
  canvasCtx.lineWidth = 2;
  canvasCtx.lineJoin = "round";
  canvasCtx.beginPath();
  const step = width / visData.length;
  for (let i = 0; i < visData.length; i += 1) {
    const sample = (visData[i] - 128) / 128;
    const x = i * step;
    const y = mid + sample * mid * 0.9;
    if (i === 0) canvasCtx.moveTo(x, y);
    else canvasCtx.lineTo(x, y);
  }
  canvasCtx.stroke();
  canvasCtx.globalAlpha = 1;
}

/** The visualizer rAF loop: runs only while a session is playing. */
function visualizerLoop(): void {
  if (!session) {
    visRaf = 0; // stopped — let the loop die and rest on a quiet baseline
    drawIdle();
    return;
  }
  drawFrame();
  visRaf = window.requestAnimationFrame(visualizerLoop);
}

/** Start the draw loop when playback starts (or freeze under reduced motion). */
function startVisualizer(): void {
  if (!canvas || !canvasCtx) return;
  sizeCanvas();
  if (reducedMotion.matches) {
    drawStaticFrame(); // honour the preference: a still frame, no busy loop
    return;
  }
  if (visRaf) return; // already looping
  visRaf = window.requestAnimationFrame(visualizerLoop);
}

/** Stop the draw loop and rest the canvas quietly when playback stops. */
function stopVisualizer(): void {
  if (visRaf) {
    window.cancelAnimationFrame(visRaf);
    visRaf = 0;
  }
  drawIdle();
}

// Keep the backing store in step with the layout, and redraw the resting state
// when idle so a resize never leaves a stale or stretched frame on screen.
window.addEventListener("resize", () => {
  sizeCanvas();
  if (!session) {
    if (reducedMotion.matches) drawStaticFrame();
    else drawIdle();
  }
});

// Initial paint: measure, cache the palette, and rest quietly until first play.
if (canvas && canvasCtx) {
  cacheColors();
  sizeCanvas();
  if (reducedMotion.matches) drawStaticFrame();
  else drawIdle();
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
    start(button, [chordLabelsForTonic(keyForButton(button))]);
  });
}

// "All five at once" — the collision. Every song's four chords are read LIVE
// from its [data-song]'s data-current-key (align.ts's source of truth), so the
// notes always match the letters on screen: unaligned they clash, aligned they
// fuse into one unison. Same single-session model as above, so pressing a solo
// Play stops the collision and vice-versa — the two engines never fight.
function collisionParts(): string[][] {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-song]"),
  ).map((song) => chordLabelsForTonic(song.dataset.currentKey ?? ALIGN_KEY));
}

const playAllButton =
  document.querySelector<HTMLButtonElement>("[data-play-all]");
playAllButton?.addEventListener("click", () => {
  if (session?.button === playAllButton) {
    stop();
    return;
  }
  start(playAllButton, collisionParts());
});
