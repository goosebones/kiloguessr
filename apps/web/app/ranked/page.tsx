"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MODE_LABELS,
  PLATES,
  RANKED_ENDURANCE,
  RANKED_MODES,
  RANKED_SETTINGS,
  SPRINT_TARGET,
  answersMatch,
  describeSide,
  fmt,
  formatScore,
  isEndurance,
  isLoadMode,
  loadedTotalQ,
  parseAnswer,
  type RankedMode,
} from "@kiloguessr/engine";
import Barbell from "../../components/Barbell";
import Footer from "../../components/Footer";
import KeybindEditor from "../../components/KeybindEditor";
import TopNav from "../../components/TopNav";
import { authedFetch, ensureAmplify } from "../../lib/auth";
import {
  DEFAULT_KEYBINDS,
  loadKeybinds,
  plateForKey,
  saveKeybinds,
  type Keybinds,
} from "../../lib/keybinds";
import "../game.css";
import "../account/account.css";
import "./ranked.css";

type Stage =
  | "checking"
  | "signedout"
  | "nohandle"
  | "ready"
  | "armed"
  | "countdown"
  | "playing"
  | "done";

interface RunPayload {
  runId: string;
  mode: RankedMode;
  cards: { sidePlates: number[] }[];
}

interface Answer {
  answer?: string;
  plates?: number[];
  ms: number;
}

interface Result {
  ranked: boolean;
  reason?: string;
  mode?: RankedMode;
  score?: number;
  correct?: number;
  attempts?: number;
  accuracy?: number;
  isPersonalBest?: boolean;
  rankPos?: number | null;
}

const E = RANKED_ENDURANCE;
const RACK = PLATES.filter((p) => p.kg >= RANKED_SETTINGS.smallest);

/** Total on the bar for a card's one-side plate list. */
const cardTotal = (sidePlates: number[]) =>
  loadedTotalQ(RANKED_SETTINGS, sidePlates) / 4;

export default function RankedPage() {
  const [stage, setStage] = useState<Stage>("checking");
  const [mode, setMode] = useState<RankedMode>("endurance-read");
  const [error, setError] = useState("");
  const [run, setRun] = useState<RunPayload | null>(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [plates, setPlates] = useState<number[]>([]);
  const [clock, setClock] = useState(E.startSec * 1000);
  const [hits, setHits] = useState(0);
  const [flash, setFlash] = useState<"" | "judged-good" | "judged-bad">("");
  const [result, setResult] = useState<Result | null>(null);
  const [count, setCount] = useState(3);
  const [binds, setBinds] = useState<Keybinds>(DEFAULT_KEYBINDS);
  const bindsRef = useRef(binds);
  bindsRef.current = binds;

  const answers = useRef<Answer[]>([]);
  const hitsRef = useRef(0);
  const cardShownAt = useRef(0);
  const clockRef = useRef(E.startSec * 1000);
  const idxRef = useRef(0);
  const platesRef = useRef<number[]>([]);
  const finishing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = run?.mode ?? mode;

  const endurance = isEndurance(modeRef.current);
  const load = isLoadMode(modeRef.current);

  useEffect(() => {
    ensureAmplify();
    setBinds(loadKeybinds());
    (async () => {
      try {
        const { getCurrentUser } = await import("aws-amplify/auth");
        await getCurrentUser();
      } catch {
        setStage("signedout");
        return;
      }
      const res = await authedFetch("/v1/me");
      const me = await res.json();
      setStage(me.handle ? "ready" : "nohandle");
    })();
  }, []);

  const finish = useCallback(async () => {
    if (finishing.current || !run) return;
    finishing.current = true;
    setStage("done");
    try {
      const res = await authedFetch(`/v1/runs/${run.runId}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers: answers.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't submit the run.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit the run.");
    }
  }, [run]);

  // clock: counts down for endurance, up for sprint
  useEffect(() => {
    if (stage !== "playing") return;
    const id = setInterval(() => {
      if (isEndurance(modeRef.current)) {
        clockRef.current -= 100;
        if (clockRef.current <= 0) {
          clockRef.current = 0;
          setClock(0);
          clearInterval(id);
          void finish();
          return;
        }
      } else {
        clockRef.current += 100;
      }
      setClock(clockRef.current);
    }, 100);
    return () => clearInterval(id);
  }, [stage, finish]);

  /** Fetch the run and hold at the "load the bar" screen. */
  const arm = async (m: RankedMode) => {
    setError("");
    setMode(m);
    try {
      const res = await authedFetch("/v1/runs", {
        method: "POST",
        body: JSON.stringify({ mode: m }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start a run.");
      answers.current = [];
      hitsRef.current = 0;
      idxRef.current = 0;
      platesRef.current = [];
      clockRef.current = isEndurance(m) ? E.startSec * 1000 : 0;
      finishing.current = false;
      setRun(data);
      setIdx(0);
      setHits(0);
      setAnswer("");
      setPlates([]);
      setResult(null);
      setClock(clockRef.current);
      setCount(3);
      setStage("armed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start a run.");
    }
  };

  // 3 · 2 · 1 · lift
  useEffect(() => {
    if (stage !== "countdown") return;
    if (count <= 0) {
      setStage("playing");
      cardShownAt.current = Date.now();
      if (!isLoadMode(modeRef.current)) {
        requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
      }
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [stage, count]);

  const submitAnswer = useCallback(() => {
    if (stage !== "playing" || !run) return;
    const m = run.mode;
    const card = run.cards[idxRef.current];
    if (!card) return;

    let ok: boolean;
    const entry: Answer = { ms: Date.now() - cardShownAt.current };
    if (isLoadMode(m)) {
      if (platesRef.current.length === 0) return; // don't burn a card on a stray Enter
      entry.plates = [...platesRef.current];
      ok = loadedTotalQ(RANKED_SETTINGS, platesRef.current) ===
        loadedTotalQ(RANKED_SETTINGS, card.sidePlates);
    } else {
      const parsed = parseAnswer(answer);
      if (parsed === null) return;
      entry.answer = answer;
      ok = answersMatch(parsed, cardTotal(card.sidePlates));
    }
    answers.current.push(entry);

    if (isEndurance(m)) {
      clockRef.current += ok ? E.gainSec * 1000 : -E.lossSec * 1000;
    }
    if (ok) {
      hitsRef.current += 1;
      setHits(hitsRef.current);
    }
    setFlash("");
    requestAnimationFrame(() => setFlash(ok ? "judged-good" : "judged-bad"));

    if (isEndurance(m) && clockRef.current <= 0) {
      clockRef.current = 0;
      setClock(0);
      void finish();
      return;
    }
    // sprint ends the moment the tenth good lift lands
    if (!isEndurance(m) && hitsRef.current >= SPRINT_TARGET) {
      void finish();
      return;
    }
    setClock(clockRef.current);

    idxRef.current += 1;
    if (idxRef.current >= run.cards.length) {
      void finish();
      return;
    }
    setIdx(idxRef.current);
    setAnswer("");
    platesRef.current = [];
    setPlates([]);
    cardShownAt.current = Date.now();
  }, [answer, finish, run, stage]);

  const addPlate = useCallback((kg: number) => {
    if (platesRef.current.length >= 14) return;
    platesRef.current = [...platesRef.current, kg];
    setPlates(platesRef.current);
  }, []);

  const undoPlate = useCallback(() => {
    platesRef.current = platesRef.current.slice(0, -1);
    setPlates(platesRef.current);
  }, []);

  // keyboard for load mode
  useEffect(() => {
    if (stage !== "playing" || !load) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const kg = plateForKey(bindsRef.current, e.key);
      if (kg !== null) {
        if (kg >= RANKED_SETTINGS.smallest) addPlate(kg);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        undoPlate();
      } else if (e.key === "Enter") {
        e.preventDefault();
        submitAnswer();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [addPlate, load, stage, submitAnswer, undoPlate]);

  const sidePlates = run?.cards[idx]?.sidePlates ?? null;
  const shown = load ? plates : (sidePlates ?? []);
  const target = sidePlates ? cardTotal(sidePlates) : 0;
  const misses = answers.current.length - hits;

  return (
    <main className="game account">
      <TopNav active="ranked" />

      {stage === "checking" && <p className="account-note">Checking your account…</p>}

      {stage === "signedout" && (
        <section className="card">
          <p className="account-note">Ranked runs need an account so your score can hit the board.</p>
          <a className="check-btn linkish" href="/account">Sign in</a>
        </section>
      )}

      {stage === "nohandle" && (
        <section className="card">
          <p className="account-note">Claim a handle first — it&apos;s your name on the leaderboards.</p>
          <a className="check-btn linkish" href="/account">Claim a handle</a>
        </section>
      )}

      {(stage === "ready" || stage === "done") && (
        <section className="card" style={{ maxWidth: 520 }}>
          {result?.ranked && result.mode && (
            <div className="run-result">
              <b>{formatScore(result.mode, result.score ?? 0)}</b>
              <span>
                {isEndurance(result.mode)
                  ? "good lifts"
                  : `for ${SPRINT_TARGET} good lifts`}
              </span>
              <p className="account-note">
                {result.correct}/{result.attempts} at{" "}
                {Math.round((result.accuracy ?? 0) * 100)}% accuracy
                {result.rankPos ? ` · #${result.rankPos} all-time` : ""}
                {result.isPersonalBest ? " · new personal best" : ""}
              </p>
            </div>
          )}
          {result && !result.ranked && (
            <p className="account-error">{result.reason ?? "That run wasn't ranked."}</p>
          )}
          {stage === "done" && !result && !error && (
            <p className="account-note">Scoring your run…</p>
          )}

          <div className="mode-grid">
            {RANKED_MODES.map((m) => (
              <button key={m} className="mode-card" onClick={() => arm(m)}>
                <b>{MODE_LABELS[m]}</b>
                <span>
                  {isEndurance(m)
                    ? `${E.startSec}s · +${E.gainSec}s per lift · −${E.lossSec}s per miss`
                    : `${SPRINT_TARGET} good lifts · fastest time wins`}
                </span>
              </button>
            ))}
          </div>
          <p className="account-note">
            Every ranked run uses the same loading: {RANKED_SETTINGS.bar} kg bar, collars
            on, plates down to {RANKED_SETTINGS.smallest} kg.
          </p>
          <a className="check-btn linkish" href="/leaderboards">
            View leaderboards
          </a>
          <details className="legend" style={{ alignSelf: "center" }}>
            <summary>Customize plate keys</summary>
            <KeybindEditor
              binds={binds}
              smallest={RANKED_SETTINGS.smallest}
              onChange={(next) => {
                setBinds(next);
                saveKeybinds(next);
              }}
            />
          </details>
        </section>
      )}

      {(stage === "armed" || stage === "countdown") && (
        <section className="stage" aria-label="Ready to lift">
          <div className="target">
            <span>{MODE_LABELS[modeRef.current]}</span>
          </div>
          <Barbell plates={[]} collars={false} hidden />
          <div className="cover">
            {stage === "armed" ? (
              <button className="start-btn" onClick={() => setStage("countdown")}>
                Load the bar
              </button>
            ) : (
              <div className="countdown" aria-live="assertive">
                {count}
              </div>
            )}
          </div>
          <div className="prompt">
            {stage === "armed"
              ? "Press start when you're ready"
              : "Get set…"}
          </div>
        </section>
      )}

      {stage === "playing" && run && sidePlates && (
        <>
          <section className={`stage ${flash}`} aria-label="Loaded barbell">
            <div className={`timer ${endurance && clock <= 10000 ? "low" : ""}`}>
              {(clock / 1000).toFixed(1)}s
            </div>
            <div className="target">
              <span>Good lifts</span>
              <b>{endurance ? hits : `${hits}/${SPRINT_TARGET}`}</b>
            </div>
            {load && (
              <div className="target target-second">
                <span>Target</span>
                <b>{fmt(target)} kg</b>
              </div>
            )}
            <Barbell plates={shown} collars={!load || plates.length > 0} />
            <div className={`prompt ${!load ? "readout" : ""}`}>
              {load
                ? "Plate keys load · Backspace undoes · Enter submits"
                : describeSide(sidePlates)}
            </div>
          </section>

          <section className="console">
            <div className="answer-row">
              {load ? (
                <div className="rack-wrap">
                  <div className="rack" aria-label="Plate rack">
                    {RACK.map((p) => (
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
                    ))}
                  </div>
                  <button className="link-btn" onClick={undoPlate}>Undo</button>
                  <button
                    className="link-btn"
                    onClick={() => {
                      platesRef.current = [];
                      setPlates([]);
                    }}
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="answer-field">
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="go"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder="0"
                    aria-label="Total weight in kilograms"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.repeat) submitAnswer();
                    }}
                  />
                  <span className="unit">kg</span>
                </div>
              )}
              <button
                className="check-btn"
                // keep the caret (and the phone keyboard) in the input
                onMouseDown={(e) => !load && e.preventDefault()}
                onClick={submitAnswer}
              >
                {load ? "Submit" : "Check"}
              </button>
            </div>
            <p className="breakdown">
              {endurance
                ? `${hits} good · ${misses} missed`
                : `${SPRINT_TARGET - hits} to go · ${misses} missed`}
              {!load && " · typing 187 counts as 187.5"}
            </p>
          </section>
        </>
      )}

      {error && (
        <section className="card">
          <p className="account-error">{error}</p>
          <button
            className="link-btn"
            onClick={() => {
              setError("");
              setStage("ready");
            }}
          >
            Back to the modes
          </button>
        </section>
      )}

      {stage !== "playing" && <Footer />}
    </main>
  );
}
