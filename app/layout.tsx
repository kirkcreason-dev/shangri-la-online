import type { Metadata } from "next";
import "./globals.css";
import "./game-art.css";
import "./table-polish.css";

export const metadata: Metadata = {
  title: "Shangri-La Online · Official Beta",
  description: "The official multiplayer beta of The Quest for Shangri-La. Gather your friends, explore three regions, and reach Shangri-La.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
