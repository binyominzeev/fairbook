import type { Metadata } from "next";
import Link from "next/link";
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
      <body className="min-h-full flex flex-col bg-slate-50 font-sans">
        {children}
        <footer className="mt-auto border-t border-slate-200 bg-white/90 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 text-sm text-slate-500 sm:px-6">
            <p>fairbook</p>
            <Link href="/about" className="transition-colors hover:text-slate-900">
              About
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
