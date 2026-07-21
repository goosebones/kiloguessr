"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COLLAR_KG,
  MAXES,
  PLATES,
  PRACTICE_ENDURANCE,
  Q,
  answersMatch,
  describeSide,
  fmt,
  generateCard,
  loadedTotalQ,
  mulberry32,
  parseAnswer,
  totalKg,
  type Card,
  type GameSettings,
} from "@kiloguessr/engine";
import Barbell from "./Barbell";
import Footer from "./Footer";
import KeybindEditor from "./KeybindEditor";
import TopNav from "./TopNav";
import {
  DEFAULT_KEYBINDS,
  loadKeybinds,
  plateForKey,
  saveKeybinds,
  type Keybinds,
} from "../lib/keybinds";

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
const HINT = "Type the total. Typing 187 counts as 187.5.";

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
  const [breakdown, setBreakdown] = useState(HINT);
  const [judged, setJudged] = useState<"" | "judged-good" | "judged-bad">("");
  const [timerText, setTimerText] = useState("0.0s");
  const [timerLow, setTimerLow] = useState(false);
  const [gameOverInfo, setGameOverInfo] = useState<string | null>(null);
  const [binds, setBinds] = useState<Keybinds>(DEFAULT_KEYBINDS);
  const bindsRef = useRef(binds);
  bindsRef.current = binds;

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
    setBinds(loadKeybinds());
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
        requestAnimationFrame(() => startRef.current?.focus({ preventScroll: true }));
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
    requestAnimationFrame(() => answerRef.current?.focus({ preventScroll: true }));
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
      setBreakdown(HINT);
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
      requestAnimationFrame(() => answerRef.current?.focus({ preventScroll: true }));
    },
    [answer, card, gameOver, newCard, phase, playerPlates, stats],
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
        if (!e.repeat) {
          const kg = plateForKey(bindsRef.current, e.key);
          if (kg !== null) {
            addPlate(kg);
            return;
          }
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
      requestAnimationFrame(() => answerRef.current?.focus({ preventScroll: true }));
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

  return (
    <main className="game">
      <TopNav />

      <div className="statbar" aria-label="Session stats">
        <div className="stat"><b>{stats.correct}/{stats.attempts}</b><span>Score</span></div>
        <div className="stat"><b>{acc}</b><span>Acc</span></div>
        <div className="stat"><b>{stats.streak}</b><span>Streak</span></div>
        <div className="stat"><b>{stats.best}</b><span>Best</span></div>
        <div className="stat"><b>{avg}</b><span>Avg</span></div>
      </div>

      <section className={`stage ${judged}`} aria-label="Loaded barbell">
        <div className={`timer ${timerLow ? "low" : ""}`}>{timerText}</div>
        {isLoad && phase === "ask" && card && (
          <div className="target">
            <span>Target</span>
            <b>{fmt(totalKg(card))} kg</b>
          </div>
        )}
        <Barbell
          plates={shownPlates}
          collars={settings.collars}
          hidden={!showPlates}
        />
        {phase !== "ready" && (
          <div className={`prompt ${!isLoad ? "readout" : ""}`}>
            {isLoad
              ? "Plate keys load · Backspace undoes · Enter submits"
              : card
                ? describeSide(card.sidePlates)
                : ""}
          </div>
        )}
        {phase === "ready" && (
          <div className="cover cover-full">
            <div className="cover-inner">
              {gameOverInfo ? (
                <div className="cover-info">
                  <b>Time!</b>
                  {gameOverInfo}
                </div>
              ) : (
                <p className="cover-lede">
                  {isLoad
                    ? "Build the bar to hit the target weight."
                    : "Read the loaded bar and type the total — bar, both sides, and collars."}
                </p>
              )}
              <button ref={startRef} className="start-btn" onClick={startCard}>
                {gameOverInfo ? "Go again" : "Start"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="console">
        <div className="answer-row">
          {!isLoad && (
            <div className="answer-field">
              <input
                ref={answerRef}
                type="text"
                inputMode="decimal"
                enterKeyHint="go"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
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
                {PLATES.map((p) =>
                  p.kg < settings.smallest ? null : (
                    <div className="rack-slot" key={p.kg}>
                      <button
                        className="plate-btn"
                        style={{ background: p.fill, borderColor: p.stroke, color: p.ink }}
                        aria-label={`Add a ${fmt(p.kg)} kg plate`}
                        onClick={() => addPlate(p.kg)}
                      >
                        {fmt(p.kg)}
                      </button>
                      <span className="key-hint">{binds[String(p.kg)] || "—"}</span>
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
          <button
            className="check-btn"
            disabled={phase !== "ask"}
            // keep the caret (and the phone keyboard) in the input
            onMouseDown={(e) => !isLoad && e.preventDefault()}
            onClick={() => judge(false)}
          >
            {isLoad ? "Submit" : "Check"}
          </button>
          <button
            className="link-btn"
            disabled={phase !== "ask"}
            onMouseDown={(e) => !isLoad && e.preventDefault()}
            onClick={() => judge(true)}
          >
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

      {isLoad && (
        <details className="legend">
          <summary>Customize plate keys</summary>
          <KeybindEditor
            binds={binds}
            smallest={settings.smallest}
            onChange={(next) => {
              setBinds(next);
              saveKeybinds(next);
            }}
          />
        </details>
      )}

      <Footer />
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
