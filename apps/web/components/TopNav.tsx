"use client";

import { useEffect, useState } from "react";
import { authedFetch, ensureAmplify } from "../lib/auth";

/**
 * Site header: wordmark (home) on the left, Ranked + Account on the right.
 * "Account" resolves to the signed-in lifter's public profile once we know
 * their handle, and otherwise falls back to the sign-in page.
 */
export default function TopNav({ active }: { active?: "ranked" | "account" }) {
  const [accountHref, setAccountHref] = useState("/account");

  useEffect(() => {
    ensureAmplify();
    (async () => {
      try {
        const { getCurrentUser } = await import("aws-amplify/auth");
        await getCurrentUser();
        const res = await authedFetch("/v1/me");
        const me = await res.json();
        if (me.handle) setAccountHref(`/u/${me.handle}`);
      } catch {
        /* signed out — keep /account */
      }
    })();
  }, []);

  return (
    <header className="topnav">
      <a href="/" className="brand" aria-label="KiloGuessr — practice">
        <span className="wordmark">
          KiloGuessr<em>.</em>
        </span>
      </a>
      <nav className="topnav-links" aria-label="Primary">
        <a href="/ranked" aria-current={active === "ranked" ? "page" : undefined}>
          Ranked
        </a>
        <a href={accountHref} aria-current={active === "account" ? "page" : undefined}>
          Account
        </a>
      </nav>
    </header>
  );
}
