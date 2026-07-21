export default function Footer() {
  return (
    <footer className="site-footer">
      <nav>
        <a href="/">Practice</a>
        <a href="/ranked">Ranked</a>
        <a href="/leaderboards">Leaderboards</a>
        <a href="/account">Account</a>
      </nav>
      <nav className="footer-legal">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </nav>
      <a
        className="footer-brand"
        href="https://instagram.com/methodspottingloading"
        target="_blank"
        rel="noopener noreferrer"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/method-96.png" alt="" width={26} height={26} />
        <span>
          created by <b>Method Spotting &amp; Loading</b>
        </span>
      </a>
    </footer>
  );
}
