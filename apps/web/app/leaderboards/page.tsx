"use client";

import { useEffect, useState } from "react";
import { MODE_LABELS, formatScore, type RankedMode } from "@kiloguessr/engine";
import { API_URL } from "../../lib/auth";
import "../game.css";
import "../account/account.css";
import "../ranked/ranked.css";

interface Row {
  rank: number;
  handle: string;
  instagram: string | null;
  score: number;
}

/** Modes with a live board today; the rest arrive with M4. */
const LIVE_MODES: RankedMode[] = ["endurance-read"];

export default function LeaderboardsPage() {
  const [mode, setMode] = useState<RankedMode>("endurance-read");
  const [window, setWindow] = useState<"all" | "week">("all");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setRows(null);
    setError("");
    fetch(`${API_URL}/v1/leaderboards/${mode}?window=${window}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't load the board.");
        setRows(data.rows);
      })
      .catch((e) => setError(e.message));
  }, [mode, window]);

  return (
    <main className="game account">
      <header>
        <div>
          <div className="eyebrow">Leaderboards</div>
          <h1 className="wordmark">
            KiloGuessr<em>.</em>
          </h1>
        </div>
        <nav className="nav-links">
          <a className="link-btn" href="/">Practice</a>
          <a className="link-btn" href="/ranked">Ranked</a>
          <a className="link-btn" href="/account">Account</a>
        </nav>
      </header>

      <section className="settings" aria-label="Board filters">
        <div className="setting">
          <span>Mode</span>
          <div className="seg" role="group">
            {LIVE_MODES.map((m) => (
              <button key={m} aria-pressed={m === mode} onClick={() => setMode(m)}>
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

      <section className="card" style={{ maxWidth: 620 }}>
        {error && <p className="account-error">{error}</p>}
        {!error && !rows && <p className="account-note">Loading…</p>}
        {rows?.length === 0 && (
          <p className="account-note">
            Nobody on this board yet. Be the first — play a ranked run.
          </p>
        )}
        {rows && rows.length > 0 && (
          <div className="board-scroll">
            <table className="board-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Lifter</th>
                  <th>Good lifts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.handle}>
                    <td className="rank">{r.rank}</td>
                    <td>
                      <a href={`/u/${r.handle}`}>@{r.handle}</a>
                      {r.instagram && (
                        <a
                          className="ig"
                          href={`https://instagram.com/${r.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          IG
                        </a>
                      )}
                    </td>
                    <td className="score">{formatScore(mode, r.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
