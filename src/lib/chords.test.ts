import { describe, expect, it } from "vitest";
import { SONGS } from "../data/songs";
import {
  ALIGN_KEY,
  chordLabelsForKey,
  chordLabelsForTonic,
  chordsForTonic,
  chordTones,
  noteFrequency,
  transpose,
} from "./chords";

// The verified source of truth from the assignment brief: song tonic ->
// the four correctly-spelled chord labels, in I, V, vi, IV order.
const VERIFIED: Record<string, [string, string, string, string]> = {
  B: ["B", "F#", "G#m", "E"], // I'm Yours
  F: ["F", "C", "Dm", "Bb"], // Where Is the Love?
  A: ["A", "E", "F#m", "D"], // Someone Like You
  D: ["D", "A", "Bm", "G"], // With or Without You
  Eb: ["Eb", "Bb", "Cm", "Ab"], // She Will Be Loved
};

describe("chordsForTonic: verified song keys", () => {
  for (const [tonic, [i, v, vi, iv]] of Object.entries(VERIFIED)) {
    it(`spells ${tonic} major as ${i} ${v} ${vi} ${iv}`, () => {
      const chords = chordsForTonic(tonic);
      expect(chords.map((c) => c.label)).toEqual([i, v, vi, iv]);
      expect(chords.map((c) => c.degree)).toEqual(["I", "V", "vi", "IV"]);
      expect(chords.map((c) => c.roman)).toEqual(["I", "V", "vi", "IV"]);
      expect(chords.map((c) => c.quality)).toEqual([
        "maj",
        "maj",
        "min",
        "maj",
      ]);
    });
  }

  it("every song in src/data/songs.ts matches the verified table", () => {
    for (const song of SONGS) {
      const expected = VERIFIED[song.tonic];
      expect(
        expected,
        `no verified entry for tonic "${song.tonic}" (${song.title})`,
      ).toBeDefined();
      expect(chordLabelsForTonic(song.tonic)).toEqual(expected);
    }
  });
});

describe("chordsForTonic: the aligned key", () => {
  it("C major gives C, G, Am, F", () => {
    const chords = chordsForTonic("C");
    expect(chords.map((c) => c.label)).toEqual(["C", "G", "Am", "F"]);
    expect(chords.map((c) => c.quality)).toEqual([
      "maj",
      "maj",
      "min",
      "maj",
    ]);
  });

  it("ALIGN_KEY defaults to C", () => {
    expect(ALIGN_KEY).toBe("C");
  });
});

describe("the align invariant: this is the core thesis", () => {
  it("at each song's own tonic, the five songs show DIFFERENT chords", () => {
    const perSong = SONGS.map((song) => chordLabelsForTonic(song.tonic));
    const unique = new Set(perSong.map((labels) => labels.join(",")));
    expect(unique.size).toBe(SONGS.length);
  });

  it("aligned to a single shared tonic, all five songs show IDENTICAL chords", () => {
    const aligned = SONGS.map(() => chordLabelsForKey(ALIGN_KEY));
    const unique = new Set(aligned.map((labels) => labels.join(",")));
    expect(unique.size).toBe(1);
    expect(aligned[0]).toEqual(["C", "G", "Am", "F"]);
  });

  it("aligned to any arbitrary shared tonic, all five songs still match", () => {
    for (const sharedTonic of ["G", "D", "Eb"]) {
      const aligned = SONGS.map(() => chordLabelsForKey(sharedTonic));
      const unique = new Set(aligned.map((labels) => labels.join(",")));
      expect(unique.size).toBe(1);
    }
  });

  it("the roman-numeral row is constant regardless of key", () => {
    for (const tonic of ["C", "B", "F", "Eb", ...SONGS.map((s) => s.tonic)]) {
      expect(chordsForTonic(tonic).map((c) => c.roman)).toEqual([
        "I",
        "V",
        "vi",
        "IV",
      ]);
    }
  });
});

describe("transpose", () => {
  it("B up a semitone is C", () => {
    expect(transpose("B", 1)).toBe("C");
  });

  it("B down a semitone is Bb", () => {
    expect(transpose("B", -1)).toBe("Bb");
  });

  it("is a no-op after a full octave up or down", () => {
    expect(transpose("Eb", 12)).toBe("Eb");
    expect(transpose("F#", -12)).toBe("F#");
  });

  it("wraps correctly across multiple octaves", () => {
    expect(transpose("C", 24)).toBe("C");
    expect(transpose("C", -24)).toBe("C");
    expect(transpose("A", 13)).toBe("Bb");
  });

  it("moves a fifth up from each song's tonic to its real dominant", () => {
    // The V chord's root should equal transposing the tonic up a fifth.
    expect(transpose("F", 7)).toBe("C");
    expect(transpose("Eb", 7)).toBe("Bb");
    expect(transpose("B", 7)).toBe("F#");
  });

  it("transposing by 0 semitones is the identity", () => {
    for (const song of SONGS) {
      expect(transpose(song.tonic, 0)).toBe(song.tonic);
    }
  });
});

describe("noteFrequency", () => {
  it("A4 is 440Hz", () => {
    expect(noteFrequency("A", 4)).toBeCloseTo(440, 6);
  });

  it("doubles per octave", () => {
    expect(noteFrequency("A", 5)).toBeCloseTo(880, 6);
    expect(noteFrequency("A", 3)).toBeCloseTo(220, 6);
  });

  it("C4 (middle C) is approximately 261.63Hz", () => {
    expect(noteFrequency("C", 4)).toBeCloseTo(261.63, 1);
  });

  it("agrees on enharmonic pitch classes", () => {
    expect(noteFrequency("F#", 4)).toBeCloseTo(noteFrequency("Gb", 4), 6);
    expect(noteFrequency("Eb", 4)).toBeCloseTo(noteFrequency("D#", 4), 6);
  });
});

describe("chordTones", () => {
  it("spells a major triad with correct letters", () => {
    expect(chordTones("F")).toEqual(["F", "A", "C"]);
    expect(chordTones("Bb")).toEqual(["Bb", "D", "F"]);
  });

  it("spells a minor triad with correct letters (not doubled letter names)", () => {
    expect(chordTones("G#m")).toEqual(["G#", "B", "D#"]);
    expect(chordTones("Dm")).toEqual(["D", "F", "A"]);
    expect(chordTones("Cm")).toEqual(["C", "Eb", "G"]);
  });

  it("every chord in every song's progression has three distinct letters", () => {
    for (const song of SONGS) {
      for (const label of chordLabelsForTonic(song.tonic)) {
        const tones = chordTones(label);
        const letters = tones.map((t) => t[0]);
        expect(new Set(letters).size).toBe(3);
      }
    }
  });
});
