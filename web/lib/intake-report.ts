import { z } from "zod";
import { intakeLabels, intakeValues } from "./intake-values";

const field = z.enum(
  Object.keys(intakeValues) as [
    keyof typeof intakeValues,
    ...Array<keyof typeof intakeValues>,
  ],
);
const fact = z
  .object({
    field,
    state: z.enum(["reported", "unknown", "declined"]),
    values: z.array(z.string().max(60)).max(8),
  })
  .strict()
  .superRefine((item, context) => {
    const allowed = intakeValues[item.field];
    const invalid =
      item.state === "reported"
        ? item.values.length === 0 ||
          item.values.some((value) => !Object.hasOwn(allowed, value)) ||
          (item.field !== "associated_symptoms" &&
            item.field !== "background" &&
            item.values.length !== 1)
        : item.values.length !== 0;
    if (
      invalid ||
      new Set(item.values).size !== item.values.length ||
      (item.values.includes("none_reported") && item.values.length > 1)
    )
      context.addIssue({
        code: "custom",
        message: "Unsupported or inconsistent fact",
      });
  });
type Fact = z.infer<typeof fact>;
export function factText(item: Fact) {
  if (item.state === "unknown") return "unknown";
  if (item.state === "declined") return "not provided";
  const values: Record<string, string> = intakeValues[item.field];
  return item.values.map((value) => values[value]).join(", ");
}
const sectionShape = {
  text: z.string().max(2400),
  facts: z.array(fact).max(12),
};
const section = z.object(sectionShape).strict();
const flagLabels = {
  DEMO_BREATHING_REPORTED:
    "Simulated marker: breathing difficulty was reported",
  DEMO_SUDDEN_HEADACHE: "Simulated marker: headache with reported sudden onset",
  DEMO_MAJOR_IMPACT:
    "Simulated marker: severe symptoms or major activity impact reported",
  DEMO_WORSENING: "Simulated marker: worsening was reported",
  DEMO_INCOMPLETE:
    "Simulated marker: intake has missing information or is unreviewed",
} as const;
const report = z
  .object({
    schema_version: z.enum(["2.0", "3.0"]),
    publication_policy_version: z.literal("public-1.0").optional(),
    workflow_version: z.literal("intake-2.0"),
    rules_version: z.literal("demo-rules-1.0"),
    case_id: z.uuid(),
    demonstration_label: z.string().regex(/^Demo Case [A-F0-9]{6}$/),
    started_on: z.iso.date(),
    generated_on: z.iso.date(),
    status: z.enum(["review_pending", "completed", "incomplete"]),
    reviewed: z.boolean(),
    not_for_medical_use: z.literal(true),
    publication: z.enum(["not_published", "published"]),
    situation: section,
    background: section,
    assessment: z
      .object({
        ...sectionShape,
        disclaimer: z.literal(
          "User-reported information and simulated flags only; not a diagnosis or validated triage.",
        ),
        missing_information: z.array(field).max(12),
        public_data_handling: z
          .object({
            policy_version: z.literal("projection-1.1"),
            generalized_fields: z.array(field).max(12),
            details_omitted: z.boolean(),
          })
          .strict()
          .nullable()
          .optional(),
        simulated_flags: z
          .array(
            z
              .object({
                code: z.enum(
                  Object.keys(flagLabels) as [
                    keyof typeof flagLabels,
                    ...Array<keyof typeof flagLabels>,
                  ],
                ),
                label: z.string().max(160),
                evidence_fields: z.array(field).max(12),
              })
              .strict(),
          )
          .max(5),
      })
      .strict(),
    recommendation: z
      .object({
        text: z.string().max(600),
        actions: z
          .array(
            z.enum([
              "recap_prepared",
              "caller_reviewed",
              "session_incomplete",
              "record_saved",
            ]),
          )
          .max(4),
        approved_information_ids: z
          .array(z.enum(["onset", "severity", "sbar", "cough"]))
          .max(4),
        record_saved: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((item, context) => {
    const reject = () =>
      context.addIssue({
        code: "custom",
        message: "Report must use approved templates and consistent status",
      });
    for (const section of [item.situation, item.background, item.assessment]) {
      if (
        new Set(section.facts.map((fact) => fact.field)).size !==
          section.facts.length ||
        section.text !==
          section.facts
            .map((fact) => `${intakeLabels[fact.field]}: ${factText(fact)}.`)
            .join(" ")
      )
        reject();
    }
    if (
      item.demonstration_label !==
      `Demo Case ${item.case_id.slice(0, 6).toUpperCase()}`
    )
      reject();
    if (
      item.status === "completed" &&
      (!item.reviewed || item.assessment.missing_information.length)
    )
      reject();
    if (item.status === "review_pending" && item.reviewed) reject();
    for (const flag of item.assessment.simulated_flags)
      if (flag.label !== flagLabels[flag.code]) reject();
    const handling = item.assessment.public_data_handling;
    if (
      handling &&
      new Set(handling.generalized_fields).size !==
        handling.generalized_fields.length
    )
      reject();
    const saved = item.publication === "published";
    if (
      saved !== item.recommendation.record_saved ||
      (saved &&
        (item.schema_version !== "3.0" ||
          item.publication_policy_version !== "public-1.0" ||
          item.status === "review_pending")) ||
      (!saved &&
        (item.schema_version !== "2.0" ||
          item.publication_policy_version !== undefined))
    )
      reject();
    const actions = [
      "recap_prepared",
      ...(item.reviewed ? ["caller_reviewed"] : []),
      ...(item.status !== "completed" ? ["session_incomplete"] : []),
      ...(saved ? ["record_saved"] : []),
    ];
    if (JSON.stringify(actions) !== JSON.stringify(item.recommendation.actions))
      reject();
    const expected =
      (saved
        ? "The prototype generated and saved this demonstration report."
        : "The prototype prepared an intake recap.") +
      (item.reviewed
        ? " The caller reviewed it."
        : " It has not been confirmed by the caller.") +
      (item.assessment.missing_information.length
        ? " Important information is incomplete."
        : "") +
      (saved
        ? " No clinical recommendation was made."
        : " No record was saved and no clinical recommendation was made.");
    if (item.recommendation.text !== expected) reject();
  });
export type IntakeReport = z.infer<typeof report>;
export function parsePublishedReport(value: unknown): IntakeReport | null {
  const result = report.safeParse(value);
  return result.success && result.data.publication === "published"
    ? result.data
    : null;
}
export function parseIntakeReport(data: Uint8Array): IntakeReport | null {
  if (data.byteLength > 24000) return null;
  try {
    return report.parse(JSON.parse(new TextDecoder().decode(data)));
  } catch {
    return null;
  }
}
