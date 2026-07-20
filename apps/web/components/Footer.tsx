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
        <span>KiloGuessr — kg plate math for powerlifters</span>
      </nav>
    </footer>
  );
}
