import "./game.css";
import "./account/account.css";

export default function NotFound() {
  return (
    <main className="game account">
      <header>
        <div>
          <div className="eyebrow">Missed lift</div>
          <h1 className="wordmark">
            KiloGuessr<em>.</em>
          </h1>
        </div>
      </header>
      <section className="card">
        <p className="account-note">
          There&apos;s nothing loaded on this page — the link may be old or mistyped.
        </p>
        <a className="check-btn linkish" href="/">Back to the bar</a>
      </section>
    </main>
  );
}
