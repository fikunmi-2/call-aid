import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { examples } from "@/lib/examples";
export default function Records() {
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
            A recognizable structure for a human story. Explore synthetic SBAR
            examples below.
          </p>
        </div>
        <span className="pill">Synthetic example library</span>
      </div>
      <div className="info-box">
        <strong>Preloaded synthetic examples</strong>
        <p>
          These are curated illustrations, not saved voice sessions. They remain
          available if voice is offline. Generating and saving new SBAR reports
          will be delivered in milestones 2 and 3. Not for medical use.
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
