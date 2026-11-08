import { describe, it, expect, afterEach, vi } from "vitest";
import { TokenVerifier } from "livekit-server-sdk";
import { NextRequest } from "next/server";
import { token } from "@/lib/tokens";
import { POST } from "@/app/api/sessions/route";
import { GET } from "@/app/api/sessions/status/route";
import { deleteRoom } from "@/lib/server";
import type { RoomServiceClient } from "livekit-server-sdk";
it("already-closed rooms permit cleanup, while uncertain shutdown is not treated as success", async () => {
  const gone = {
    deleteRoom: vi.fn().mockRejectedValue({ code: "not_found" }),
  } as unknown as RoomServiceClient;
  await expect(deleteRoom(gone, "synthetic-room")).resolves.toBeUndefined();
  const uncertain = {
    deleteRoom: vi.fn().mockRejectedValue({ code: "unavailable" }),
  } as unknown as RoomServiceClient;
  await expect(deleteRoom(uncertain, "synthetic-room")).rejects.toMatchObject({
    code: "unavailable",
  });
});
describe("public session boundaries", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("issues microphone-only room-scoped tokens with a short lifetime", async () => {
    const secret = "test-secret-that-is-at-least-32-bytes";
    const jwt = await token("test-key", secret, "test-room", "test-visitor");
    const claims = await new TokenVerifier("test-key", secret).verify(jwt);
    expect(claims.sub).toBe("test-visitor");
    expect(claims.video).toMatchObject({
      room: "test-room",
      roomJoin: true,
      canPublish: true,
      canPublishData: false,
      canUpdateOwnMetadata: false,
      canPublishSources: ["microphone"],
    });
    expect(claims.video?.roomAdmin).not.toBe(true);
    expect(claims.exp! - claims.nbf!).toBeLessThanOrEqual(60);
  });
  it("rejects other origins even while disabled", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/sessions", {
        method: "POST",
        headers: { origin: "https://untrusted.example" },
      }),
    );
    expect(response.status).toBe(403);
  });
  it("rejects caller-provided room configuration", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/sessions", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: '{"room":"attacker"}',
      }),
    );
    expect(response.status).toBe(400);
  });
  it("fails closed without configuration and does not leak secrets", async () => {
    vi.stubEnv("DEMO_ENABLED", "false");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/sessions", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toMatch(/secret|stack|supabase/i);
  });
  it("returns no operational state without a valid receipt", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/api/sessions/status"),
    );
    expect(await response.json()).toEqual({ status: "unavailable" });
  });
});
