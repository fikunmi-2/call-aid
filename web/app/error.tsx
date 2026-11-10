"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="shell page">
      <p className="eyebrow">SOMETHING WENT WRONG</p>
      <h1>We couldn’t load this page.</h1>
      <p className="lede">Please try again, or return to the landing page.</p>
      <div className="actions">
        <button className="button primary" onClick={reset}>
          Try again
        </button>
        <Link className="text-link" href="/">
          Back to home
        </Link>
      </div>
    </div>
  );
}
