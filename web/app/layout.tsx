import type { Metadata } from "next";
import Link from "next/link";
import { AudioLines, ArrowUpRight } from "lucide-react";
import "./globals.css";
export const metadata: Metadata = {
  title: "Call AId · A conversation, clearly captured",
  description:
    "A voice intake research prototype for rural Saskatchewan. Fictional demonstrations only. Not for medical use.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <div className="notice">
          <span className="notice-dot" /> RESEARCH PROTOTYPE{" "}
          <span className="notice-divider">/</span> Not for medical use
        </div>
        <header className="header shell">
          <Link className="brand" href="/" aria-label="Call AId home">
            <span className="brand-icon">
              <AudioLines size={22} />
            </span>
            Call <span className="brand-ai">AId</span>
          </Link>
          <nav aria-label="Main navigation">
            <Link href="/demo">Voice demo</Link>
            <Link href="/records">
              Records Console <ArrowUpRight size={14} />
            </Link>
          </nav>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="shell footer">
          <span>
            Call AId <span className="muted">/ Research in conversation.</span>
          </span>
          <span>
            Made for a rural Saskatchewan research context.
            <br />
            Fictional information only. Not for medical use.
          </span>
        </footer>
      </body>
    </html>
  );
}
