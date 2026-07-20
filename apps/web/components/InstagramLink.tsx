/** Instagram username shown with the glyph and no leading @. */
export default function InstagramLink({ name }: { name: string }) {
  return (
    <a
      className="ig-link"
      href={`https://instagram.com/${name}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
        <rect
          x="2.2" y="2.2" width="19.6" height="19.6" rx="5.5"
          fill="none" stroke="currentColor" strokeWidth="2"
        />
        <circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.6" cy="6.4" r="1.3" fill="currentColor" />
      </svg>
      <span>{name}</span>
    </a>
  );
}
