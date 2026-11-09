import type { IntakeReport } from "@/lib/intake-report";
import { IntakePreview } from "./intake-preview";
export function SavedReport({ report }: { report: IntakeReport }) {
  return (
    <>
      <div className="report-meta">
        <span>{report.status}</span>
        <span>
          {report.reviewed ? "Caller reviewed" : "Not confirmed by caller"}
        </span>
        <span>Created {report.generated_on} · Generalized date</span>
        <span>Region not collected</span>
      </div>
      <IntakePreview report={report} />
    </>
  );
}
