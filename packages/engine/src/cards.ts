import { COLLAR_KG, PLATES, Q } from "./plates";
import type { Rng } from "./rng";

export interface GameSettings {
  /** bar weight in kg (25 | 20 | 15) */
  bar: number;
  collars: boolean;
  /** smallest plate in play (5 | 2.5 | 1.25 | 0.25) */
  smallest: number;
  /** maximum total in kg */
  max: number;
  /** minimum total in kg; 0/undefined means "anything the bar can hold" */
  min?: number;
}

export interface Card {
  /** total loaded weight in quarter-kg units */
  totalQ: number;
  /** plates on one side, largest→smallest, in kg */
  sidePlates: number[];
}

export const totalKg = (card: Card): number => card.totalQ / Q;

/** Bar + collars in quarter units. */
export const baseQ = (s: GameSettings): number =>
  (s.bar + (s.collars ? 2 * COLLAR_KG : 0)) * Q;

/** Greedy meet-loading decomposition of one side. Exact for this plate set. */
export function decomposeSide(sideQ: number, smallest: number): number[] | null {
  const out: number[] = [];
  let rem = sideQ;
  for (const p of PLATES) {
    if (p.kg < smallest) break;
    const pq = p.kg * Q;
    while (rem >= pq) {
      out.push(p.kg);
      rem -= pq;
    }
  }
  return rem === 0 ? out : null;
}

const MIN_SIDE_KG = 10;

/** Random achievable card under the settings; avoids repeating `prev`'s total. */
export function generateCard(s: GameSettings, rng: Rng, prev?: Card): Card {
  const base = baseQ(s);
  const stepQ = s.smallest * Q;
  // A minimum total asks for at least this much per side, but never less than
  // a bar worth loading at all.
  const wantedSideQ = Math.max(MIN_SIDE_KG * Q, ((s.min ?? 0) * Q - base) / 2);
  const loQ = Math.ceil(wantedSideQ / stepQ) * stepQ;
  let hiQ = Math.floor((s.max * Q - base) / 2 / stepQ) * stepQ;
  if (hiQ < loQ) hiQ = loQ;

  let sideQ = loQ;
  for (let tries = 0; tries < 8; tries++) {
    const steps = Math.floor(rng() * ((hiQ - loQ) / stepQ + 1));
    sideQ = loQ + steps * stepQ;
    if (!prev || base + 2 * sideQ !== prev.totalQ) break;
  }

  return {
    totalQ: base + 2 * sideQ,
    sidePlates: decomposeSide(sideQ, s.smallest) ?? [],
  };
}
