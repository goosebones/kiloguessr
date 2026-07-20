"use client";

import { fmt, plateByKg } from "@kiloguessr/engine";

/** One sleeve of a loaded bar: shaft, plates (largest→smallest), collar. */
export default function Barbell({
  plates,
  collars,
  hidden,
}: {
  plates: number[];
  collars: boolean;
  /** empty bar — used before a card starts */
  hidden?: boolean;
}) {
  const cy = 150;
  let x = 192;
  const drawn = hidden
    ? []
    : plates.map((kg) => {
        const p = plateByKg(kg)!;
        const at = x;
        x += p.t + 3;
        return { p, x: at };
      });
  const collarX = x + 2;

  return (
    <svg viewBox="0 0 900 300" role="img" aria-label="One side of a loaded barbell">
      <defs>
        <linearGradient id="shaftFade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--steel)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--steel)" stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect x="20" y={cy - 7} width="152" height="14" fill="url(#shaftFade)" />
      <rect x="172" y={cy - 32} width="16" height="64" rx="3" fill="var(--steel-dark)" />
      <rect x="188" y={cy - 11} width="682" height="22" rx="4" fill="var(--steel)" />
      {drawn.map(({ p, x: px }, i) => (
        <g key={i}>
          <rect
            x={px}
            y={cy - p.h / 2}
            width={p.t}
            height={p.h}
            rx="3"
            fill={p.fill}
            stroke={p.stroke}
            strokeWidth="1.5"
          />
          <text
            x={px + p.t / 2}
            y={cy}
            transform={`rotate(-90 ${px + p.t / 2} ${cy})`}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="ui-monospace, Menlo, Consolas, monospace"
            fontWeight="600"
            fontSize={Math.min(13, p.t - 2)}
            fill={p.ink}
          >
            {fmt(p.kg)}
          </text>
        </g>
      ))}
      {!hidden && collars && (
        <g>
          <rect
            x={collarX} y={cy - 30} width="22" height="60" rx="4"
            fill="#b9bec6" stroke="#83898f" strokeWidth="1.5"
          />
          <rect
            x={collarX + 7} y={cy - 46} width="8" height="17" rx="2"
            fill="#b9bec6" stroke="#83898f" strokeWidth="1.5"
          />
        </g>
      )}
      <rect x="862" y={cy - 13} width="10" height="26" rx="3" fill="var(--steel-dark)" />
    </svg>
  );
}
