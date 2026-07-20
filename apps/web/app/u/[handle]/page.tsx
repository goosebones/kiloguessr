"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  MODE_LABELS,
  RANKED_MODES,
  formatScore,
  isEndurance,
} from "@kiloguessr/engine";
import { API_URL } from "../../../lib/auth";
import "../../game.css";
import "../../account/account.css";
import "../../ranked/ranked.css";

interface PublicProfile {
  handle: string;
  instagram: string | null;
  createdAt: string | null;
  bests: Record<string, { score: number; submittedAt: number }>;
}

export default function PublicProfilePage() {
  const params = useParams<{ handle: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params?.handle) return;
    fetch(`${API_URL}/v1/users/${encodeURIComponent(params.handle)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("No lifter with that handle.");
        setProfile(await res.json());
      })
      .catch((e) => setError(e.message));
  }, [params?.handle]);

  const bests = profile?.bests ?? {};
  const hasAny = RANKED_MODES.some((m) => bests[m]);

  return (
    <main className="game account">
      <header>
        <div>
          <div className="eyebrow">Lifter profile</div>
          <h1 className="wordmark">
            KiloGuessr<em>.</em>
          </h1>
        </div>
        <nav className="nav-links">
          <a className="link-btn" href="/">Practice</a>
          <a className="link-btn" href="/ranked">Ranked</a>
          <a className="link-btn" href="/leaderboards">Leaderboards</a>
        </nav>
      </header>

      {error && <p className="account-error">{error}</p>}
      {!error && !profile && <p className="account-note">Loading…</p>}

      {profile && (
        <section className="card">
          <h2 className="wordmark" style={{ fontSize: 28 }}>
            @{profile.handle}
          </h2>
          {profile.instagram && (
            <a
              className="link-btn"
              href={`https://instagram.com/${profile.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram: @{profile.instagram}
            </a>
          )}

          {hasAny ? (
            <div className="bests">
              {RANKED_MODES.map((m) =>
                bests[m] ? (
                  <div className="best-row" key={m}>
                    <span>{MODE_LABELS[m]}</span>
                    <b>
                      {formatScore(m, bests[m].score)}
                      {isEndurance(m) ? " lifts" : ""}
                    </b>
                  </div>
                ) : null,
              )}
            </div>
          ) : (
            <p className="account-note">No ranked runs yet.</p>
          )}

          {profile.createdAt && (
            <p className="account-note">
              Lifting here since{" "}
              {new Date(profile.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
              })}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
