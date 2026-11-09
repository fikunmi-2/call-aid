import { readFileSync } from "node:fs";
import { afterEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import * as infrastructure from "@/lib/server";
import { readRecords } from "@/lib/records";
import { GET } from "@/app/api/sessions/status/route";

const fixture = JSON.parse(
  readFileSync("../contracts/fixtures/published.json", "utf8"),
);
function configure() {
  vi.stubEnv("SUPABASE_URL", "https://synthetic.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "synthetic-secret");
  vi.stubEnv("DEMO_ENABLED", "false");
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it("reads only validated published DTOs even when new voice sessions are disabled", async () => {
  configure();
  vi.spyOn(infrastructure, "database").mockReturnValue({
    rpc: vi
      .fn()
      .mockResolvedValue({
        data: {
          records: [fixture],
          stats: { total: 1, completed: 1, incomplete: 0, flagged: 1 },
        },
        error: null,
      }),
  } as unknown as ReturnType<typeof infrastructure.database>);
  const result = await readRecords();
  expect(result.records[0].recommendation.record_saved).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/session_id|room_name|receipt/);
});
it("fails closed on invalid DB projections and database errors", async () => {
  configure();
  const rpc = vi
    .fn()
    .mockResolvedValue({
      data: {
        records: [{ ...fixture, transcript: "unsafe" }],
        stats: { total: 1, completed: 1, incomplete: 0, flagged: 1 },
      },
      error: null,
    });
  vi.spyOn(infrastructure, "database").mockReturnValue({
    rpc,
  } as unknown as ReturnType<typeof infrastructure.database>);
  await expect(readRecords()).rejects.toThrow();
  rpc.mockResolvedValue({ data: null, error: { message: "private error" } });
  await expect(readRecords()).rejects.toThrow("records_unavailable");
});
it("status returns only the receipt-bound public outcome and case ID", async () => {
  configure();
  vi.spyOn(infrastructure, "database").mockReturnValue({
    rpc: vi
      .fn()
      .mockResolvedValue({
        data: {
          room_name: "private-room",
          receipt: "private-receipt",
          status: "completed",
          publication: "published",
          case_id: fixture.case_id,
          case_status: "completed",
        },
        error: null,
      }),
  } as unknown as ReturnType<typeof infrastructure.database>);
  const response = await GET(
    new NextRequest("http://localhost:3001/api/sessions/status", {
      headers: { cookie: `callaid-receipt=${"a".repeat(64)}` },
    }),
  );
  expect(await response.json()).toEqual({
    status: "completed",
    publication: "published",
    recordAvailable: true,
    caseId: fixture.case_id,
    caseStatus: "completed",
  });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it.each(["pending", "withheld", "failed"])(
  "never returns a record link for %s",
  async (publication) => {
    configure();
    vi.spyOn(infrastructure, "database").mockReturnValue({
      rpc: vi
        .fn()
        .mockResolvedValue({
          data: {
            room_name: "private-room",
            status: "incomplete",
            publication,
            case_id: fixture.case_id,
          },
          error: null,
        }),
    } as unknown as ReturnType<typeof infrastructure.database>);
    const response = await GET(
      new NextRequest("http://localhost:3001/api/sessions/status", {
        headers: { cookie: `callaid-receipt=${"b".repeat(64)}` },
      }),
    );
    const result = await response.json();
    expect(result.recordAvailable).toBe(false);
    expect(result.caseId).toBeUndefined();
  },
);
