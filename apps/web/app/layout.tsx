import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KiloGuessr",
  description:
    "Kg plate math for powerlifters. Read the bar, load the bar, climb the leaderboards.",
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
