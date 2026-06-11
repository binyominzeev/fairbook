import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "fairbook – discourse with dignity",
  description:
    "A social network for meaningful discussion, respectful disagreement, and accurate representation of opposing views.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 font-sans">{children}</body>
    </html>
  );
}
