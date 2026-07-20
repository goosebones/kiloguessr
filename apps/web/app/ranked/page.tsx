"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MODE_LABELS,
  RANKED_ENDURANCE,
  RANKED_SETTINGS,
  answersMatch,
  parseAnswer,
} from "@kiloguessr/engine";
import Barbell from "../../components/Barbell";
import { authedFetch, ensureAmplify } from "../../lib/auth";
import "../game.css";
import "../account/account.css";
import "./ranked.css";

type Stage = "checking" | "signedout" | "nohandle" | "ready" | "playing" | "done";

interface RunPayload {
  runId: string;
  cards: { sidePlates: number[] }[];
}

interface Answer {
  answer: string;
  ms: number;
}

interface Result {
  ranked: boolean;
  reason?: string;
  score?: number;
  correct?: number;
  attempts?: number;
  accuracy?: number;
  isPersonalBest?: boolean;
  rankPos?: number | null;
}

const MODE = "endurance-read" as const;
const E = RANKED_ENDURANCE;

export default function RankedPage() {
  const [stage, setStage] = useState<Stage>("checking");
  const [error, setError] = useState("");
  const [run, setRun] = useState<RunPayload | null>(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [remaining, setRemaining] = useState(E.startSec * 1000);
  const [hits, setHits] = useState(0);
  const [flash, setFlash] = useState<"" | "judged-good" | "judged-bad">("");
  const [result, setResult] = useState<Result | null>(null);

  const answers = useRef<Answer[]>([]);
  const cardShownAt = useRef(0);
  const remainingRef = useRef(E.startSec * 1000);
  const idxRef = useRef(0);
  const finishing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ensureAmplify();
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

  // countdown
  useEffect(() => {
    if (stage !== "playing") return;
    const id = setInterval(() => {
      remainingRef.current -= 100;
      if (remainingRef.current <= 0) {
        remainingRef.current = 0;
        setRemaining(0);
        clearInterval(id);
        void finish();
        return;
      }
      setRemaining(remainingRef.current);
    }, 100);
    return () => clearInterval(id);
  }, [stage, finish]);

  const start = async () => {
    setError("");
    try {
      const res = await authedFetch("/v1/runs", {
        method: "POST",
        body: JSON.stringify({ mode: MODE }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start a run.");
      answers.current = [];
      idxRef.current = 0;
      remainingRef.current = E.startSec * 1000;
      finishing.current = false;
      setRun(data);
      setIdx(0);
      setHits(0);
      setAnswer("");
      setResult(null);
      setRemaining(E.startSec * 1000);
      setStage("playing");
      cardShownAt.current = Date.now();
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start a run.");
    }
  };

  const submitAnswer = () => {
    if (stage !== "playing" || !run) return;
    const parsed = parseAnswer(answer);
    if (parsed === null) return;

    const now = Date.now();
    const ms = now - cardShownAt.current;
    answers.current.push({ answer, ms });

    const card = run.cards[idxRef.current];
    const total =
      RANKED_SETTINGS.bar +
      (RANKED_SETTINGS.collars ? 5 : 0) +
      card.sidePlates.reduce((a, b) => a + b * 2, 0);
    const ok = answersMatch(parsed, total);

    // local mirror of the server's clock — the server re-simulates on submit
    remainingRef.current += ok ? E.gainSec * 1000 : -E.lossSec * 1000;
    if (ok) setHits((h) => h + 1);
    setFlash("");
    requestAnimationFrame(() => setFlash(ok ? "judged-good" : "judged-bad"));

    if (remainingRef.current <= 0) {
      remainingRef.current = 0;
      setRemaining(0);
      void finish();
      return;
    }
    setRemaining(remainingRef.current);

    idxRef.current += 1;
    if (idxRef.current >= run.cards.length) {
      void finish();
      return;
    }
    setIdx(idxRef.current);
    setAnswer("");
    cardShownAt.current = Date.now();
  };

  const sidePlates = run?.cards[idx]?.sidePlates ?? null;

  return (
    <main className="game account">
      <header>
        <div>
          <div className="eyebrow">Ranked · {MODE_LABELS[MODE]}</div>
          <h1 className="wordmark">
            KiloGuessr<em>.</em>
          </h1>
        </div>
        <nav className="nav-links">
          <a className="link-btn" href="/">Practice</a>
          <a className="link-btn" href="/leaderboards">Leaderboards</a>
          <a className="link-btn" href="/account">Account</a>
        </nav>
      </header>

      {stage === "checking" && <p className="account-note">Checking your account…</p>}

      {stage === "signedout" && (
        <section className="card">
          <p className="account-note">Ranked runs need an account so your score can hit the board.</p>
          <a className="check-btn" href="/account" style={{ textAlign: "center", textDecoration: "none" }}>
            Sign in
          </a>
        </section>
      )}

      {stage === "nohandle" && (
        <section className="card">
          <p className="account-note">Claim a handle first — it&apos;s your name on the leaderboards.</p>
          <a className="check-btn" href="/account" style={{ textAlign: "center", textDecoration: "none" }}>
            Claim a handle
          </a>
        </section>
      )}

      {(stage === "ready" || stage === "done") && (
        <section className="card">
          {result?.ranked && (
            <div className="run-result">
              <b>{result.score}</b>
              <span>good lifts</span>
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
          <p className="account-note">
            60 seconds. Every good lift adds {E.gainSec}s, every miss costs {E.lossSec}s.
            Standard loading: {RANKED_SETTINGS.bar} kg bar, collars on, plates down to{" "}
            {RANKED_SETTINGS.smallest}.
          </p>
          <button className="check-btn" onClick={start}>
            {result ? "Run it again" : "Start ranked run"}
          </button>
        </section>
      )}

      {stage === "playing" && run && sidePlates && (
        <>
          <section className={`stage ${flash}`} aria-label="Loaded barbell">
            <div className={`timer ${remaining <= 10000 ? "low" : ""}`}>
              {(remaining / 1000).toFixed(1)}s
            </div>
            <div className="target">
              <span>Good lifts</span>
              <b>{hits}</b>
            </div>
            <Barbell plates={sidePlates} collars={RANKED_SETTINGS.collars} />
            <div className="prompt">What&apos;s on the bar?</div>
          </section>
          <section className="console">
            <div className="answer-row">
              <div className="answer-field">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
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
              <button className="check-btn" onClick={submitAnswer}>
                Check
              </button>
            </div>
            <p className="breakdown">Typing 187 counts as 187.5.</p>
          </section>
        </>
      )}

      {error && <p className="account-error">{error}</p>}
    </main>
  );
}
