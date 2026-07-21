function Glyph() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <rect
        x="2.2" y="2.2" width="19.6" height="19.6" rx="5.5"
        fill="none" stroke="currentColor" strokeWidth="2"
      />
      <circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.6" cy="6.4" r="1.3" fill="currentColor" />
    </svg>
  );
}

/**
 * Instagram link. Shows the glyph and username by default; `iconOnly` renders
 * just the clickable glyph (for tight spots like leaderboard rows).
 */
export default function InstagramLink({
  name,
  iconOnly,
}: {
  name: string;
  iconOnly?: boolean;
}) {
  return (
    <a
      className={`ig-link${iconOnly ? " ig-icon" : ""}`}
      href={`https://instagram.com/${name}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${name} on Instagram`}
      title={`@${name}`}
    >
      <Glyph />
      {!iconOnly && <span>{name}</span>}
    </a>
  );
}
