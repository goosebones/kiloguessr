"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MODE_LABELS,
  RANKED_MODES,
  formatScore,
  isEndurance,
  isRankedMode,
  type RankedMode,
} from "@kiloguessr/engine";
import Footer from "../../components/Footer";
import InstagramLink from "../../components/InstagramLink";
import SuspectFlag from "../../components/SuspectFlag";
import TopNav from "../../components/TopNav";
import { API_URL } from "../../lib/auth";
import "../game.css";
import "../account/account.css";
import "../ranked/ranked.css";

interface Row {
  rank: number;
  handle: string;
  instagram: string | null;
  score: number;
  suspect?: boolean;
}

export default function LeaderboardsPage() {
  const [mode, setMode] = useState<RankedMode>("endurance-read");
  const [window, setWindow] = useState<"all" | "week">("all");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  // preselect the board when arriving from a "View leaderboard" link
  useEffect(() => {
    const m = new URLSearchParams(globalThis.location?.search ?? "").get("mode");
    if (m && isRankedMode(m)) setMode(m);
  }, []);

  const load = useCallback(() => {
    setRows(null);
    setError("");
    fetch(`${API_URL}/v1/leaderboards/${mode}?window=${window}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't load the board.");
        setRows(data.rows);
      })
      .catch(() =>
        setError("Couldn't reach the leaderboard. Check your connection and retry."),
      );
  }, [mode, window]);

  useEffect(load, [load]);

  return (
    <main className="game account">
      <TopNav active="ranked" />
      <div className="page-title">
        <div className="eyebrow">Leaderboards</div>
      </div>

      <section className="settings" aria-label="Board filters">
        <div className="setting">
          <span>Mode</span>
          <div className="seg seg-wrap" role="group" style={{ maxWidth: 420 }}>
            {RANKED_MODES.map((m) => (
              <button
                key={m}
                aria-pressed={m === mode}
                onClick={() => setMode(m)}
                style={{ flex: "1 0 45%" }}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <span>Window</span>
          <div className="seg" role="group">
            <button aria-pressed={window === "all"} onClick={() => setWindow("all")}>
              All time
            </button>
            <button aria-pressed={window === "week"} onClick={() => setWindow("week")}>
              This week
            </button>
          </div>
        </div>
      </section>

      <a className="check-btn linkish play-this" href={`/ranked?mode=${mode}`}>
        Play {MODE_LABELS[mode]}
      </a>

      <section className="card" style={{ maxWidth: 620 }}>
        {error && (
          <>
            <p className="account-error">{error}</p>
            <button className="link-btn" onClick={load}>Retry</button>
          </>
        )}
        {!error && !rows && <p className="account-note">Loading the board…</p>}
        {rows?.length === 0 && (
          <>
            <p className="account-note">
              {window === "week"
                ? "No scores on this board yet this week. The week resets Sunday at midnight Eastern."
                : "Nobody has set a score in this mode yet."}
            </p>
            <a className="check-btn linkish" href="/ranked">Be the first</a>
          </>
        )}
        {rows && rows.length > 0 && (
          <div className="board-scroll">
            <table className="board-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Lifter</th>
                  <th>{isEndurance(mode) ? "Good lifts" : "Time"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.handle}>
                    <td className="rank">{r.rank}</td>
                    <td>
                      <span className="lifter-cell">
                        <a href={`/u/${r.handle}`}>{r.handle}</a>
                        {r.instagram && <InstagramLink name={r.instagram} iconOnly />}
                        {r.suspect && <SuspectFlag />}
                      </span>
                    </td>
                    <td className="score">{formatScore(mode, r.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}
