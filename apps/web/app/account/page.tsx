"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MODE_LABELS,
  RANKED_MODES,
  formatScore,
  isEndurance,
} from "@kiloguessr/engine";
import TopNav from "../../components/TopNav";
import { authedFetch, ensureAmplify } from "../../lib/auth";
import "../game.css";
import "./account.css";
import "../ranked/ranked.css";

type Mode =
  | "loading"
  | "signin"
  | "signup"
  | "confirm"
  | "forgot"
  | "reset"
  | "profile";

const PW_RULES: [string, (p: string) => boolean][] = [
  ["At least 10 characters", (p) => p.length >= 10],
];

const passwordOk = (p: string) => PW_RULES.every(([, test]) => test(p));

function PasswordRules({ password }: { password: string }) {
  return (
    <ul className="pw-rules" aria-label="Password requirements">
      {PW_RULES.map(([label, test]) => {
        const ok = test(password);
        return (
          <li key={label} className={ok ? "ok" : password ? "bad" : ""}>
            <span aria-hidden="true">{ok ? "✓" : "○"}</span> {label}
          </li>
        );
      })}
    </ul>
  );
}

interface Profile {
  handle: string | null;
  instagram: string | null;
  createdAt: string | null;
  bests?: Record<string, { score: number; submittedAt: number }>;
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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

  const doForgot = () =>
    run(async () => {
      const { resetPassword } = await import("aws-amplify/auth");
      await resetPassword({ username: email });
      setNotice(`We emailed a reset code to ${email}.`);
      setCode("");
      setPassword("");
      setMode("reset");
    });

  const doReset = () =>
    run(async () => {
      const { confirmResetPassword, signIn } = await import("aws-amplify/auth");
      await confirmResetPassword({
        username: email,
        confirmationCode: code.trim(),
        newPassword: password,
      });
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

  const doDelete = () =>
    run(async () => {
      const res = await authedFetch("/v1/me", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't delete your account.");
      }
      // our data is gone; now remove the login itself
      const { deleteUser } = await import("aws-amplify/auth");
      await deleteUser();
      setProfile(null);
      setConfirmingDelete(false);
      setMode("signin");
      setNotice("Your account and all its scores have been deleted.");
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
      <TopNav active="account" />
      <div className="page-title">
        <div className="eyebrow">
          {mode === "profile" ? "Edit profile" : "Account"}
        </div>
      </div>

      {mode === "loading" && <p className="account-note">Loading…</p>}

      {(mode === "signin" || mode === "signup") && (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            (mode === "signup" ? doSignUp : doSignIn)();
          }}
        >
          <div className="tab-row">
            <button
              type="button"
              className="seg-tab"
              aria-pressed={mode === "signin"}
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
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
          {mode === "signup" && <PasswordRules password={password} />}
          <button
            type="submit"
            className="check-btn"
            disabled={
              busy ||
              !email ||
              !password ||
              (mode === "signup" && !passwordOk(password))
            }
          >
            {mode === "signup" ? "Create account" : "Sign in"}
          </button>
          {mode === "signin" && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setError("");
                setNotice("");
                setMode("forgot");
              }}
            >
              Forgot your password?
            </button>
          )}
        </form>
      )}

      {mode === "forgot" && (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            doForgot();
          }}
        >
          <p className="account-note">
            Enter your email and we&apos;ll send you a code to set a new password.
          </p>
          <label>
            Email
            <input
              type="email"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button type="submit" className="check-btn" disabled={busy || !email}>
            Send reset code
          </button>
          <button type="button" className="link-btn" onClick={() => setMode("signin")}>
            Back to sign in
          </button>
        </form>
      )}

      {mode === "reset" && (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            doReset();
          }}
        >
          <p className="account-note">{notice || `Enter the code we emailed to ${email}.`}</p>
          <label>
            Reset code
            <input
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <PasswordRules password={password} />
          <button
            type="submit"
            className="check-btn"
            disabled={busy || !code || !passwordOk(password)}
          >
            Set new password
          </button>
          <button type="button" className="link-btn" onClick={doForgot} disabled={busy}>
            Send a new code
          </button>
        </form>
      )}

      {mode === "confirm" && (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            doConfirm();
          }}
        >
          <p className="account-note">{notice || `Enter the code we emailed to ${email}.`}</p>
          <label>
            Verification code
            <input
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button type="submit" className="check-btn" disabled={busy || !code}>
            Verify
          </button>
        </form>
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
          {profile.bests && RANKED_MODES.some((m) => profile.bests?.[m]) && (
            <div className="bests">
              {RANKED_MODES.map((m) =>
                profile.bests?.[m] ? (
                  <div className="best-row" key={m}>
                    <span>{MODE_LABELS[m]}</span>
                    <b>
                      {formatScore(m, profile.bests[m].score)}
                      {isEndurance(m) ? " lifts" : ""}
                    </b>
                  </div>
                ) : null,
              )}
            </div>
          )}
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

          <div className="danger-zone">
            {confirmingDelete ? (
              <>
                <p className="account-note">
                  This erases your handle, Instagram link, run history and every
                  leaderboard entry, then removes your login. It can&apos;t be undone.
                </p>
                <div className="btn-row">
                  <button className="danger-btn" disabled={busy} onClick={doDelete}>
                    Yes, delete everything
                  </button>
                  <button
                    className="link-btn"
                    disabled={busy}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Keep my account
                  </button>
                </div>
              </>
            ) : (
              <button className="danger-btn" onClick={() => setConfirmingDelete(true)}>
                Delete account
              </button>
            )}
          </div>
        </section>
      )}

      {error && <p className="account-error">{error}</p>}
      {notice && mode === "profile" && <p className="account-note">{notice}</p>}
    </main>
  );
}
