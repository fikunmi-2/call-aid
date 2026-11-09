import { it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  AgentDispatchClient,
  RoomServiceClient,
  TokenVerifier,
} from "livekit-server-sdk";
import * as infrastructure from "@/lib/server";
import { POST } from "@/app/api/sessions/route";
import { config } from "@/lib/config";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
function configured() {
  for (const [key, value] of Object.entries({
    DEMO_ENABLED: "true",
    APP_ORIGIN: "http://localhost:3000",
    LIVEKIT_URL: "wss://synthetic.livekit.cloud",
    LIVEKIT_API_KEY: "test-key",
    LIVEKIT_API_SECRET: "synthetic-secret-at-least-32-characters",
    SUPABASE_URL: "https://synthetic.supabase.co",
    SUPABASE_SECRET_KEY: "test-only-key",
    SESSION_HMAC_SECRET: "synthetic-hmac-at-least-32-characters",
  }))
    vi.stubEnv(key, value);
}
it.each([
  {
    environment: "development",
    hosted: "0",
    origin: "http://localhost:3000",
    enabled: true,
  },
  {
    environment: "production",
    hosted: "0",
    origin: "http://localhost:3000",
    enabled: false,
  },
  {
    environment: "development",
    hosted: "1",
    origin: "http://localhost:3000",
    enabled: false,
  },
  {
    environment: "development",
    hosted: "0",
    origin: "https://example.org",
    enabled: false,
  },
])(
  "unmetered flag respects server environment $environment / $hosted / $origin",
  async ({ environment, hosted, origin, enabled }) => {
    configured();
    vi.stubEnv("NODE_ENV", environment);
    vi.stubEnv("VERCEL", hosted);
    vi.stubEnv("DEV_UNLIMITED_SESSIONS", "true");
    vi.stubEnv("APP_ORIGIN", origin);
    const rpc = vi.fn().mockResolvedValue({
      data: { allowed: false, reason: "busy" },
      error: null,
    });
    vi.spyOn(infrastructure, "database").mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof infrastructure.database>);
    await POST(
      new NextRequest(origin + "/api/sessions", {
        method: "POST",
        headers: { origin, "x-vercel-forwarded-for": "192.0.2.1" },
      }),
    );
    const limits = rpc.mock.calls[0][1];
    for (const key of [
      "p_rate",
      "p_daily",
      "p_global_daily",
      "p_daily_seconds",
      "p_monthly_budget",
    ]) {
      if (enabled) expect(limits[key]).toBeNull();
      else expect(limits[key]).toEqual(expect.any(Number));
    }
    expect(limits.p_concurrency).toBeGreaterThan(0);
    expect(limits.p_call_seconds).toBe(180);
    expect(limits.p_cost).toBeGreaterThan(0);
  },
);
it("an admitted request dispatches the configured agent and returns a scoped token and private receipt", async () => {
  configured();
  const rpc = vi.fn().mockResolvedValue({
    data: {
      allowed: true,
      expires_at: new Date(Date.now() + 240000).toISOString(),
    },
    error: null,
  });
  vi.spyOn(infrastructure, "database").mockReturnValue({
    rpc,
  } as unknown as ReturnType<typeof infrastructure.database>);
  const create = vi
    .spyOn(RoomServiceClient.prototype, "createRoom")
    .mockResolvedValue(
      {} as Awaited<ReturnType<RoomServiceClient["createRoom"]>>,
    );
  const dispatch = vi
    .spyOn(AgentDispatchClient.prototype, "createDispatch")
    .mockResolvedValue(
      {} as Awaited<ReturnType<AgentDispatchClient["createDispatch"]>>,
    );
  const response = await POST(
    new NextRequest("http://localhost:3000/api/sessions", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    }),
  );
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(Object.keys(result).sort()).toEqual([
    "expiresAt",
    "maxCallSeconds",
    "participantToken",
    "serverUrl",
  ]);
  const claims = await new TokenVerifier(
    "test-key",
    "synthetic-secret-at-least-32-characters",
  ).verify(result.participantToken);
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({ name: claims.video?.room, maxParticipants: 2 }),
  );
  expect(dispatch).toHaveBeenCalledWith(claims.video?.room, "call-aid");
  expect(response.cookies.get("callaid-receipt")?.value).toMatch(
    /^[a-f0-9]{64}$/,
  );
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  const reservation = rpc.mock.calls[0][1];
  expect(reservation.p_receipt).not.toBe(
    response.cookies.get("callaid-receipt")?.value,
  );
  expect(result).not.toHaveProperty("receipt");
});
it("denied reservations never create a room or dispatch inference", async () => {
  configured();
  vi.spyOn(infrastructure, "database").mockReturnValue({
    rpc: vi.fn().mockResolvedValue({
      data: { allowed: false, reason: "busy" },
      error: null,
    }),
  } as unknown as ReturnType<typeof infrastructure.database>);
  const create = vi.spyOn(RoomServiceClient.prototype, "createRoom");
  const response = await POST(
    new NextRequest("http://localhost:3000/api/sessions", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    }),
  );
  expect(response.status).toBe(429);
  expect(create).not.toHaveBeenCalled();
  expect(await response.text()).not.toContain("participantToken");
});
it("preserves test accounting while automatically expiring day and month offsets", () => {
  configured();
  vi.stubEnv("PRIOR_TEST_MONTH", "2026-11");
  vi.stubEnv("PRIOR_TEST_COST_MICRODOLLARS", "4500100");
  vi.stubEnv("PRIOR_TEST_DAY", "2026-11-09");
  vi.stubEnv("PRIOR_TEST_STARTS", "21");
  vi.stubEnv("PRIOR_TEST_VOICE_SECONDS", "3780");
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2026-11-09T23:59:59Z"));
    expect(config()).toMatchObject({
      MONTHLY_BUDGET_MICRODOLLARS: 6500100,
      MAX_GLOBAL_STARTS_PER_DAY: 31,
      MAX_DAILY_VOICE_SECONDS: 4680,
    });
    vi.setSystemTime(new Date("2026-11-10T00:00:00Z"));
    expect(config()).toMatchObject({
      MONTHLY_BUDGET_MICRODOLLARS: 6500100,
      MAX_GLOBAL_STARTS_PER_DAY: 10,
      MAX_DAILY_VOICE_SECONDS: 900,
    });
    vi.setSystemTime(new Date("2026-12-01T00:00:00Z"));
    expect(config()).toMatchObject({
      MONTHLY_BUDGET_MICRODOLLARS: 2000000,
      MAX_GLOBAL_STARTS_PER_DAY: 10,
      MAX_DAILY_VOICE_SECONDS: 900,
    });
    vi.stubEnv("PRIOR_TEST_COST_MICRODOLLARS", "-1");
    expect(() => config()).toThrow();
  } finally {
    vi.useRealTimers();
  }
});
