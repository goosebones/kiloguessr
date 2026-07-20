import type { Metadata } from "next";
import Footer from "../../components/Footer";
import "../game.css";
import "../account/account.css";
import "../privacy/legal.css";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <main className="game account">
      <header>
        <div>
          <div className="eyebrow">Terms</div>
          <h1 className="wordmark">
            KiloGuessr<em>.</em>
          </h1>
        </div>
        <a className="link-btn" href="/">← Back to the game</a>
      </header>

      <article className="legal">
        <p className="legal-lede">
          KiloGuessr is a free game run as a side project. Play fair and we&apos;ll
          get along.
        </p>

        <h2>Fair play</h2>
        <ul>
          <li>
            Ranked runs are scored on the server. Scripting, automating, or otherwise
            faking answers gets the run thrown out and can cost you your account.
          </li>
          <li>
            Practice mode is yours to play however you like — nothing there is ranked.
          </li>
        </ul>

        <h2>Your handle and links</h2>
        <ul>
          <li>
            Pick a handle you&apos;d be happy to see on a leaderboard. Impersonation,
            slurs, and harassment are grounds for removal.
          </li>
          <li>
            Instagram links are self-reported and unverified — we can&apos;t confirm
            an account belongs to the person who linked it. Tell us if someone is
            impersonating you and we&apos;ll remove it.
          </li>
        </ul>

        <h2>No guarantees</h2>
        <p>
          The game is provided as-is. It might go down, boards might be reset while
          scoring is still being tuned, and features may change. Nothing here is
          coaching or competition advice — always confirm the actual bar before you
          lift.
        </p>

        <h2>Ending things</h2>
        <p>
          Delete your account any time from your{" "}
          <a href="/account">account page</a>. We may remove accounts that break these
          terms.
        </p>

        <p className="legal-updated">Last updated 20 July 2026.</p>
      </article>

      <Footer />
    </main>
  );
}
