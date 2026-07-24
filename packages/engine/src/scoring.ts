import { generateCard, totalKg, type Card } from "./cards";
import { answersMatch, loadMatches, parseAnswer } from "./grading";
import {
  ENDURANCE_MAX_CARDS,
  RANKED_ENDURANCE,
  RANKED_SETTINGS,
  SPRINT_MAX_CARDS,
  SPRINT_TARGET,
} from "./modes";
import { mulberry32 } from "./rng";

export type RankedMode =
  | "endurance-read"
  | "endurance-load"
  | "sprint-read"
  | "sprint-load";

export const RANKED_MODES: RankedMode[] = [
  "endurance-read",
  "endurance-load",
  "sprint-read",
  "sprint-load",
];

export const MODE_LABELS: Record<RankedMode, string> = {
  "endurance-read": "Endurance · Read",
  "endurance-load": "Endurance · Load",
  "sprint-read": "Sprint · Read",
  "sprint-load": "Sprint · Load",
};

export const isRankedMode = (m: string): m is RankedMode =>
  (RANKED_MODES as string[]).includes(m);
export const isLoadMode = (m: RankedMode) => m.endsWith("-load");
export const isEndurance = (m: RankedMode) => m.startsWith("endurance-");

/** Both formats get a surplus batch — runs end on the clock, not the cards. */
export const cardsPerRun = (m: RankedMode) =>
  isEndurance(m) ? ENDURANCE_MAX_CARDS : SPRINT_MAX_CARDS;

/** Deterministic card batch for a run — identical on client and server. */
export function generateRunCards(mode: RankedMode, seed: number): Card[] {
  const rng = mulberry32(seed);
  const out: Card[] = [];
  let prev: Card | undefined;
  for (let i = 0; i < cardsPerRun(mode); i++) {
    prev = generateCard(RANKED_SETTINGS, rng, prev);
    out.push(prev);
  }
  return out;
}

export interface SubmittedAnswer {
  /** read mode: what the player typed */
  answer?: string;
  /** load mode: plates the player put on one side */
  plates?: number[];
  /** milliseconds spent on this card */
  ms: number;
}

export function gradeAnswer(
  mode: RankedMode,
  card: Card,
  a: SubmittedAnswer,
): boolean {
  if (isLoadMode(mode)) {
    if (!Array.isArray(a.plates)) return false;
    return loadMatches(a.plates, card.sidePlates);
  }
  const n = parseAnswer(String(a.answer ?? ""));
  return n !== null && answersMatch(n, totalKg(card));
}

/**
 * Below this per-card time a human cannot have read the bar and typed an
 * answer — a run containing one is scripted, not played. Deliberately well
 * under a plausible fast human (~700 ms) so real players are never rejected.
 */
export const MIN_CARD_MS = 350;

export interface RunScore {
  valid: boolean;
  reason?: string;
  /** endurance: good lifts (higher better). sprint: milliseconds (lower better). */
  score: number;
  correct: number;
  attempts: number;
  accuracy: number;
  verdicts: boolean[];
  playedMs: number;
}

const invalid = (reason: string): RunScore => ({
  valid: false,
  reason,
  score: 0,
  correct: 0,
  attempts: 0,
  accuracy: 0,
  verdicts: [],
  playedMs: 0,
});

/**
 * Authoritative scoring: re-generates the run's cards from its seed and
 * replays the submitted answers, re-simulating the endurance clock so the
 * client can never assert its own score.
 */
export function scoreRun(
  mode: RankedMode,
  seed: number,
  answers: SubmittedAnswer[],
): RunScore {
  if (!Array.isArray(answers)) return invalid("No answers submitted.");
  const cards = generateRunCards(mode, seed);
  if (answers.length > cards.length) return invalid("More answers than cards.");
  for (const a of answers) {
    if (!Number.isFinite(a.ms) || a.ms < 0) return invalid("Bad card timing.");
    if (a.ms < MIN_CARD_MS) return invalid("Impossibly fast answer.");
  }

  const verdicts: boolean[] = [];
  let correct = 0;
  let playedMs = 0;

  if (isEndurance(mode)) {
    let remaining = RANKED_ENDURANCE.startSec * 1000;
    for (let i = 0; i < answers.length; i++) {
      const a = answers[i];
      remaining -= a.ms;
      playedMs += a.ms;
      // clock ran out while this card was on screen — the answer doesn't count
      if (remaining <= 0) break;
      const ok = gradeAnswer(mode, cards[i], a);
      verdicts.push(ok);
      if (ok) {
        correct++;
        remaining += RANKED_ENDURANCE.gainSec * 1000;
      } else {
        remaining -= RANKED_ENDURANCE.lossSec * 1000;
      }
      if (remaining <= 0) break;
    }
    const attempts = verdicts.length;
    return {
      valid: true,
      score: correct,
      correct,
      attempts,
      accuracy: attempts ? correct / attempts : 0,
      verdicts,
      playedMs,
    };
  }

  // Sprint: race to SPRINT_TARGET good lifts. A miss isn't penalised directly —
  // it costs you the card you spent plus the replacement you now have to answer.
  for (let i = 0; i < answers.length; i++) {
    playedMs += answers[i].ms;
    const ok = gradeAnswer(mode, cards[i], answers[i]);
    verdicts.push(ok);
    if (ok) correct++;
    if (correct >= SPRINT_TARGET) break;
  }
  if (correct < SPRINT_TARGET) {
    return invalid(`A sprint needs ${SPRINT_TARGET} good lifts to post a time.`);
  }
  return {
    valid: true,
    score: playedMs,
    correct,
    attempts: verdicts.length,
    accuracy: verdicts.length ? correct / verdicts.length : 0,
    verdicts,
    playedMs,
  };
}

/** Normalizes every mode so that a larger number is always a better result. */
export function rankValue(mode: RankedMode, score: number): number {
  return isEndurance(mode) ? Math.max(0, score) : Math.max(0, 10_000_000 - score);
}

const TS_MAX = 4102444800000; // 2100-01-01

/**
 * DynamoDB GSI sort key. Queried descending: best score first, and within a
 * tie the earlier submission ranks higher.
 */
export function boardSortKey(
  mode: RankedMode,
  score: number,
  submittedAt: number,
): string {
  const rv = String(rankValue(mode, score)).padStart(10, "0");
  const ts = String(Math.max(0, TS_MAX - submittedAt)).padStart(14, "0");
  return `${rv}#${ts}`;
}

export const isBetter = (mode: RankedMode, next: number, prev: number) =>
  rankValue(mode, next) > rankValue(mode, prev);

/**
 * Weekly board bucket. Weeks run Monday 00:00 America/New_York through
 * Sunday 23:59 — i.e. the board resets Sunday at midnight Eastern.
 */
export function weekKey(at: Date = new Date()): string {
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
  const [y, m, d] = local.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // ISO-8601 week number (Monday start, Thursday decides the year)
  const dayNum = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3);
  const isoYear = dt.getUTCFullYear();
  const firstThu = new Date(Date.UTC(isoYear, 0, 4));
  firstThu.setUTCDate(firstThu.getUTCDate() - ((firstThu.getUTCDay() + 6) % 7) + 3);
  const week = 1 + Math.round((dt.getTime() - firstThu.getTime()) / (7 * 86400000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/** Human-readable score for a board row. */
export function formatScore(mode: RankedMode, score: number): string {
  if (isEndurance(mode)) return `${score}`;
  return `${(score / 1000).toFixed(1)}s`;
}
