/** All weights are handled internally in quarter-kg integer units (Q) to avoid float drift. */
export const Q = 4;

export const COLLAR_KG = 2.5;

export interface PlateSpec {
  kg: number;
  /** IPF disc colour */
  fill: string;
  stroke: string;
  /** text colour that reads on the disc */
  ink: string;
  /** drawn height (∝ diameter) and thickness in SVG px */
  h: number;
  t: number;
}

export const PLATES: PlateSpec[] = [
  { kg: 25, fill: "#c8352c", stroke: "#8e241d", ink: "#ffffff", h: 240, t: 26 },
  { kg: 20, fill: "#2b5d9e", stroke: "#1d4173", ink: "#ffffff", h: 240, t: 23 },
  { kg: 15, fill: "#e3b71f", stroke: "#a88413", ink: "#1a1c20", h: 196, t: 20 },
  { kg: 10, fill: "#3a7d44", stroke: "#27582f", ink: "#ffffff", h: 172, t: 17 },
  { kg: 5, fill: "#e9e6de", stroke: "#a8a598", ink: "#1a1c20", h: 140, t: 14 },
  { kg: 2.5, fill: "#232327", stroke: "#5b5b64", ink: "#ffffff", h: 116, t: 12 },
  { kg: 1.25, fill: "#b9bec6", stroke: "#83898f", ink: "#1a1c20", h: 96, t: 10 },
  { kg: 0.5, fill: "#b9bec6", stroke: "#83898f", ink: "#1a1c20", h: 84, t: 9 },
  { kg: 0.25, fill: "#b9bec6", stroke: "#83898f", ink: "#1a1c20", h: 74, t: 8 },
];

export const plateByKg = (kg: number): PlateSpec | undefined =>
  PLATES.find((p) => p.kg === kg);

/** Max-load options: bar 20 + collars + one more pair of reds per step. */
export const MAXES = [75, 125, 175, 225, 275, 325, 375, 425, 475, 525];

/** Format a kg value without trailing zeros ("187.5", "61.25", "100"). */
export const fmt = (kg: number): string =>
  (Math.round(kg * 100) / 100).toString();
