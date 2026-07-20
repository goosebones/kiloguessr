"use client";

import { fmt, plateByKg } from "@kiloguessr/engine";

const RED_KG = 25;
/** Show the red tally once counting them by eye gets slow. */
const RED_TALLY_FROM = 2;

/**
 * One sleeve of a loaded bar. The viewBox tracks the actual content width so
 * the drawing isn't dominated by empty shaft — which keeps the plates legible
 * on a phone — with a floor so light and heavy loads look consistent.
 */
export default function Barbell({
  plates,
  collars,
  hidden,
}: {
  plates: number[];
  collars: boolean;
  /** empty bar — shown before a card starts */
  hidden?: boolean;
}) {
  const cy = 145;
  let x = 192;
  const drawn = hidden
    ? []
    : plates.map((kg) => {
        const p = plateByKg(kg)!;
        const at = x;
        x += p.t + 3;
        return { p, x: at };
      });

  const showCollar = !hidden && collars;
  const collarX = x + 2;
  const sleeveEnd = (showCollar ? collarX + 22 : x) + 6;
  const width = Math.max(520, sleeveEnd + 24);

  const reds = drawn.filter((d) => d.p.kg === RED_KG);
  const showTally = reds.length >= RED_TALLY_FROM;
  const tallyFrom = showTally ? reds[0].x : 0;
  const tallyTo = showTally
    ? reds[reds.length - 1].x + reds[reds.length - 1].p.t
    : 0;
  const height = showTally ? 300 : 275;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={
        hidden
          ? "An empty barbell"
          : `One side of a barbell loaded with ${plates.map(fmt).join(", ")} kg plates`
      }
    >
      <defs>
        <linearGradient id="shaftFade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--steel)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--steel)" stopOpacity="1" />
        </linearGradient>
      </defs>

      <rect x="20" y={cy - 7} width="152" height="14" fill="url(#shaftFade)" />
      <rect x="172" y={cy - 32} width="16" height="64" rx="3" fill="var(--steel-dark)" />
      <rect x="188" y={cy - 11} width={sleeveEnd - 188} height="22" rx="4" fill="var(--steel)" />

      {drawn.map(({ p, x: px }, i) => (
        <g key={i}>
          <rect
            x={px} y={cy - p.h / 2} width={p.t} height={p.h} rx="3"
            fill={p.fill} stroke={p.stroke} strokeWidth="1.5"
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

      {showCollar && (
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

      <rect x={sleeveEnd} y={cy - 13} width="10" height="26" rx="3" fill="var(--steel-dark)" />

      {showTally && (
        <g>
          <path
            d={`M${tallyFrom} ${cy + 122} v8 H${tallyTo} v-8`}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="2"
          />
          <text
            x={(tallyFrom + tallyTo) / 2}
            y={cy + 150}
            textAnchor="middle"
            fontFamily="ui-monospace, Menlo, Consolas, monospace"
            fontWeight="600"
            fontSize="19"
            fill="var(--ink)"
          >
            {reds.length} × 25
          </text>
        </g>
      )}
    </svg>
  );
}
