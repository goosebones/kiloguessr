"use client";

import "./game.css";
import "./account/account.css";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="game account">
      <header>
        <div>
          <div className="eyebrow">No lift</div>
          <h1 className="wordmark">
            KiloGuessr<em>.</em>
          </h1>
        </div>
      </header>
      <section className="card">
        <p className="account-note">
          Something broke on our end. Lets hope the chief referee can run the meet
          off attempt cards.
        </p>
        <button className="check-btn" onClick={reset}>
          Try again
        </button>
        <a className="link-btn" href="/">Back to the game</a>
      </section>
    </main>
  );
}
