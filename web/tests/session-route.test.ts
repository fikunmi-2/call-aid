import { it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  AgentDispatchClient,
  RoomServiceClient,
  TokenVerifier,
} from "livekit-server-sdk";
import * as infrastructure from "@/lib/server";
import { POST } from "@/app/api/sessions/route";
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
it("an admitted request dispatches the configured agent and returns a scoped token and private receipt", async () => {
  configured();
  const rpc = vi
    .fn()
    .mockResolvedValue({
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
    rpc: vi
      .fn()
      .mockResolvedValue({
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
