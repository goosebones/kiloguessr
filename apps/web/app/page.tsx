export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        IPF kg · ranked plate math
      </div>
      <h1
        style={{
          fontFamily: "var(--display)",
          fontSize: "clamp(44px, 9vw, 84px)",
          fontWeight: 800,
          letterSpacing: "0.01em",
          textTransform: "uppercase",
          lineHeight: 1,
        }}
      >
        KiloGuessr
        <span style={{ color: "var(--accent)" }}>.</span>
      </h1>
      <p style={{ color: "var(--muted)", maxWidth: 420 }}>
        Read the bar. Load the bar. Climb the board.
      </p>
      <p
        style={{
          fontFamily: "var(--mono)",
          fontSize: 13,
          color: "var(--muted)",
          border: "1px solid var(--line)",
          background: "var(--surface)",
          borderRadius: 8,
          padding: "6px 14px",
        }}
      >
        launching soon
      </p>
    </main>
  );
}
