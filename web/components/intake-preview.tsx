import { factText, type IntakeReport } from "@/lib/intake-report";
import { intakeLabels } from "@/lib/intake-values";

export function IntakePreview({ report }: { report: IntakeReport }) {
  const saved = report.publication === "published";
  return (
    <section className="intake-preview" aria-labelledby="intake-heading">
      <p className="eyebrow">
        {saved
          ? "PUBLISHED DEMONSTRATION REPORT"
          : "INTAKE DRAFT · NOT YET SAVED"}
      </p>
      <h2 id="intake-heading">{report.demonstration_label}</h2>
      <p role="status">
        {report.status === "completed"
          ? "Reviewed and complete"
          : report.status === "review_pending"
            ? "Please review the spoken recap"
            : "Incomplete intake"}
        .{" "}
        {saved
          ? "This sanitized demonstration report is publicly readable."
          : "This is a draft. The website checks publication and saving after the call."}
      </p>
      <p className="small muted">
        Generalized patient-reported information. Not for medical use.
      </p>
      {report.assessment.public_data_handling && (
        <p className="small muted">
          Reported information is represented using approved broad categories.
          {report.assessment.public_data_handling.details_omitted &&
            " Some details were omitted from this public report. No identifying details or original wording are included."}{" "}
          Unknown or unprovided answers remain marked below.
        </p>
      )}
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
