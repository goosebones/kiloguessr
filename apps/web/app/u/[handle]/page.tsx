"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { API_URL } from "../../../lib/auth";
import "../../game.css";
import "../../account/account.css";

interface PublicProfile {
  handle: string;
  instagram: string | null;
  createdAt: string | null;
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

  return (
    <main className="game account">
      <header>
        <div>
          <div className="eyebrow">Lifter profile</div>
          <h1 className="wordmark">
            KiloGuessr<em>.</em>
          </h1>
        </div>
        <a className="link-btn" href="/">
          ← Back to the game
        </a>
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
          {profile.createdAt && (
            <p className="account-note">
              Lifting here since{" "}
              {new Date(profile.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
              })}
            </p>
          )}
          <p className="account-note">Bests and ranks arrive with ranked mode.</p>
        </section>
      )}
    </main>
  );
}
