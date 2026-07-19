import { Q } from "./plates";
import { baseQ, type GameSettings } from "./cards";

/** Parse a typed answer; accepts comma decimals ("147,5"). Null if not a number. */
export function parseAnswer(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const EPS = 0.001;

/**
 * Read-mode grading. An integer ending in 2 or 7 is shorthand for the .5
 * (187 reads as 187.5) — unambiguous when totals are multiples of 2.5.
 * An exact answer always wins.
 */
export function answersMatch(ans: number, total: number): boolean {
  if (Math.abs(ans - total) < EPS) return true;
  const lastDigit = Math.abs(Math.round(ans)) % 10;
  return (
    ans % 1 === 0 &&
    (lastDigit === 2 || lastDigit === 7) &&
    Math.abs(ans + 0.5 - total) < EPS
  );
}

/** Load-mode: total in quarter units for a player-built side. */
export function loadedTotalQ(s: GameSettings, sidePlates: number[]): number {
  return sidePlates.reduce((q, kg) => q + 2 * kg * Q, baseQ(s));
}
