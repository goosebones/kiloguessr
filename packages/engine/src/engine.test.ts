import { describe, expect, it } from "vitest";
import {
  answersMatch,
  baseQ,
  decomposeSide,
  describeSide,
  fmt,
  loadMatches,
  platesDescending,
  generateCard,
  loadedTotalQ,
  mulberry32,
  parseAnswer,
  Q,
  totalKg,
  type GameSettings,
} from "./index";

const S: GameSettings = { bar: 20, collars: true, smallest: 1.25, max: 375 };

describe("fmt", () => {
  it("drops trailing zeros", () => {
    expect(fmt(187.5)).toBe("187.5");
    expect(fmt(61.25)).toBe("61.25");
    expect(fmt(100)).toBe("100");
    expect(fmt(2.5)).toBe("2.5");
  });
});

describe("describeSide", () => {
  it("groups repeats with a count, biggest first", () => {
    expect(describeSide([25, 25, 5, 2.5])).toBe("25(2) - 5 - 2.5");
    expect(describeSide([25, 25, 25, 25, 25, 10, 2.5])).toBe("25(5) - 10 - 2.5");
    expect(describeSide([20])).toBe("20");
    expect(describeSide([1.25, 1.25])).toBe("1.25(2)");
    expect(describeSide([])).toBe("");
  });
});

describe("decomposeSide", () => {
  it("is exact for every multiple of the smallest plate", () => {
    for (let q = 0; q <= 200 * Q; q += 1.25 * Q) {
      const plates = decomposeSide(q, 1.25);
      expect(plates).not.toBeNull();
      const sum = plates!.reduce((a, b) => a + b * Q, 0);
      expect(sum).toBe(q);
    }
  });

  it("loads reds first like a meet loader", () => {
    expect(decomposeSide(60 * Q, 2.5)).toEqual([25, 25, 10]);
    expect(decomposeSide(27.5 * Q, 2.5)).toEqual([25, 2.5]);
  });

  it("returns null when the remainder is unreachable", () => {
    expect(decomposeSide(1.25 * Q, 2.5)).toBeNull();
  });
});

describe("generateCard", () => {
  it("respects max, minimum side, and step granularity", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 500; i++) {
      const c = generateCard(S, rng);
      const side = (c.totalQ - baseQ(S)) / 2;
      expect(totalKg(c)).toBeLessThanOrEqual(S.max);
      expect(side).toBeGreaterThanOrEqual(10 * Q);
      expect(side % (S.smallest * Q)).toBe(0);
      const sum = c.sidePlates.reduce((a, b) => a + b * Q, 0);
      expect(sum).toBe(side);
    }
  });

  it("is deterministic for a given seed", () => {
    const a = Array.from({ length: 20 }, (_, i) =>
      generateCard(S, mulberry32(7), undefined),
    );
    const b = Array.from({ length: 20 }, (_, i) =>
      generateCard(S, mulberry32(7), undefined),
    );
    expect(a).toEqual(b);
  });

  it("avoids repeating the previous total", () => {
    const rng = mulberry32(1);
    let prev = generateCard(S, rng);
    for (let i = 0; i < 200; i++) {
      const next = generateCard(S, rng, prev);
      expect(next.totalQ).not.toBe(prev.totalQ);
      prev = next;
    }
  });
});

describe("parseAnswer", () => {
  it("accepts comma decimals", () => {
    expect(parseAnswer("147,5")).toBe(147.5);
    expect(parseAnswer(" 187.5 ")).toBe(187.5);
  });
  it("rejects junk and empty", () => {
    expect(parseAnswer("")).toBeNull();
    expect(parseAnswer("abc")).toBeNull();
  });
});

describe("answersMatch (2/7 shorthand)", () => {
  it("matches exact answers", () => {
    expect(answersMatch(187.5, 187.5)).toBe(true);
    expect(answersMatch(102, 102)).toBe(true);
  });
  it("expands integers ending in 2 or 7", () => {
    expect(answersMatch(187, 187.5)).toBe(true);
    expect(answersMatch(102, 102.5)).toBe(true);
    expect(answersMatch(367, 367.5)).toBe(true);
  });
  it("does not expand other endings or non-integers", () => {
    expect(answersMatch(183, 183.5)).toBe(false);
    expect(answersMatch(187.2, 187.7)).toBe(false);
    expect(answersMatch(187, 187)).toBe(true);
    expect(answersMatch(187, 188)).toBe(false);
  });
});

describe("loadMatches", () => {
  it("accepts only the exact loading, in order", () => {
    expect(loadMatches([25, 25, 10, 2.5], [25, 25, 10, 2.5])).toBe(true);
    expect(loadMatches([], [])).toBe(true);
  });

  it("rejects the right weight built from the wrong plates", () => {
    // 25 + 25 = 50, same weight as twenty 2.5s — not the same bar
    const twenties = Array.from({ length: 20 }, () => 2.5);
    expect(loadMatches(twenties, [25, 25])).toBe(false);
    expect(loadMatches([20, 15, 15], [25, 25])).toBe(false);
  });

  it("rejects the right plates in the wrong order", () => {
    expect(loadMatches([25, 1.25, 25], [25, 25, 1.25])).toBe(false);
    expect(loadMatches([10, 25], [25, 10])).toBe(false);
  });

  it("rejects partial or padded loads", () => {
    expect(loadMatches([25], [25, 25])).toBe(false);
    expect(loadMatches([25, 25, 25], [25, 25])).toBe(false);
  });
});

describe("platesDescending", () => {
  it("allows equal neighbours, rejects a heavier plate outside a lighter one", () => {
    expect(platesDescending([25, 25, 10, 1.25])).toBe(true);
    expect(platesDescending([25, 10, 25])).toBe(false);
    expect(platesDescending([])).toBe(true);
  });
});

describe("loadedTotalQ", () => {
  it("computes bar + collars + both sides", () => {
    // 20 bar + 5 collars + 2×(25+2.5) = 80
    expect(loadedTotalQ(S, [25, 2.5])).toBe(80 * Q);
    expect(loadedTotalQ(S, [])).toBe(25 * Q);
  });
});
