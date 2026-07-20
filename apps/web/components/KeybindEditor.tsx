"use client";

import { useEffect, useState } from "react";
import { PLATES, fmt } from "@kiloguessr/engine";
import {
  DEFAULT_KEYBINDS,
  isBindableKey,
  rebind,
  type Keybinds,
} from "../lib/keybinds";

export default function KeybindEditor({
  binds,
  smallest,
  onChange,
}: {
  binds: Keybinds;
  /** only offer plates that are actually in play */
  smallest: number;
  onChange: (next: Keybinds) => void;
}) {
  const [listening, setListening] = useState<number | null>(null);

  useEffect(() => {
    if (listening === null) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setListening(null);
        return;
      }
      if (!isBindableKey(e.key)) return;
      onChange(rebind(binds, listening, e.key));
      setListening(null);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [binds, listening, onChange]);

  return (
    <div className="keybinds">
      <div className="keybind-row">
        {PLATES.filter((p) => p.kg >= smallest).map((p) => {
          const key = binds[String(p.kg)] ?? "";
          const active = listening === p.kg;
          return (
            <button
              key={p.kg}
              className={`keybind ${active ? "listening" : ""}`}
              onClick={() => setListening(active ? null : p.kg)}
              aria-label={`Change the key for the ${fmt(p.kg)} kg plate`}
            >
              <span
                className="keybind-plate"
                style={{ background: p.fill, borderColor: p.stroke, color: p.ink }}
              >
                {fmt(p.kg)}
              </span>
              <kbd>{active ? "press…" : key || "—"}</kbd>
            </button>
          );
        })}
      </div>
      <div className="keybind-actions">
        <span className="account-note" style={{ fontSize: 12 }}>
          {listening !== null
            ? "Press any key to bind it, Escape to cancel."
            : "Click a plate, then press the key you want."}
        </span>
        <button className="link-btn" onClick={() => onChange({ ...DEFAULT_KEYBINDS })}>
          Reset to 1–9
        </button>
      </div>
    </div>
  );
}
