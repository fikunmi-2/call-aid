import { factText, type IntakeReport } from "@/lib/intake-report";
import { intakeLabels } from "@/lib/intake-values";

export function IntakePreview({ report }: { report: IntakeReport }) {
  return (
    <section className="intake-preview" aria-labelledby="intake-heading">
      <p className="eyebrow">TEMPORARY INTAKE SUMMARY · NOT SAVED</p>
      <h2 id="intake-heading">{report.demonstration_label}</h2>
      <p role="status">
        {report.status === "completed"
          ? "Reviewed and complete"
          : report.status === "review_pending"
            ? "Please review the spoken recap"
            : "Incomplete intake"}
        . This preview stays on this page and is not published in the records
        dashboard.
      </p>
      <p className="small muted">
        Generalized patient-reported information. Not for medical use.
      </p>
      {(
        [
          ["Situation", report.situation],
          ["Background", report.background],
          ["Assessment", report.assessment],
        ] as const
      ).map(([title, section]) => (
        <div key={title} className="intake-section">
          <h3>{title}</h3>
          <dl>
            {section.facts.map((fact) => (
              <div key={fact.field}>
                <dt>
                  {intakeLabels[fact.field]}{" "}
                  {fact.state === "reported" && (
                    <span className="muted">(reported)</span>
                  )}
                </dt>
                <dd>{factText(fact)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      <p>{report.assessment.disclaimer}</p>
      {report.assessment.missing_information.length > 0 && (
        <p>
          <strong>Unknown, not provided, or unresolved: </strong>
          {report.assessment.missing_information
            .map((key) => intakeLabels[key])
            .join(", ")}
          .
        </p>
      )}
      <h3>Screening simulation</h3>
      {report.assessment.simulated_flags.length ? (
        <ul>
          {report.assessment.simulated_flags.map((flag) => (
            <li key={flag.code}>{flag.label}</li>
          ))}
        </ul>
      ) : (
        <p>
          No configured demonstration rule matched. This does not establish
          safety or clinical urgency.
        </p>
      )}
      <h3>Recommendation — prototype actions</h3>
      <p>{report.recommendation.text}</p>
      <details>
        <summary>View structured SBAR JSON</summary>
        <pre>{JSON.stringify(report, null, 2)}</pre>
      </details>
    </section>
  );
}
