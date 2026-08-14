// Pure music-theory logic for the "one progression, five keys" thesis.
//
// No DOM, no Web Audio, no side effects — this module is imported by tests
// today and will be imported by both a browser UI and (later) an audio layer.
// Every chord spelling below is DERIVED from the tonic, not hardcoded per
// song: give it any major-key tonic and it works out the correctly-spelled
// I, V, vi, IV triads the way a musician would notate them (flat keys get
// flat spellings, sharp keys get sharp spellings, no doubled letter names).

export type Quality = "maj" | "min";
export type Degree = "I" | "V" | "vi" | "IV";

export interface ChordInfo {
  degree: Degree;
  roman: string;
  quality: Quality;
  label: string;
}

interface NoteName {
  /** Index into ALPHABET (0=C .. 6=B). */
  letterIndex: number;
  /** Semitone offset from the natural letter: -2..2 (bb, b, "", #, ##). */
  accidental: number;
}

// --- Pitch-class fundamentals ------------------------------------------

const ALPHABET = ["C", "D", "E", "F", "G", "A", "B"] as const;
const NATURAL_PITCH_CLASS = [0, 2, 4, 5, 7, 9, 11] as const;

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Signed pitch-class distance in (-6, 6], the "nearest" accidental value. */
function signedInterval(from: number, to: number): number {
  let diff = mod(to - from, 12);
  if (diff > 6) diff -= 12;
  return diff;
}

function accidentalToString(accidental: number): string {
  switch (accidental) {
    case 0:
      return "";
    case 1:
      return "#";
    case -1:
      return "b";
    case 2:
      return "##";
    case -2:
      return "bb";
    default:
      throw new Error(`Unsupported accidental: ${accidental}`);
  }
}

function noteNameToString(note: NoteName): string {
  return ALPHABET[note.letterIndex] + accidentalToString(note.accidental);
}

function pitchClassOf(note: NoteName): number {
  return mod(NATURAL_PITCH_CLASS[note.letterIndex] + note.accidental, 12);
}

/**
 * Parse a note/tonic name such as "C", "F#", "Bb", "G#" into a letter index
 * and accidental. Accepts single sharps/flats and (for completeness) double
 * sharps/flats.
 */
function parseNote(name: string): NoteName {
  const letter = name[0]?.toUpperCase();
  const letterIndex = ALPHABET.indexOf(letter as (typeof ALPHABET)[number]);
  if (letterIndex === -1) {
    throw new Error(`Unrecognised note letter in "${name}"`);
  }
  const rest = name.slice(1);
  let accidental: number;
  switch (rest) {
    case "":
      accidental = 0;
      break;
    case "#":
      accidental = 1;
      break;
    case "b":
      accidental = -1;
      break;
    case "##":
    case "x":
      accidental = 2;
      break;
    case "bb":
      accidental = -2;
      break;
    default:
      throw new Error(`Unrecognised accidental in "${name}"`);
  }
  return { letterIndex, accidental };
}

/**
 * The note reached by moving `semitones` up from `root`, spelled using a
 * letter name `letterSteps` further along the musical alphabet than the
 * root. This one rule is what makes every spelling in this module correct:
 * a major scale's degrees always use consecutive letters, and a triad's
 * third/fifth are always a letter-third/letter-fifth above the root, so
 * feeding in the right (semitones, letterSteps) pair for a scale degree or
 * a chord tone spells it the way a musician would write it.
 */
function noteAtInterval(
  root: NoteName,
  semitones: number,
  letterSteps: number,
): NoteName {
  const letterIndex = mod(root.letterIndex + letterSteps, 7);
  const natural = NATURAL_PITCH_CLASS[letterIndex];
  const target = mod(pitchClassOf(root) + semitones, 12);
  const accidental = signedInterval(natural, target);
  return { letterIndex, accidental };
}

// --- The invariant progression -------------------------------------------

// Scale-degree recipe for I, V, vi, IV: semitone offset from the tonic and
// how many letters up the alphabet that degree sits, plus the triad quality
// diatonic major keys always give that degree. This table encodes music
// theory (major-scale degree qualities), not any one song's chords.
const DEGREES: ReadonlyArray<{
  degree: Degree;
  roman: string;
  semitones: number;
  letterSteps: number;
  quality: Quality;
}> = [
  { degree: "I", roman: "I", semitones: 0, letterSteps: 0, quality: "maj" },
  { degree: "V", roman: "V", semitones: 7, letterSteps: 4, quality: "maj" },
  { degree: "vi", roman: "vi", semitones: 9, letterSteps: 5, quality: "min" },
  { degree: "IV", roman: "IV", semitones: 5, letterSteps: 3, quality: "maj" },
];

/** The default "everyone plays in this key" alignment target. */
export const ALIGN_KEY = "C";

/**
 * The four chords of the I–V–vi–IV progression in a given major key, in
 * order, correctly spelled for that key (e.g. chordsForTonic("F") gives
 * Bb for IV, never A#; chordsForTonic("B") gives G#m for vi, never Abm).
 */
export function chordsForTonic(tonic: string): ChordInfo[] {
  const root = parseNote(tonic);
  return DEGREES.map(({ degree, roman, semitones, letterSteps, quality }) => {
    const note = noteAtInterval(root, semitones, letterSteps);
    const label = noteNameToString(note) + (quality === "min" ? "m" : "");
    return { degree, roman, quality, label };
  });
}

/** Just the chord labels, in I, V, vi, IV order — e.g. ["C","G","Am","F"]. */
export function chordLabelsForTonic(tonic: string): string[] {
  return chordsForTonic(tonic).map((chord) => chord.label);
}

/**
 * The label set a song should display for a given "current key" — either
 * the song's own tonic (unaligned) or the shared ALIGN_KEY (aligned). The
 * progression's chords always come from this function, never from a
 * per-song lookup table, so aligning every song to the same tonic always
 * makes them identical.
 */
export function chordLabelsForKey(currentKey: string): string[] {
  return chordLabelsForTonic(currentKey);
}

// --- Transposition ---------------------------------------------------------

// Preferred spelling for each pitch class when a tonic is reached by pure
// semitone arithmetic (transpose()) rather than derived from a scale
// context. This is the conventional mixed sharps/flats lead-sheet spelling
// (Db, Eb, F#, Ab, Bb) — it matches the dominant/subdominant relationships
// used to align the five songs (e.g. transposing Eb up a fifth lands on the
// conventional "Bb", not "A#").
const TONIC_SPELLING_BY_PITCH_CLASS = [
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

/** The tonic reached by moving `semitones` (may be negative) from `tonic`. */
export function transpose(tonic: string, semitones: number): string {
  const pitchClass = mod(pitchClassOf(parseNote(tonic)) + semitones, 12);
  return TONIC_SPELLING_BY_PITCH_CLASS[pitchClass];
}

// --- Frequencies -------------------------------------------------------

/**
 * Equal-temperament frequency (Hz) of `note` in scientific pitch notation
 * octave `octave` (A4 = 440Hz, so noteFrequency("A", 4) === 440).
 */
export function noteFrequency(note: string, octave: number): number {
  const pitchClass = pitchClassOf(parseNote(note));
  const midi = (octave + 1) * 12 + pitchClass;
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * The three note names (root, third, fifth) of a chord label such as "F#",
 * "Bb", or "G#m", correctly spelled (a minor third is still a letter-third
 * above the root, so G#m spells as G#-B-D#, not G#-Cb-D#... and not
 * G#-C-D#).
 */
export function chordTones(label: string): [string, string, string] {
  const isMinor = label.endsWith("m");
  const rootName = isMinor ? label.slice(0, -1) : label;
  const root = parseNote(rootName);
  const thirdSemitones = isMinor ? 3 : 4;
  const third = noteAtInterval(root, thirdSemitones, 2);
  const fifth = noteAtInterval(root, 7, 4);
  return [noteNameToString(root), noteNameToString(third), noteNameToString(fifth)];
}
