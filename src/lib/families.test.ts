import { describe, expect, it } from "vitest";
import type { Degree } from "./chords";
import { FAMILY_NAME, FAMILY_NAMES, familyOf, verdictFor } from "./families";

// The four chords form a loop, so the 24 orderings collapse into six
// cyclic-rotation families. These tests lock the two guarantees the piece
// promises: EVERY one of the 24 orderings lands on a true, named verdict (no
// dead "Uncharted", no empty field), and rearranging within a family still
// changes the verdict (rotation awareness).

const DEGREES: Degree[] = ["I", "V", "vi", "IV"];

/** All 24 orderings of the four distinct degrees. */
function permutations(items: Degree[]): Degree[][] {
  if (items.length <= 1) return [items.slice()];
  const out: Degree[][] = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const tail of permutations(rest)) out.push([item, ...tail]);
  });
  return out;
}

const ALL_ORDERS = permutations(DEGREES);

/** Every left-rotation of an ordering (the four members of its family). */
function rotations(order: Degree[]): Degree[][] {
  return order.map((_, i) => [...order.slice(i), ...order.slice(0, i)]);
}

describe("the 24 orderings each land on a true, named verdict", () => {
  it("produces all 24 distinct orderings", () => {
    const unique = new Set(ALL_ORDERS.map((o) => o.join(",")));
    expect(unique.size).toBe(24);
  });

  for (const order of ALL_ORDERS) {
    const seq = order.join(",");
    it(`[${seq}] → a named, non-empty verdict (never Uncharted)`, () => {
      const v = verdictFor(order, "C");
      expect(FAMILY_NAMES).toContain(v.name);
      expect(v.name).not.toBe("Uncharted");
      expect(v.name.trim().length).toBeGreaterThan(0);
      expect(v.body.trim().length).toBeGreaterThan(0);
      expect(v.songs.trim().length).toBeGreaterThan(0);
    });
  }

  it("no ordering ever returns the empty/Uncharted verdict, in any key", () => {
    for (const key of ["C", "A", "D", "Eb", "B", "F", "G"]) {
      for (const order of ALL_ORDERS) {
        const v = verdictFor(order, key);
        expect(FAMILY_NAMES).toContain(v.name);
        expect(v.name).not.toBe("Uncharted");
      }
    }
  });
});

describe("families are the four rotations of one loop", () => {
  it("all four rotations of the Axis return the Axis family name", () => {
    for (const order of rotations(["I", "V", "vi", "IV"])) {
      expect(familyOf(order)).toBe("A");
      expect(verdictFor(order, "C").name).toBe(FAMILY_NAME.A);
    }
  });

  it("all four rotations of the doo-wop loop return the Doo-Wop family name", () => {
    for (const order of rotations(["I", "vi", "IV", "V"])) {
      expect(familyOf(order)).toBe("D");
      expect(verdictFor(order, "C").name).toBe(FAMILY_NAME.D);
    }
  });

  it("the six families partition all 24 orderings (four each)", () => {
    const counts: Record<string, number> = {};
    for (const order of ALL_ORDERS) {
      const fam = familyOf(order);
      counts[fam] = (counts[fam] ?? 0) + 1;
    }
    expect(Object.keys(counts).sort()).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(Object.values(counts)).toEqual([4, 4, 4, 4, 4, 4]);
  });
});

describe("key-awareness and rotation-awareness are preserved", () => {
  it("the I-first Axis in key A name-drops the A-major exhibit", () => {
    const v = verdictFor(["I", "V", "vi", "IV"], "A");
    expect(v.name).toBe(FAMILY_NAME.A);
    expect(v.songs).toMatch(/Someone Like You/);
  });

  it("two distinct rotations of the Axis produce different body/songs text", () => {
    const iFirst = verdictFor(["I", "V", "vi", "IV"], "C");
    const viFirst = verdictFor(["vi", "IV", "I", "V"], "C");
    expect(iFirst.name).toBe(viFirst.name); // same family name
    expect(iFirst.body).not.toBe(viFirst.body);
    expect(iFirst.songs).not.toBe(viFirst.songs);
  });

  it("every rotation within a family yields a distinct body (rotation awareness)", () => {
    for (const rep of [
      ["I", "V", "vi", "IV"],
      ["I", "V", "IV", "vi"],
      ["I", "vi", "V", "IV"],
      ["I", "vi", "IV", "V"],
      ["I", "IV", "V", "vi"],
      ["I", "IV", "vi", "V"],
    ] as Degree[][]) {
      const bodies = rotations(rep).map((o) => verdictFor(o, "C").body);
      expect(new Set(bodies).size).toBe(4);
    }
  });
});
