import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

// Heavy condensed italic athletic face for the wordmark, buttons and headings —
// echoes the "METHOD" lettering. Self-hosted by next/font, no CDN at runtime.
const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

// Clean, slightly technical body companion.
const body = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const DESCRIPTION =
  "Flash-card training for kilo plate math. Read a loaded barbell, type the total, and climb the leaderboards. A Method Spotting & Loading joint.";

export const metadata: Metadata = {
  metadataBase: new URL("https://kiloguessr.liftinglookup.com"),
  title: {
    default: "KiloGuessr — kg plate math for powerlifters",
    template: "%s · KiloGuessr",
  },
  description: DESCRIPTION,
  applicationName: "KiloGuessr",
  openGraph: {
    type: "website",
    siteName: "KiloGuessr",
    title: "KiloGuessr — kg plate math for powerlifters",
    description: DESCRIPTION,
  },
  twitter: { card: "summary", title: "KiloGuessr", description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f0e" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
