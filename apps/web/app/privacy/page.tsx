import type { Metadata } from "next";
import Footer from "../../components/Footer";
import "../game.css";
import "../account/account.css";
import "./legal.css";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="game account">
      <header>
        <div>
          <div className="eyebrow">Privacy</div>
          <h1 className="wordmark">
            KiloGuessr<em>.</em>
          </h1>
        </div>
        <a className="link-btn" href="/">← Back to the game</a>
      </header>

      <article className="legal">
        <p className="legal-lede">
          KiloGuessr is a plate-math game. It keeps as little about you as it can
          while still running leaderboards.
        </p>

        <h2>What we store</h2>
        <ul>
          <li>
            <b>Your email address</b>, so you can sign in and reset your password.
            It is never shown to anyone else and we don&apos;t send marketing email.
          </li>
          <li>
            <b>Your handle</b>, and your Instagram username if you add one. Both are
            public — they appear on leaderboards and your profile.
          </li>
          <li>
            <b>Your ranked results</b>: scores, answers, and how long each card took.
            Scores are public; the rest is used to verify runs and is deleted after
            about 90 days.
          </li>
        </ul>

        <h2>What we don&apos;t do</h2>
        <ul>
          <li>No analytics, advertising, or third-party trackers.</li>
          <li>No selling or sharing your data.</li>
          <li>
            Practice mode sends nothing to the server at all — your settings and
            personal bests live only in your own browser.
          </li>
        </ul>

        <h2>Who can see it</h2>
        <p>
          Accounts are handled by Amazon Cognito and data is stored in Amazon
          DynamoDB, both in AWS&apos;s US East region. Nobody else has access.
        </p>

        <h2>Deleting your account</h2>
        <p>
          Go to your <a href="/account">account page</a> and choose Delete account.
          That erases your profile, handle, Instagram link, run history, and every
          leaderboard entry, then removes your login. It is immediate and cannot be
          undone — you never have to ask anyone to do it for you.
        </p>

        <p className="legal-updated">Last updated 20 July 2026.</p>
      </article>

      <Footer />
    </main>
  );
}
