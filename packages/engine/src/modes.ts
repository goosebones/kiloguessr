import type { GameSettings } from "./cards";

export interface EnduranceConfig {
  startSec: number;
  gainSec: number;
  lossSec: number;
}

/** Prototype/practice behaviour. */
export const PRACTICE_ENDURANCE: EnduranceConfig = {
  startSec: 60,
  gainSec: 3,
  lossSec: 10,
};

/** Ranked ruleset (PLAN.md): tighter reward, standardized settings. */
export const RANKED_ENDURANCE: EnduranceConfig = {
  startSec: 60,
  gainSec: 2,
  lossSec: 10,
};

export const RANKED_SETTINGS: GameSettings = {
  bar: 20,
  collars: true,
  smallest: 1.25,
  max: 375,
};

/** Good lifts needed to finish a sprint — the clock is the score. */
export const SPRINT_TARGET = 10;
/** Card surplus issued for a sprint, since misses need replacements. */
export const SPRINT_MAX_CARDS = 60;
/**
 * Cards issued for an endurance run. A strong player nets time on every lift
 * (+2s for a sub-2s answer), so the batch — not the clock — is the real
 * ceiling; keep it far above any human's reach. 500 stopped being far enough:
 * five lifters reached it, one on a perfect 500/500.
 */
export const ENDURANCE_MAX_CARDS = 1500;
