import { describe, expect, it } from "vitest";
import {
  MIN_CARD_MS,
  RANKED_SETTINGS,
  boardSortKey,
  cardsPerRun,
  fmt,
  formatScore,
  generateRunCards,
  isBetter,
  rankValue,
  scoreRun,
  totalKg,
  weekKey,
  type SubmittedAnswer,
} from "./index";

const SEED = 12345;
const cards = generateRunCards("endurance-read", SEED);

/** A correct typed answer for card i. */
const right = (i: number, ms = 1500): SubmittedAnswer => ({
  answer: fmt(totalKg(cards[i])),
  ms,
});
const wrong = (ms = 1500): SubmittedAnswer => ({ answer: "1", ms });

describe("generateRunCards", () => {
  it("is deterministic for a seed and sized per mode", () => {
    expect(generateRunCards("endurance-read", SEED)).toEqual(cards);
    expect(cards).toHaveLength(cardsPerRun("endurance-read"));
    expect(generateRunCards("sprint-read", SEED)).toHaveLength(
      cardsPerRun("sprint-read"),
    );
  });

  it("uses the ranked settings", () => {
    for (const c of cards) {
      expect(totalKg(c)).toBeLessThanOrEqual(RANKED_SETTINGS.max);
    }
  });
});

describe("scoreRun — endurance", () => {
  it("counts good lifts and stops when the clock dies", () => {
    // 60s start, +2 per hit, -10 per miss, 1.5s per card
    const answers = [right(0), right(1), wrong(), right(3)];
    const r = scoreRun("endurance-read", SEED, answers);
    expect(r.valid).toBe(true);
    expect(r.correct).toBe(3);
    expect(r.score).toBe(3);
    expect(r.verdicts).toEqual([true, true, false, true]);
    expect(r.accuracy).toBeCloseTo(0.75);
  });

  it("ignores answers made after the clock expired", () => {
    // six misses: 60 - 6*(1.5+10) = well below zero partway through
    const answers = Array.from({ length: 20 }, () => wrong());
    const r = scoreRun("endurance-read", SEED, answers);
    expect(r.valid).toBe(true);
    expect(r.correct).toBe(0);
    // 60s, each miss costs 1.5s played + 10s penalty: 48.5 → 37 → 25.5 → 14
    // → 2.5, and the 6th card still appears with 1s left before going under.
    expect(r.attempts).toBe(6);
  });

  it("accepts the 2/7 shorthand", () => {
    const total = totalKg(cards[0]);
    if (total % 1 === 0.5) {
      const r = scoreRun("endurance-read", SEED, [{ answer: String(total - 0.5), ms: 1500 }]);
      expect(r.correct).toBe(1);
    }
    // synthetic check that shorthand flows through grading
    const idx = cards.findIndex((c) => totalKg(c) % 1 === 0.5);
    if (idx >= 0) {
      const answers = Array.from({ length: idx }, (_, i) => right(i));
      answers.push({ answer: String(totalKg(cards[idx]) - 0.5), ms: 1500 });
      const r = scoreRun("endurance-read", SEED, answers);
      expect(r.verdicts[idx]).toBe(true);
    }
  });

  it("rejects impossibly fast cards", () => {
    const r = scoreRun("endurance-read", SEED, [right(0, MIN_CARD_MS - 1)]);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/fast/i);
  });

  it("rejects more answers than cards", () => {
    const tooMany = cardsPerRun("endurance-read") + 10;
    const answers = Array.from({ length: tooMany }, (_, i) => right(i % 100));
    expect(scoreRun("endurance-read", SEED, answers).valid).toBe(false);
  });
});

describe("scoreRun — sprint", () => {
  const sprintCards = generateRunCards("sprint-read", SEED);
  const sRight = (i: number, ms = 2000): SubmittedAnswer => ({
    answer: fmt(totalKg(sprintCards[i])),
    ms,
  });

  it("scores the time taken to land ten good lifts", () => {
    const all = Array.from({ length: 10 }, (_, i) => sRight(i));
    const clean = scoreRun("sprint-read", SEED, all);
    expect(clean.valid).toBe(true);
    expect(clean.score).toBe(20000);
    expect(clean.correct).toBe(10);
    expect(clean.attempts).toBe(10);
  });

  it("charges a miss only the time it cost", () => {
    // miss card 0, then ten correct — 11 cards of 2s each
    const answers: SubmittedAnswer[] = [{ answer: "1", ms: 2000 }];
    for (let i = 1; i <= 10; i++) answers.push(sRight(i));
    const r = scoreRun("sprint-read", SEED, answers);
    expect(r.valid).toBe(true);
    expect(r.score).toBe(22000);
    expect(r.correct).toBe(10);
    expect(r.attempts).toBe(11);
    expect(r.accuracy).toBeCloseTo(10 / 11);
  });

  it("stops the clock on the tenth good lift", () => {
    const answers = Array.from({ length: 10 }, (_, i) => sRight(i));
    answers.push(sRight(10, 9999)); // an extra answer after the target
    const r = scoreRun("sprint-read", SEED, answers);
    expect(r.score).toBe(20000);
    expect(r.attempts).toBe(10);
  });

  it("won't post a time without ten good lifts", () => {
    const short = Array.from({ length: 9 }, (_, i) => sRight(i));
    const r = scoreRun("sprint-read", SEED, short);
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/good lifts/i);
  });
});

describe("ranking", () => {
  it("treats higher as better for endurance, lower for sprint", () => {
    expect(isBetter("endurance-read", 20, 15)).toBe(true);
    expect(isBetter("endurance-read", 10, 15)).toBe(false);
    expect(isBetter("sprint-read", 30000, 45000)).toBe(true);
    expect(isBetter("sprint-read", 60000, 45000)).toBe(false);
    expect(rankValue("sprint-read", 0)).toBeGreaterThan(rankValue("sprint-read", 1));
  });

  it("sorts descending by score, then by earlier submission", () => {
    const keys = [
      boardSortKey("endurance-read", 12, 2_000_000_000),
      boardSortKey("endurance-read", 30, 2_000_000_000),
      boardSortKey("endurance-read", 30, 1_000_000_000), // earlier, same score
    ];
    const sortedDesc = [...keys].sort().reverse();
    expect(sortedDesc[0]).toBe(keys[2]);
    expect(sortedDesc[1]).toBe(keys[1]);
    expect(sortedDesc[2]).toBe(keys[0]);
  });

  it("formats scores per mode", () => {
    expect(formatScore("endurance-read", 27)).toBe("27");
    expect(formatScore("sprint-read", 42350)).toBe("42.4s");
  });
});

describe("weekKey", () => {
  it("rolls over at Sunday midnight Eastern (Monday 00:00 ET)", () => {
    // 2026-07-19 is a Sunday. 23:59 ET = 2026-07-20T03:59Z
    const sundayLate = new Date("2026-07-20T03:59:00Z");
    // 00:01 ET Monday = 2026-07-20T04:01Z
    const mondayEarly = new Date("2026-07-20T04:01:00Z");
    expect(weekKey(sundayLate)).not.toBe(weekKey(mondayEarly));
  });

  it("keeps a whole Mon–Sun week together", () => {
    const mon = new Date("2026-07-20T12:00:00Z");
    const sat = new Date("2026-07-25T12:00:00Z");
    expect(weekKey(mon)).toBe(weekKey(sat));
  });

  it("formats as ISO year-week", () => {
    expect(weekKey(new Date("2026-07-22T12:00:00Z"))).toMatch(/^\d{4}-W\d{2}$/);
  });
});
