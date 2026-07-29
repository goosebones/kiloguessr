"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const MESSAGE =
  "This score's timing looks automated rather than played. It's flagged for review.";

/**
 * Burglar: beanie, then an eye mask with the eyes cut out of it, then the jaw.
 * The cut-outs are what make it legible at 18px — a solid band just reads as
 * a blob.
 */
function Glyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      {/* beanie and its brim */}
      <path d="M4.8 8.3a7.2 7.2 0 0 1 14.4 0z" fill="currentColor" />
      <rect x="3.5" y="8.1" width="17" height="2.1" rx="1.05" fill="currentColor" />
      {/* jaw */}
      <path
        d="M6 12.2v1.9a6 6 0 0 0 12 0v-1.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* mask band, with the two eyes punched through it */}
      <path
        fillRule="evenodd"
        fill="currentColor"
        d="M4.6 11.2h14.8v3.6H4.6z
           M10.5 13a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 1 1 2.4 0z
           M15.9 13a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 1 1 2.4 0z"
      />
    </svg>
  );
}

interface Pos {
  top: number;
  left: number;
  /** rendered under the icon because there was no room above */
  below: boolean;
}

/**
 * Marks a leaderboard score whose run was flagged as machine-paced.
 *
 * The note opens on hover for pointers and on tap for touch — hover alone
 * would leave the icon meaningless on a phone. It's positioned fixed because
 * the board scrolls horizontally, which would otherwise clip it.
 */
export default function SuspectFlag() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const wasTouch = useRef(false);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const width = Math.min(240, window.innerWidth - 24);
    const below = r.top < 120;
    setPos({
      top: below ? r.bottom + 10 : r.top - 10,
      left: Math.min(
        Math.max(12, r.left + r.width / 2 - width / 2),
        Math.max(12, window.innerWidth - width - 12),
      ),
      below,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return;
      if (e.type === "pointerdown" && btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="suspect"
        aria-label={MESSAGE}
        aria-expanded={open}
        onPointerDown={(e) => {
          wasTouch.current = e.pointerType !== "mouse";
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setOpen(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setOpen(false);
        }}
        // a mouse click shouldn't dismiss what hovering just opened
        onClick={() => setOpen((o) => (wasTouch.current ? !o : true))}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Glyph />
      </button>
      {open && pos && (
        <span
          role="tooltip"
          className={`suspect-tip${pos.below ? " below" : ""}`}
          style={{ top: pos.top, left: pos.left }}
        >
          {MESSAGE}
        </span>
      )}
    </>
  );
}
