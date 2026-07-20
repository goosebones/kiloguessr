import { PLATES } from "@kiloguessr/engine";

/** plate weight (as a string key) → the key that loads it */
export type Keybinds = Record<string, string>;

export const DEFAULT_KEYBINDS: Keybinds = Object.fromEntries(
  PLATES.map((p, i) => [String(p.kg), String(i + 1)]),
);

const STORAGE_KEY = "kilo.keybinds";

/** Keys the game itself owns — they can't be bound to a plate. */
const RESERVED = new Set(["enter", "backspace", "escape", "tab", " "]);

export const isBindableKey = (key: string) =>
  key.length === 1 && key.trim() !== "" && !RESERVED.has(key.toLowerCase());

export function loadKeybinds(): Keybinds {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (raw && typeof raw === "object") return { ...DEFAULT_KEYBINDS, ...raw };
  } catch {
    /* storage unavailable — defaults */
  }
  return { ...DEFAULT_KEYBINDS };
}

export function saveKeybinds(binds: Keybinds) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(binds));
  } catch {
    /* session-only */
  }
}

/** Which plate a pressed key loads, or null if it isn't bound. */
export function plateForKey(binds: Keybinds, key: string): number | null {
  const pressed = key.toLowerCase();
  for (const [kg, bound] of Object.entries(binds)) {
    if (bound && bound.toLowerCase() === pressed) return Number(kg);
  }
  return null;
}

/** Rebind one plate, clearing whichever plate previously held that key. */
export function rebind(binds: Keybinds, kg: number, key: string): Keybinds {
  const next: Keybinds = { ...binds };
  for (const other of Object.keys(next)) {
    if (next[other] && next[other].toLowerCase() === key.toLowerCase()) next[other] = "";
  }
  next[String(kg)] = key;
  return next;
}
