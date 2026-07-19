"use client";

import { useCallback, useEffect, useState } from "react";
import { authedFetch, ensureAmplify } from "../../lib/auth";
import "../game.css";
import "./account.css";

type Mode = "loading" | "signin" | "signup" | "confirm" | "profile";

interface Profile {
  handle: string | null;
  instagram: string | null;
  createdAt: string | null;
}

export default function AccountPage() {
  const [mode, setMode] = useState<Mode>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [handle, setHandle] = useState("");
  const [instagram, setInstagram] = useState("");

  const loadProfile = useCallback(async () => {
    const res = await authedFetch("/v1/me");
    if (!res.ok) throw new Error("Couldn't load your profile.");
    const p: Profile = await res.json();
    setProfile(p);
    setHandle(p.handle ?? "");
    setInstagram(p.instagram ?? "");
    setMode("profile");
  }, []);

  useEffect(() => {
    ensureAmplify();
    (async () => {
      try {
        const { getCurrentUser } = await import("aws-amplify/auth");
        await getCurrentUser();
        await loadProfile();
      } catch {
        setMode("signin");
      }
    })();
  }, [loadProfile]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const doSignUp = () =>
    run(async () => {
      const { signUp } = await import("aws-amplify/auth");
      await signUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });
      setNotice(`We emailed a verification code to ${email}.`);
      setMode("confirm");
    });

  const doConfirm = () =>
    run(async () => {
      const { confirmSignUp, signIn } = await import("aws-amplify/auth");
      await confirmSignUp({ username: email, confirmationCode: code.trim() });
      await signIn({ username: email, password });
      await loadProfile();
    });

  const doSignIn = () =>
    run(async () => {
      const { signIn } = await import("aws-amplify/auth");
      await signIn({ username: email, password });
      await loadProfile();
    });

  const doSignOut = () =>
    run(async () => {
      const { signOut } = await import("aws-amplify/auth");
      await signOut();
      setProfile(null);
      setMode("signin");
    });

  const doSave = () =>
    run(async () => {
      const body: Record<string, string> = {};
      if (handle.trim() !== (profile?.handle ?? "")) body.handle = handle.trim();
      if (instagram.trim() !== (profile?.instagram ?? ""))
        body.instagram = instagram.trim();
      if (Object.keys(body).length === 0) {
        setNotice("Nothing to save.");
        return;
      }
      const res = await authedFetch("/v1/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save.");
      setProfile(data);
      setHandle(data.handle ?? "");
      setInstagram(data.instagram ?? "");
      setNotice("Saved.");
    });

  return (
    <main className="game account">
      <header>
        <div>
          <div className="eyebrow">Account</div>
          <h1 className="wordmark">
            KiloGuessr<em>.</em>
          </h1>
        </div>
        <a className="link-btn" href="/">
          ← Back to the game
        </a>
      </header>

      {mode === "loading" && <p className="account-note">Loading…</p>}

      {(mode === "signin" || mode === "signup") && (
        <section className="card">
          <div className="tab-row">
            <button
              className="seg-tab"
              aria-pressed={mode === "signin"}
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
            <button
              className="seg-tab"
              aria-pressed={mode === "signup"}
              onClick={() => setMode("signup")}
            >
              Create account
            </button>
          </div>
          <label>
            Email
            <input
              type="email"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            className="check-btn"
            disabled={busy || !email || !password}
            onClick={mode === "signup" ? doSignUp : doSignIn}
          >
            {mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </section>
      )}

      {mode === "confirm" && (
        <section className="card">
          <p className="account-note">{notice || `Enter the code we emailed to ${email}.`}</p>
          <label>
            Verification code
            <input
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button className="check-btn" disabled={busy || !code} onClick={doConfirm}>
            Verify
          </button>
        </section>
      )}

      {mode === "profile" && profile && (
        <section className="card">
          <p className="account-note">
            {profile.handle
              ? `Signed in as @${profile.handle}`
              : "Claim your handle — it's your name on the leaderboards."}
          </p>
          <label>
            Handle
            <input
              value={handle}
              placeholder="e.g. plate_math_goblin"
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
            />
          </label>
          <label>
            Instagram (optional)
            <input
              value={instagram}
              placeholder="@yourlifting"
              onChange={(e) => setInstagram(e.target.value)}
            />
          </label>
          <div className="btn-row">
            <button className="check-btn" disabled={busy} onClick={doSave}>
              Save
            </button>
            {profile.handle && (
              <a className="link-btn" href={`/u/${profile.handle}`}>
                View public profile
              </a>
            )}
            <button className="link-btn" disabled={busy} onClick={doSignOut}>
              Sign out
            </button>
          </div>
        </section>
      )}

      {error && <p className="account-error">{error}</p>}
      {notice && mode === "profile" && <p className="account-note">{notice}</p>}
    </main>
  );
}
