"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COLLAR_KG,
  MAXES,
  PLATES,
  PRACTICE_ENDURANCE,
  Q,
  answersMatch,
  fmt,
  generateCard,
  loadedTotalQ,
  mulberry32,
  parseAnswer,
  plateByKg,
  totalKg,
  type Card,
  type GameSettings,
} from "@kiloguessr/engine";

type Phase = "ready" | "ask" | "revealed";

interface UiSettings extends GameSettings {
  /** 0 = read, 1 = load */
  game: 0 | 1;
  /** 0 = practice clock, 1 = endurance */
  timer: 0 | 1;
}

const DEFAULT_SETTINGS: UiSettings = {
  bar: 20,
  collars: true,
  smallest: 1.25,
  max: 375,
  game: 0,
  timer: 0,
};

const MAX_LOADED_PLATES = 14;
const E = PRACTICE_ENDURANCE;

function loadSettings(): UiSettings {
  try {
    const raw = JSON.parse(localStorage.getItem("kilo.settings") ?? "null");
    if (!raw || !raw.bar) return DEFAULT_SETTINGS;
    const s: UiSettings = {
      ...DEFAULT_SETTINGS,
      ...raw,
      collars: Boolean(raw.collars),
    };
    if (!MAXES.includes(s.max)) {
      s.max = MAXES.reduce((a, b) =>
        Math.abs(b - s.max) < Math.abs(a - s.max) ? b : a,
      );
    }
    return s;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const rng = mulberry32(Date.now() >>> 0);

export default function Game() {
  const [settings, setSettings] = useState<UiSettings>(DEFAULT_SETTINGS);
  const [card, setCard] = useState<Card | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [started, setStarted] = useState(false);
  const [playerPlates, setPlayerPlates] = useState<number[]>([]);
  const [answer, setAnswer] = useState("");
  const [stats, setStats] = useState({ attempts: 0, correct: 0, streak: 0, best: 0 });
  const [times, setTimes] = useState<number[]>([]);
  const [verdict, setVerdict] = useState<{ kind: "good" | "bad"; html: string } | null>(null);
  const [breakdown, setBreakdown] = useState(
    "Bar + plates on both sides + collars. Press Enter to check. Typing 187 counts as 187.5.",
  );
  const [judged, setJudged] = useState<"" | "judged-good" | "judged-bad">("");
  const [timerText, setTimerText] = useState("0.0s");
  const [timerLow, setTimerLow] = useState(false);
  const [gameOverInfo, setGameOverInfo] = useState<string | null>(null);

  const cardStart = useRef(0);
  const judgedAt = useRef(0);
  const enduranceLeft = useRef(E.startSec);
  const run = useRef({ correct: 0, attempts: 0 });
  const answerRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // hydrate persisted state on mount
  useEffect(() => {
    setSettings(loadSettings());
    try {
      const best = Number(localStorage.getItem("kilo.best")) || 0;
      setStats((s) => ({ ...s, best }));
    } catch {}
  }, []);

  const isLoad = settings.game === 1;
  const isEndurance = settings.timer === 1;

  const newCard = useCallback(
    (prev: Card | null, s: UiSettings, autoStart: boolean) => {
      const next = generateCard(s, rng, prev ?? undefined);
      setCard(next);
      setAnswer("");
      setPlayerPlates([]);
      if (autoStart) {
        setPhase("ask");
        cardStart.current = Date.now();
      } else {
        setPhase("ready");
        setTimerText(
          s.timer === 1 ? enduranceLeft.current.toFixed(1) + "s" : "0.0s",
        );
        requestAnimationFrame(() => startRef.current?.focus());
      }
      return next;
    },
    [],
  );

  // first card
  useEffect(() => {
    if (!card) newCard(null, settings, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCard = useCallback(() => {
    if (!started) {
      enduranceLeft.current = E.startSec;
      run.current = { correct: 0, attempts: 0 };
    }
    setStarted(true);
    setGameOverInfo(null);
    setPhase("ask");
    cardStart.current = Date.now();
    requestAnimationFrame(() => answerRef.current?.focus());
  }, [started]);

  const gameOver = useCallback(() => {
    setStarted(false);
    setGameOverInfo(
      `${run.current.correct} good lifts · ${run.current.attempts} attempts`,
    );
    setTimerLow(false);
    newCard(null, settingsRef.current, false);
  }, [newCard]);

  // clock tick
  useEffect(() => {
    const id = setInterval(() => {
      if (phase !== "ask") return;
      if (settingsRef.current.timer === 1) {
        enduranceLeft.current -= 0.1;
        if (enduranceLeft.current <= 0) {
          enduranceLeft.current = 0;
          setTimerText("0.0s");
          gameOver();
          return;
        }
        setTimerText(enduranceLeft.current.toFixed(1) + "s");
        setTimerLow(enduranceLeft.current <= 10);
      } else {
        setTimerText(((Date.now() - cardStart.current) / 1000).toFixed(1) + "s");
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase, gameOver]);

  const breakdownText = useCallback((c: Card, s: UiSettings) => {
    const parts = [`${s.bar} kg bar`, `2 × (${c.sidePlates.map(fmt).join(" + ")})`];
    if (s.collars) parts.push(`2 × ${COLLAR_KG} collars`);
    return parts.join("  +  ");
  }, []);

  const judge = useCallback(
    (gaveUp: boolean) => {
      if (!card || phase !== "ask") return;
      const s = settingsRef.current;
      const total = totalKg(card);
      const elapsed = Date.now() - cardStart.current;

      let correct = false;
      if (!gaveUp) {
        if (s.game === 1) {
          if (playerPlates.length === 0 && Date.now() - judgedAt.current < 500) return;
          correct = loadedTotalQ(s, playerPlates) === card.totalQ;
        } else {
          const ans = parseAnswer(answer);
          if (ans === null) {
            if (answer.trim() === "") {
              if (Date.now() - judgedAt.current > 500)
                setBreakdown("Type the total weight first.");
            } else {
              setBreakdown("That's not a number — try again.");
            }
            return;
          }
          correct = answersMatch(ans, total);
        }
      }

      judgedAt.current = Date.now();
      const nextStats = { ...stats, attempts: stats.attempts + 1 };
      if (correct) {
        nextStats.correct++;
        nextStats.streak++;
        setTimes((t) => [...t, elapsed]);
        if (nextStats.streak > nextStats.best) {
          nextStats.best = nextStats.streak;
          try {
            localStorage.setItem("kilo.best", String(nextStats.best));
          } catch {}
        }
        setVerdict({
          kind: "good",
          html: `Good lift — ${fmt(total)} kg in ${(elapsed / 1000).toFixed(1)}s`,
        });
      } else {
        nextStats.streak = 0;
        setVerdict({
          kind: "bad",
          html: `${gaveUp ? "Passed" : "No lift"} — it was ${fmt(total)} kg`,
        });
      }
      setStats(nextStats);
      setBreakdown(breakdownText(card, s));
      setJudged("");
      requestAnimationFrame(() =>
        setJudged(correct ? "judged-good" : "judged-bad"),
      );

      if (s.timer === 1) {
        run.current.attempts++;
        if (correct) run.current.correct++;
        enduranceLeft.current += correct ? E.gainSec : -E.lossSec;
        if (enduranceLeft.current <= 0) {
          enduranceLeft.current = 0;
          gameOver();
          return;
        }
      }
      // rapid fire: deal the next card immediately
      newCard(card, s, true);
      requestAnimationFrame(() => answerRef.current?.focus());
    },
    [answer, breakdownText, card, gameOver, newCard, phase, playerPlates, stats],
  );

  const addPlate = useCallback(
    (kg: number) => {
      if (phase !== "ask" || settingsRef.current.game !== 1) return;
      setPlayerPlates((p) =>
        p.length >= MAX_LOADED_PLATES || kg < settingsRef.current.smallest
          ? p
          : [...p, kg],
      );
    },
    [phase],
  );

  const removePlate = useCallback(() => {
    if (phase !== "ask" || settingsRef.current.game !== 1) return;
    setPlayerPlates((p) => p.slice(0, -1));
  }, [phase]);

  // global keys: Enter to start/submit, 1-9 plates, Backspace undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = document.activeElement as HTMLElement | null;
      if (phase === "ask" && settingsRef.current.game === 1) {
        if (e.key >= "1" && e.key <= "9" && !e.repeat) {
          const p = PLATES[Number(e.key) - 1];
          if (p) addPlate(p.kg);
          return;
        }
        if (e.key === "Backspace" && t?.tagName !== "INPUT") {
          e.preventDefault();
          removePlate();
          return;
        }
      }
      if (e.key !== "Enter" || e.repeat) return;
      if (t?.tagName === "INPUT") return;
      if (t?.closest(".settings, .legend, .link-btn")) return;
      if (phase === "ready") {
        e.preventDefault();
        startCard();
      } else if (phase === "ask" && settingsRef.current.game === 1) {
        e.preventDefault();
        judge(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [addPlate, judge, phase, removePlate, startCard]);

  const changeSetting = (key: keyof UiSettings, value: number | boolean) => {
    const next = { ...settingsRef.current, [key]: value } as UiSettings;
    setSettings(next);
    try {
      localStorage.setItem("kilo.settings", JSON.stringify(next));
    } catch {}
    if (key === "timer") {
      enduranceLeft.current = E.startSec;
      run.current = { correct: 0, attempts: 0 };
      setTimerLow(false);
    }
    const dealt = newCard(null, next, started);
    if (started) {
      cardStart.current = Date.now();
      requestAnimationFrame(() => answerRef.current?.focus());
    }
    return dealt;
  };

  const avg = times.length
    ? (times.reduce((a, b) => a + b, 0) / times.length / 1000).toFixed(1) + "s"
    : "–";
  const acc = stats.attempts
    ? Math.round((100 * stats.correct) / stats.attempts) + "%"
    : "–";

  const showPlates = phase !== "ready";
  const shownPlates = isLoad ? playerPlates : (card?.sidePlates ?? []);

  // bar geometry
  const cy = 150;
  let px = 192;
  const drawn = showPlates
    ? shownPlates.map((kg) => {
        const p = plateByKg(kg)!;
        const x = px;
        px += p.t + 3;
        return { p, x };
      })
    : [];
  const collarX = px + 2;

  return (
    <main className="game">
      <header>
        <div>
          <div className="eyebrow">IPF kg · flash cards</div>
          <h1 className="wordmark">
            KiloGuessr<em>.</em>
          </h1>
        </div>
        <div className="stats" aria-label="Session stats">
          <nav className="nav-links" style={{ alignSelf: "center", marginRight: 4 }}>
            <a className="link-btn" href="/ranked">Ranked</a>
            <a className="link-btn" href="/leaderboards">Boards</a>
            <a className="link-btn" href="/account">Account</a>
          </nav>
          <div className="stat"><b>{stats.correct}/{stats.attempts}</b><span>Score</span></div>
          <div className="stat"><b>{acc}</b><span>Acc</span></div>
          <div className="stat"><b>{stats.streak}</b><span>Streak</span></div>
          <div className="stat"><b>{stats.best}</b><span>Best</span></div>
          <div className="stat"><b>{avg}</b><span>Avg</span></div>
        </div>
      </header>

      <section className={`stage ${judged}`} aria-label="Loaded barbell">
        <div className={`timer ${timerLow ? "low" : ""}`}>{timerText}</div>
        {isLoad && phase === "ask" && card && (
          <div className="target">
            <span>Target</span>
            <b>{fmt(totalKg(card))} kg</b>
          </div>
        )}
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
          {drawn.map(({ p, x }, i) => (
            <g key={i}>
              <rect
                x={x} y={cy - p.h / 2} width={p.t} height={p.h} rx="3"
                fill={p.fill} stroke={p.stroke} strokeWidth="1.5"
              />
              <text
                x={x + p.t / 2} y={cy}
                transform={`rotate(-90 ${x + p.t / 2} ${cy})`}
                textAnchor="middle" dominantBaseline="central"
                fontFamily="ui-monospace, Menlo, Consolas, monospace"
                fontWeight="600" fontSize={Math.min(13, p.t - 2)} fill={p.ink}
              >
                {fmt(p.kg)}
              </text>
            </g>
          ))}
          {showPlates && settings.collars && (
            <g>
              <rect x={collarX} y={cy - 30} width="22" height="60" rx="4"
                fill="#b9bec6" stroke="#83898f" strokeWidth="1.5" />
              <rect x={collarX + 7} y={cy - 46} width="8" height="17" rx="2"
                fill="#b9bec6" stroke="#83898f" strokeWidth="1.5" />
            </g>
          )}
          <rect x="862" y={cy - 13} width="10" height="26" rx="3" fill="var(--steel-dark)" />
        </svg>
        {phase === "ready" && (
          <div className="cover">
            {gameOverInfo && (
              <div className="cover-info">
                <b>Time!</b>
                {gameOverInfo}
              </div>
            )}
            <button ref={startRef} className="start-btn" onClick={startCard}>
              {gameOverInfo ? "Go again" : "Start"}
            </button>
          </div>
        )}
        <div className="prompt">
          {phase === "ready"
            ? "Press start when you're ready"
            : isLoad
              ? "Keys 1–9 load plates · Backspace undoes · Enter submits"
              : "What's on the bar?"}
        </div>
      </section>

      <section className="console">
        <div className="answer-row">
          {!isLoad && (
            <div className="answer-field">
              <input
                ref={answerRef}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                aria-label="Total weight in kilograms"
                disabled={phase !== "ask"}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.stopPropagation();
                  if (!e.repeat && phase === "ask") judge(false);
                }}
              />
              <span className="unit">kg</span>
            </div>
          )}
          {isLoad && (
            <div className="rack-wrap">
              <div className="rack" aria-label="Plate rack">
                {PLATES.map((p, i) =>
                  p.kg < settings.smallest ? null : (
                    <div className="rack-slot" key={p.kg}>
                      <button
                        className="plate-btn"
                        style={{ background: p.fill, borderColor: p.stroke, color: p.ink }}
                        aria-label={`Add a ${fmt(p.kg)} kg plate (key ${i + 1})`}
                        onClick={() => addPlate(p.kg)}
                      >
                        {fmt(p.kg)}
                      </button>
                      <span className="key-hint">{i + 1}</span>
                    </div>
                  ),
                )}
              </div>
              <button className="link-btn" onClick={removePlate} disabled={phase !== "ask"}>
                Undo
              </button>
              <button
                className="link-btn"
                onClick={() => phase === "ask" && setPlayerPlates([])}
                disabled={phase !== "ask"}
              >
                Clear
              </button>
            </div>
          )}
          <button className="check-btn" disabled={phase !== "ask"} onClick={() => judge(false)}>
            {isLoad ? "Submit" : "Check"}
          </button>
          <button className="link-btn" disabled={phase !== "ask"} onClick={() => judge(true)}>
            Show answer
          </button>
        </div>
        <div className="judging" aria-live="polite">
          <div className={`verdict ${verdict ? verdict.kind + " pop" : ""}`}>
            {verdict?.html}
          </div>
          <div className="breakdown">{breakdown}</div>
        </div>
      </section>

      <section className="settings" aria-label="Settings">
        <Setting label="Game">
          <Seg
            options={[["Read", 0], ["Load", 1]]}
            value={settings.game}
            onChange={(v) => changeSetting("game", v)}
          />
        </Setting>
        <Setting label="Clock">
          <Seg
            options={[["Practice", 0], ["Endurance", 1]]}
            value={settings.timer}
            onChange={(v) => changeSetting("timer", v)}
          />
        </Setting>
        <Setting label="Bar">
          <Seg
            options={[["25 kg", 25], ["20 kg", 20], ["15 kg", 15]]}
            value={settings.bar}
            onChange={(v) => changeSetting("bar", v)}
          />
        </Setting>
        <Setting label={`Collars · ${COLLAR_KG} kg`}>
          <Seg
            options={[["On", 1], ["Off", 0]]}
            value={settings.collars ? 1 : 0}
            onChange={(v) => changeSetting("collars", v === 1)}
          />
        </Setting>
        <Setting label="Down to">
          <Seg
            options={[["5", 5], ["2.5", 2.5], ["1.25", 1.25], ["0.25", 0.25]]}
            value={settings.smallest}
            onChange={(v) => changeSetting("smallest", v)}
          />
        </Setting>
        <Setting label="Max load">
          <Seg
            wrap
            options={MAXES.map((m) => [String(m), m] as [string, number])}
            value={settings.max}
            onChange={(v) => changeSetting("max", v)}
          />
        </Setting>
      </section>

      <details className="legend">
        <summary>Plate colours</summary>
        <div className="legend-grid">
          {PLATES.map((p) => (
            <div className="legend-item" key={p.kg}>
              <span className="swatch" style={{ background: p.fill }} />
              {fmt(p.kg)}
            </div>
          ))}
        </div>
      </details>
    </main>
  );
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="setting">
      <span>{label}</span>
      {children}
    </div>
  );
}

function Seg({
  options,
  value,
  onChange,
  wrap,
}: {
  options: [string, number][];
  value: number;
  onChange: (v: number) => void;
  wrap?: boolean;
}) {
  return (
    <div className={`seg ${wrap ? "seg-wrap" : ""}`} role="group">
      {options.map(([label, v]) => (
        <button key={v} aria-pressed={v === value} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}
