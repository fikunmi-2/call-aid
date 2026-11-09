// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import * as records from "@/lib/records";
import Report from "@/app/records/[id]/page";
import Dashboard from "@/app/records/page";
import { IntakePreview } from "@/components/intake-preview";
import { parseIntakeReport } from "@/lib/intake-report";
vi.mock("@/lib/records", () => ({ readRecords: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("public-404");
  },
  useRouter: () => ({ refresh: () => {} }),
}));
const fixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "../contracts/fixtures/published.json"),
    "utf8",
  ),
);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("renders a saved public SBAR with all sections and accurate saved text", async () => {
  vi.mocked(records.readRecords).mockResolvedValue({
    records: [fixture],
    stats: { total: 1, completed: 1, incomplete: 0, flagged: 1 },
  });
  render(await Report({ params: Promise.resolve({ id: fixture.case_id }) }));
  for (const name of ["Situation", "Background", "Assessment"])
    expect(screen.getByRole("heading", { name })).toBeTruthy();
  expect(screen.getByRole("heading", { name: /Recommendation/ })).toBeTruthy();
  expect(
    screen.getByText(/generated and saved/, { selector: "p" }),
  ).toBeTruthy();
  expect(
    screen.queryByText(/No record was saved/, { selector: "p" }),
  ).toBeNull();
});
it("unknown or withheld IDs share the generic not-found result", async () => {
  vi.mocked(records.readRecords).mockResolvedValue({
    records: [],
    stats: { total: 0, completed: 0, incomplete: 0, flagged: 0 },
  });
  await expect(
    Report({ params: Promise.resolve({ id: fixture.case_id }) }),
  ).rejects.toThrow("public-404");
});
it("database failures show unavailable without exposing internal errors", async () => {
  vi.mocked(records.readRecords).mockRejectedValue(
    new Error("private database details"),
  );
  render(await Report({ params: Promise.resolve({ id: fixture.case_id }) }));
  expect(
    screen.getByRole("heading", { name: "Report unavailable" }),
  ).toBeTruthy();
  expect(screen.queryByText(/private database/)).toBeNull();
});
it("keeps curated examples separate from actual database statistics", async () => {
  vi.mocked(records.readRecords).mockResolvedValue({
    records: [fixture],
    stats: { total: 1, completed: 1, incomplete: 0, flagged: 1 },
  });
  const { container } = render(
    await Dashboard({ searchParams: Promise.resolve({}) }),
  );
  expect(
    Array.from(container.querySelectorAll(".record-stats strong")).map(
      (node) => node.textContent,
    ),
  ).toEqual(["1", "1", "0", "1"]);
  expect(screen.getByText("Preloaded synthetic examples")).toBeTruthy();
});
it("renders generalized and omitted detail notices for rich validated reports", () => {
  const data = JSON.parse(
    readFileSync("../contracts/fixtures/projected.json", "utf8"),
  );
  const report = parseIntakeReport(
    new TextEncoder().encode(JSON.stringify(data)),
  );
  expect(report).not.toBeNull();
  render(<IntakePreview report={report!} />);
  expect(
    screen.getByText(/Some details were omitted/, { selector: "p" }),
  ).toBeTruthy();
  expect(
    screen.getByText(/nausea, light sensitivity, dizziness, weakness/, {
      selector: "dd",
    }),
  ).toBeTruthy();
  data.assessment.public_data_handling.notes = "unrestricted private wording";
  expect(
    parseIntakeReport(new TextEncoder().encode(JSON.stringify(data))),
  ).toBeNull();
});
