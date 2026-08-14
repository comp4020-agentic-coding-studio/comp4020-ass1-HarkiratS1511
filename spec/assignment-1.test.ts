import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { SONGS } from "../src/data/songs";
import {
  ALIGN_KEY,
  chordLabelsForKey,
  chordLabelsForTonic,
} from "../src/lib/chords";

// The deployable contract for "one progression, five keys": the visitor
// sees each song's chords in its real key, an align control transposes all
// five to a shared key, and a Roman-numeral row (always I V vi IV) is the
// invariant that never changes. This parses the BUILT site the same way
// spec/invariants.test.ts does, so it only goes green once the UI exists —
// that's expected right now (red-to-green), see the report for what's
// still missing.
//
// Stable hooks a Phase 2 UI MUST expose for these assertions to pass:
//   [data-testid="align-control"]  — the control that transposes all songs
//   [data-song]                    — one per song (5 total), value = title
//   [data-testid="roman-row"]      — inside each [data-song], the constant
//                                     I / V / vi / IV row
//   [data-testid="chords"]         — inside each [data-song], the four
//                                     rendered chord labels for the current
//                                     key (a data-chord-label attribute or
//                                     the element's text content is fine)

const distPath = resolve("dist/index.html");
const NEXT_STEP =
  "Build the UI (Phase 2): render all 5 songs with an align control using the hooks named in spec/assignment-1.test.ts.";

describe("assignment 1: the shipped page", () => {
  it("dist/index.html exists (run `pnpm build` first)", () => {
    expect(existsSync(distPath), `${distPath} not found. ${NEXT_STEP}`).toBe(
      true,
    );
  });

  const doc = existsSync(distPath)
    ? new JSDOM(readFileSync(distPath, "utf8")).window.document
    : undefined;

  it("has an align control the visitor can use to transpose every song", () => {
    expect(
      doc?.querySelector('[data-testid="align-control"]'),
      `Missing [data-testid="align-control"]. ${NEXT_STEP}`,
    ).toBeTruthy();
  });

  it("shows all 5 songs", () => {
    const songEls = doc?.querySelectorAll("[data-song]") ?? [];
    expect(
      songEls.length,
      `Expected 5 [data-song] elements, found ${songEls.length}. ${NEXT_STEP}`,
    ).toBe(5);
  });

  it("each song exposes a constant I / V / vi / IV roman-numeral row", () => {
    const songEls = doc?.querySelectorAll("[data-song]") ?? [];
    expect(
      songEls.length,
      `No [data-song] elements found. ${NEXT_STEP}`,
    ).toBeGreaterThan(0);
    for (const songEl of songEls) {
      const romanRow = songEl.querySelector('[data-testid="roman-row"]');
      expect(
        romanRow,
        `[data-song="${songEl.getAttribute("data-song")}"] is missing [data-testid="roman-row"]. ${NEXT_STEP}`,
      ).toBeTruthy();
      const text = romanRow?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      for (const numeral of ["I", "V", "vi", "IV"]) {
        expect(
          text.includes(numeral),
          `roman-row for "${songEl.getAttribute("data-song")}" should include "${numeral}", got "${text}"`,
        ).toBe(true);
      }
    }
  });

  it("each song exposes its four chords for the current key", () => {
    const songEls = doc?.querySelectorAll("[data-song]") ?? [];
    expect(
      songEls.length,
      `No [data-song] elements found. ${NEXT_STEP}`,
    ).toBeGreaterThan(0);
    for (const songEl of songEls) {
      const chordsEl = songEl.querySelector('[data-testid="chords"]');
      expect(
        chordsEl,
        `[data-song="${songEl.getAttribute("data-song")}"] is missing [data-testid="chords"]. ${NEXT_STEP}`,
      ).toBeTruthy();
    }
  });
});

// This holds even before the DOM exists: the logic layer already guarantees
// the "visitor changes what they see" contract, independent of markup.
describe("assignment 1: the align invariant (logic layer)", () => {
  it("every song, rendered at ALIGN_KEY, produces identical chord labels", () => {
    const aligned = SONGS.map(() => chordLabelsForKey(ALIGN_KEY));
    const unique = new Set(aligned.map((labels) => labels.join(",")));
    expect(unique.size).toBe(1);
  });

  it("every song, rendered at its own tonic, differs from the others", () => {
    const perSong = SONGS.map((song) => chordLabelsForTonic(song.tonic));
    const unique = new Set(perSong.map((labels) => labels.join(",")));
    expect(unique.size).toBe(SONGS.length);
  });
});
