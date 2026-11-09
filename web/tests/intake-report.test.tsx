// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { parseIntakeReport } from "@/lib/intake-report";
import { IntakePreview } from "@/components/intake-preview";

const fixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "../contracts/fixtures/incomplete.json"),
    "utf8",
  ),
);
const parse = (value: unknown) =>
  parseIntakeReport(new TextEncoder().encode(JSON.stringify(value)));
afterEach(cleanup);

describe("transient SBAR contract", () => {
  it("accepts the Python completed fixture and deterministic simulated flags", () => {
    const completed = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "../contracts/fixtures/completed.json"),
        "utf8",
      ),
    );
    const result = parse(completed);
    expect(result?.status).toBe("completed");
    expect(
      result?.assessment.simulated_flags.map((flag) => flag.code),
    ).toContain("DEMO_SUDDEN_HEADACHE");
  });
  it("accepts the Python-generated synthetic contract and renders unknowns and unsaved state", () => {
    const result = parse(fixture);
    expect(result).not.toBeNull();
    render(<IntakePreview report={result!} />);
    expect(screen.getByRole("heading", { name: "Situation" })).toBeTruthy();
    expect(screen.getByText(/Incomplete intake/)).toBeTruthy();
    expect(
      screen.getByText(/No record was saved/, { selector: "p" }),
    ).toBeTruthy();
    expect(screen.getAllByText("unknown").length).toBeGreaterThan(3);
  });
  it.each([
    (item: typeof fixture) => {
      item.situation.text = "Synthetic Alice at 123 Example St has flu";
    },
    (item: typeof fixture) => {
      item.status = "completed";
    },
    (item: typeof fixture) => {
      item.transcript = "Any raw conversation";
    },
    (item: typeof fixture) => {
      item.assessment.simulated_flags[0].label = "You are safe";
    },
    (item: typeof fixture) => {
      item.situation.facts[0] = {
        field: "chief_complaint",
        state: "reported",
        values: ["unrestricted narrative"],
      };
    },
    (item: typeof fixture) => {
      item.recommendation.record_saved = true;
    },
  ])("rejects unapproved or inconsistent public content", (change) => {
    const copy = structuredClone(fixture);
    change(copy);
    expect(parse(copy)).toBeNull();
  });
  it("rejects oversized and malformed packets", () => {
    expect(parseIntakeReport(new Uint8Array(24001))).toBeNull();
    expect(parseIntakeReport(new TextEncoder().encode("invalid"))).toBeNull();
  });
});
