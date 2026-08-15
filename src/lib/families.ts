// Recognition logic for "Write Your Own Hit" — pure, DOM-free, testable.
//
// The four chords (I, V, vi, IV) form a LOOP, and a loop has no fixed start:
// `I-V-vi-IV` and `vi-IV-I-V` are the same circle entered at a different bar.
// So the 24 orderings of these four degrees collapse into SIX cyclic-rotation
// FAMILIES of four rotations each. This module recognises the family from any
// ordering, then reports WHICH rotation the visitor built (which chord they
// started on) and what — honestly — lives there.
//
// Two of the six families are where pop's hits actually pooled (the Axis and
// the '50s / doo-wop change); the other four are the roads writers skipped.
// Every one of the 24 orderings lands on a true, named verdict — there is no
// dead "Uncharted" case, and no fabricated hit. Verified song claims are the
// only hardcoded strings; all character/theory text is DERIVED from the degree
// math (which chord you start on, which you end on), so rearranging within a
// family always changes the verdict and can never drift from the order.

import type { Degree } from "./chords";

export interface Verdict {
  name: string;
  body: string;
  songs: string;
}

// The five exhibit keys → the exhibit that lives in that key, for the Axis-on-I
// case, so "your A is their A" is name-dropped in the visitor's chosen key.
const AXIS_BY_KEY: Record<string, string> = {
  B: "“I’m Yours” (Jason Mraz)",
  F: "“Where Is the Love?” (Black Eyed Peas)",
  A: "“Someone Like You” (Adele)",
  D: "“With or Without You” (U2)",
  Eb: "“She Will Be Loved” (Maroon 5)",
};

// The household four that ride the Axis starting on I. The two that are also
// exhibits are written to match AXIS_BY_KEY exactly, so a simple equality dedup
// keeps the visitor's key-exhibit from being listed twice.
const HOUSEHOLD_AXIS = [
  "“Don’t Stop Believin’” (Journey)",
  "“Someone Like You” (Adele)",
  "“Let It Be” (The Beatles)",
  "“With or Without You” (U2)",
];

// --- Families --------------------------------------------------------------

export type FamilyKey = "A" | "B" | "C" | "D" | "E" | "F";

/** The verdict NAME for each family — the full, closed set of possible names. */
export const FAMILY_NAME: Record<FamilyKey, string> = {
  A: "The Axis",
  B: "The Undertow",
  C: "The Drift",
  D: "The ’50s / Doo-Wop",
  E: "The Deceptive Turn",
  F: "The Cliffhanger",
};

/** Every name `verdictFor` can return — the test's "known family-name set". */
export const FAMILY_NAMES: readonly string[] = Object.values(FAMILY_NAME);

// The I-first canonical form of each family's loop → its key. Every ordering of
// the four distinct degrees contains I exactly once, so rotating I to the front
// yields exactly one of these six representatives.
const CANON_TO_FAMILY: Record<string, FamilyKey> = {
  "I,V,vi,IV": "A",
  "I,V,IV,vi": "B",
  "I,vi,V,IV": "C",
  "I,vi,IV,V": "D",
  "I,IV,V,vi": "E",
  "I,IV,vi,V": "F",
};

/** Rotate an ordering so the I sits first — its canonical family representative. */
function rotateToIFirst(order: Degree[]): Degree[] {
  const at = order.indexOf("I");
  return at <= 0 ? order.slice() : [...order.slice(at), ...order.slice(0, at)];
}

/** Which of the six rotation families this ordering belongs to. */
export function familyOf(order: Degree[]): FamilyKey {
  return CANON_TO_FAMILY[rotateToIFirst(order).join(",")];
}

// --- Derived character (never a fabricated song) ---------------------------

/** How opening on a given degree feels — derived, not per-permutation. */
function describeStart(degree: Degree): string {
  switch (degree) {
    case "I":
      return "you open at home, on the I";
    case "V":
      return "you open on the V — the dominant, already leaning forward";
    case "vi":
      return "you open on the vi — the minor, in shadow from the first bar";
    case "IV":
      return "you open on the IV — the subdominant, a start mid-sentence";
  }
}

/** How closing on a given degree feels — derived, not per-permutation. */
function describeEnd(degree: Degree): string {
  switch (degree) {
    case "I":
      return ", and though it lands home on the I, the way there is one songwriters rarely take.";
    case "V":
      return ", and it ends on the V — an unclosed turnaround, the door left open.";
    case "vi":
      return ", and it ends on the vi — the minor, left hanging and unresolved.";
    case "IV":
      return ", and it ends on the IV — a plagal drift that never quite comes home.";
  }
}

/** "a, b and c" from a list, for prose. */
function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// --- The verdict -----------------------------------------------------------

/** The themed verdict for an arrangement (ordered degrees) in a chosen key. */
export function verdictFor(order: Degree[], key: string): Verdict {
  const sequence = order.join(",");
  const family = familyOf(order);
  const name = FAMILY_NAME[family];
  const start = order[0];
  const end = order[order.length - 1];

  // --- Family A: the Axis — verified rotations, then honest character -------
  if (family === "A") {
    if (sequence === "I,V,vi,IV") {
      const exhibit = AXIS_BY_KEY[key];
      const others = HOUSEHOLD_AXIS.filter((song) => song !== exhibit);
      return {
        name,
        body: "The most-used order in pop — the one this whole newspaper is about. I → V → vi → IV: home, and straight back to it.",
        songs: exhibit
          ? `In the key of ${key}, that’s the exact progression under ${exhibit} — the same four moves as ${joinList(others)}.`
          : `In ${key} it’s the same four moves that carry ${joinList(HOUSEHOLD_AXIS)}.`,
      };
    }
    if (sequence === "vi,IV,I,V") {
      return {
        name,
        body: "The same Axis loop, entered on the minor — vi → IV → I → V. Start on the sad chord and the same four turn to granite; that’s why it hits darker.",
        songs:
          "You just built “Zombie” (The Cranberries) and “Save Tonight” (Eagle-Eye Cherry) — the Axis, entered on the vi.",
      };
    }
    // The two rotations with no verified household hit: honest character only.
    return {
      name,
      body: `Four chords, all present — but ${describeStart(start)}${describeEnd(end)} Underneath, it’s still the Axis — entered on a later bar.`,
      songs:
        "No household hit sits exactly on this rotation, but the loop is the Axis — the four most-recorded chords in pop. Press play and hear where home lands.",
    };
  }

  // --- Family D: the '50s / doo-wop change — verified I, then character -----
  if (family === "D") {
    if (sequence === "I,vi,IV,V") {
      return {
        name,
        body: "Slow-dance the same four in this order and it’s 1958 again. I → vi → IV → V — the doo-wop change.",
        songs:
          "You just built “Stand By Me” (Ben E. King), “Earth Angel” (The Penguins) and “Every Breath You Take” (The Police) — the same four moves, in the doo-wop order.",
      };
    }
    return {
      name,
      body: `Four chords, all present — but ${describeStart(start)}${describeEnd(end)} Underneath, it’s the doo-wop change — entered on a later bar.`,
      songs:
        "No household hit sits exactly on this rotation, but the loop is the ’50s doo-wop change. Press play and hear it sway.",
    };
  }

  // --- Families B, C, E, F: the roads pop skipped — honest, no fake hits ----
  return {
    name,
    body: `Four chords, all present — but ${describeStart(start)}${describeEnd(end)} That’s a road pop mostly skipped.`,
    songs:
      "No household name camped on this loop — that’s the finding. Of the six ways to circle these four chords, the world’s hits pooled into just two. Press play and hear why the writers reached for the Axis instead.",
  };
}
