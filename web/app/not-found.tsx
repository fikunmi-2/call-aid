import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell page">
      <p className="eyebrow">PAGE UNAVAILABLE</p>
      <h1>Let’s find your way back.</h1>
      <p className="lede">
        This page or published report is unavailable. Demonstration records
        expire after seven days; synthetic examples remain available.
      </p>
      <div className="actions">
        <Link className="button primary" href="/records#examples">
          Explore examples
        </Link>
        <Link className="text-link" href="/">
          Back to home
        </Link>
      </div>
    </div>
  );
}
