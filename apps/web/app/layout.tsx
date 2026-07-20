import type { Metadata, Viewport } from "next";
import "./globals.css";

const DESCRIPTION =
  "Flash-card training for kilo plate math. Read a loaded barbell, type the total, and climb the leaderboards.";

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
    { media: "(prefers-color-scheme: light)", color: "#eff0ee" },
    { media: "(prefers-color-scheme: dark)", color: "#14161a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
