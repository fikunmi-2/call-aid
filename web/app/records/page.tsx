import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { examples } from "@/lib/examples";
import { readRecords, type RecordList } from "@/lib/records";
import { RecordsRefresh } from "@/components/records-refresh";
import { factText } from "@/lib/intake-report";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function Records({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const query = await searchParams;
  const page = /^\d{1,2}$/.test(query.page || "")
    ? Math.min(50, Number(query.page))
    : 0;
  let saved: RecordList | null = null;
  try {
    saved = await readRecords(undefined, page);
  } catch {
    /* Examples remain available when the DB is offline. */
  }
  return (
    <div className="shell page">
      <p className="eyebrow">PUBLIC DEMONSTRATION CONSOLE</p>
      <div className="page-title">
        <div>
          <h1>
            Conversations,
            <br />
            <em>clearly captured.</em>
          </h1>
          <p className="lede">
            Sanitized demonstration reports, organized for review. Not for
            medical use.
          </p>
        </div>
        <span className="pill">Public demonstration records</span>
      </div>
      <section aria-labelledby="published-heading">
        <h2 id="published-heading">Published voice-session records</h2>
        <div className="record-stats">
          {(
            [
              ["Total published", "total"],
              ["Completed", "completed"],
              ["Incomplete", "incomplete"],
              ["With simulated flags", "flagged"],
            ] as const
          ).map(([label, key]) => (
            <div key={key}>
              <strong>{saved ? saved.stats[key] : "—"}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        {!saved ? (
          <p role="status">
            Published records are temporarily unavailable. The synthetic
            examples below still work.
          </p>
        ) : saved.records.length === 0 ? (
          <p>No published records on this page yet.</p>
        ) : (
          <div className="record-grid">
            {saved.records.map((record) => (
              <Link
                key={record.case_id}
                href={`/records/${record.case_id}`}
                className="record-card"
              >
                <div className="card-top">
                  <FileText size={22} />
                  <span className="pill">{record.status}</span>
                </div>
                <h2>{record.demonstration_label}</h2>
                <p className="small muted">
                  {record.generated_on} · Generalized date
                </p>
                <p>{record.situation.text}</p>
                <p>
                  Associated symptoms:{" "}
                  {record.background.facts
                    .filter((f) => f.field === "associated_symptoms")
                    .map(factText)
                    .join(", ") || "unknown"}
                </p>
                <div className="record-bottom">
                  <span>
                    {record.assessment.simulated_flags
                      .map((flag) => flag.label)
                      .join("; ") ||
                      "No configured rule matched; not safety clearance"}
                  </span>
                  <ArrowUpRight size={20} />
                </div>
              </Link>
            ))}
          </div>
        )}
        <nav aria-label="Record pages" className="record-pages">
          {page > 0 && <Link href={`/records?page=${page - 1}`}>Previous</Link>}
          {saved && (page + 1) * 20 < saved.stats.total && page < 50 && (
            <Link href={`/records?page=${page + 1}`}>Next</Link>
          )}
        </nav>
        <RecordsRefresh />
      </section>
      <div className="info-box">
        <strong>Preloaded synthetic examples</strong>
        <p>
          These are curated illustrations, not saved voice sessions. They remain
          available if voice is offline and are excluded from the live record
          statistics above. Not for medical use.
        </p>
      </div>
      <div className="record-grid">
        {examples.map((r) => (
          <Link key={r.id} href={`/records/${r.id}`} className="record-card">
            <div className="card-top">
              <FileText size={22} />
              <span className="pill">Synthetic example</span>
            </div>
            <h2>{r.label}</h2>
            <p className="small muted">
              {r.region || "Region unknown"} · {r.status}
            </p>
            <div className="tags">
              {r.symptoms.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <p>{r.situation}</p>
            <div className="record-bottom">
              <span>{r.flag}</span>
              <ArrowUpRight size={20} />
            </div>
          </Link>
        ))}
      </div>
      <p className="small muted">
        Public reports use generated labels and generalized regional
        information. No real patient records or raw transcripts.
      </p>
    </div>
  );
}
