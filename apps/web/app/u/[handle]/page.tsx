"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  MODE_LABELS,
  RANKED_MODES,
  formatScore,
  isEndurance,
} from "@kiloguessr/engine";
import Footer from "../../../components/Footer";
import InstagramLink from "../../../components/InstagramLink";
import TopNav from "../../../components/TopNav";
import { API_URL, authedFetch, ensureAmplify } from "../../../lib/auth";
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
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!params?.handle) return;
    fetch(`${API_URL}/v1/users/${encodeURIComponent(params.handle)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("No lifter with that handle.");
        setProfile(await res.json());
      })
      .catch((e) => setError(e.message));
  }, [params?.handle]);

  // is the signed-in lifter looking at their own profile?
  useEffect(() => {
    if (!params?.handle) return;
    ensureAmplify();
    (async () => {
      try {
        const { getCurrentUser } = await import("aws-amplify/auth");
        await getCurrentUser();
        const res = await authedFetch("/v1/me");
        const me = await res.json();
        if (
          me.handle &&
          me.handle.toLowerCase() === params.handle.toLowerCase()
        ) {
          setIsOwner(true);
        }
      } catch {
        /* signed out */
      }
    })();
  }, [params?.handle]);

  const bests = profile?.bests ?? {};
  const hasAny = RANKED_MODES.some((m) => bests[m]);

  return (
    <main className="game account">
      <TopNav active="account" />

      {error && <p className="account-error">{error}</p>}
      {!error && !profile && <p className="account-note">Loading…</p>}

      {profile && (
        <section className="card profile-card">
          <div className="profile-head">
            <h2 className="wordmark" style={{ fontSize: 30 }}>
              {profile.handle}
            </h2>
            {isOwner && (
              <a className="link-btn" href="/account">Edit profile</a>
            )}
          </div>

          {profile.instagram && <InstagramLink name={profile.instagram} />}

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
            <p className="account-note">
              No ranked runs yet.{" "}
              {isOwner && <a href="/ranked">Play one →</a>}
            </p>
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

      <Footer />
    </main>
  );
}
