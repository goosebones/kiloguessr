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

export const SPRINT_CARDS = 10;
export const SPRINT_MISS_PENALTY_SEC = 10;
