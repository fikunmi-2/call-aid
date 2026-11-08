import Link from "next/link";
import { notFound } from "next/navigation";
import { examples } from "@/lib/examples";
export default async function Report({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = examples.find((e) => e.id === id);
  if (!r) notFound();
  return (
    <div className="shell page report">
      <Link href="/records" className="text-link">
        ← Back to records
      </Link>
      <p className="eyebrow report-label">PRELOADED SYNTHETIC EXAMPLE</p>
      <h1>{r.label}</h1>
      <p className="lede">
        Structured SBAR demonstration · Not for medical use
      </p>
      <div className="report-meta">
        <span>{r.status}</span>
        <span>{r.region || "Region: unknown"}</span>
        <span>Fixture · No live session timestamp</span>
      </div>
      <div className="info-box">
        This is a curated example. It was not generated or saved from a voice
        conversation. All information is fictional.
      </div>
      {[
        {
          key: "S",
          title: "Situation",
          sub: "Presenting concern · user-reported",
          text: r.situation,
        },
        {
          key: "B",
          title: "Background",
          sub: "Reported context and history",
          text: r.background,
        },
        {
          key: "A",
          title: "Assessment",
          sub: "Reported observations, unknowns and simulated rules",
          text: r.assessment,
        },
        {
          key: "R",
          title: "Recommendation",
          sub: "Actions performed by the demonstration",
          text: r.recommendation,
        },
      ].map((s) => (
        <section className="sbar-row" key={s.key}>
          <span className="sbar-letter">{s.key}</span>
          <div>
            <h2>{s.title}</h2>
            <p className="eyebrow">{s.sub}</p>
            <p>{s.text}</p>
          </div>
        </section>
      ))}
      <p className="small muted">
        No clinical diagnosis, treatment recommendation or validated triage.
        This public example contains no transcript or real patient information.
      </p>
    </div>
  );
}
