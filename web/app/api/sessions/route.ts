import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk";
import { config } from "@/lib/config";
import {
  database,
  bucket,
  hash,
  sameOrigin,
  privateHeaders,
} from "@/lib/server";
import { token } from "@/lib/tokens";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  if (!sameOrigin(req))
    return NextResponse.json(
      { error: "Request origin is not allowed." },
      { status: 403, headers: privateHeaders },
    );
  // This endpoint accepts no body; no browser-provided identity or room configuration.
  if (req.body) {
    const reader = req.body.getReader();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const first = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("body timeout")), 2000);
        }),
      ]);
      // Next.js can supply a stream even for an empty POST. Read only one chunk.
      if (!first.done) throw new Error("body not empty");
    } catch {
      return NextResponse.json(
        { error: "No request body is accepted." },
        { status: 400, headers: privateHeaders },
      );
    } finally {
      clearTimeout(timeout);
      void reader.cancel().catch(() => {});
    }
  }
  let c: ReturnType<typeof config>;
  try {
    c = config();
  } catch {
    return NextResponse.json(
      {
        error:
          "Voice is temporarily unavailable. You can still explore the synthetic example reports.",
      },
      { status: 503, headers: privateHeaders },
    );
  }
  const browser =
    req.cookies.get("callaid-browser")?.value?.match(/^[a-f0-9]{64}$/)?.[0] ||
    randomBytes(32).toString("hex");
  // Only Vercel's overwritten header is trusted in production. Local dev shares one bucket.
  const network =
    process.env.VERCEL === "1"
      ? req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
      : "local-development";
  if (!network)
    return NextResponse.json(
      { error: "Voice is temporarily unavailable." },
      { status: 503, headers: privateHeaders },
    );
  const id = randomUUID(),
    room = `callaid-${id}`,
    identity = `visitor-${randomUUID()}`,
    receipt = randomBytes(32).toString("hex");
  const db = database(c);
  try {
    const { data, error } = await db.rpc("reserve_demo_session", {
      p_id: id,
      p_room: room,
      p_identity: identity,
      p_receipt: hash(receipt),
      p_network: bucket(c.SESSION_HMAC_SECRET, network),
      p_browser: bucket(c.SESSION_HMAC_SECRET, browser),
      p_call_seconds: c.MAX_CALL_SECONDS,
      p_concurrency: c.MAX_CONCURRENT_SESSIONS,
      // NULL disables these cumulative checks in the existing service-only RPC.
      // Config permits this only for an explicitly enabled localhost dev server.
      p_rate: c.unlimitedUsage ? null : c.MAX_STARTS_10_MINUTES,
      p_daily: c.unlimitedUsage ? null : c.MAX_STARTS_PER_DAY,
      p_global_daily: c.unlimitedUsage ? null : c.MAX_GLOBAL_STARTS_PER_DAY,
      p_daily_seconds: c.unlimitedUsage ? null : c.MAX_DAILY_VOICE_SECONDS,
      p_monthly_budget: c.unlimitedUsage ? null : c.MONTHLY_BUDGET_MICRODOLLARS,
      p_cost: c.RESERVED_COST_MICRODOLLARS,
    });
    if (error) throw new Error("database");
    if (!data.allowed)
      return NextResponse.json(
        {
          error:
            data.reason === "busy"
              ? "The demo is in use. Please try again shortly."
              : "The demonstration usage limit has been reached. Please explore an example report.",
        },
        { status: 429, headers: { ...privateHeaders, "Retry-After": "60" } },
      );
    const service = new RoomServiceClient(
      c.LIVEKIT_URL,
      c.LIVEKIT_API_KEY,
      c.LIVEKIT_API_SECRET,
    );
    await service.createRoom({
      name: room,
      maxParticipants: 2,
      emptyTimeout: 45,
      departureTimeout: 5,
    });
    await new AgentDispatchClient(
      c.LIVEKIT_URL,
      c.LIVEKIT_API_KEY,
      c.LIVEKIT_API_SECRET,
    ).createDispatch(room, c.LIVEKIT_AGENT_NAME);
    const response = NextResponse.json(
      {
        serverUrl: c.LIVEKIT_URL,
        participantToken: await token(
          c.LIVEKIT_API_KEY,
          c.LIVEKIT_API_SECRET,
          room,
          identity,
        ),
        expiresAt: data.expires_at,
        maxCallSeconds: c.MAX_CALL_SECONDS,
      },
      { headers: privateHeaders },
    );
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
      path: "/",
    };
    response.cookies.set("callaid-browser", browser, {
      ...options,
      maxAge: 86400,
    });
    response.cookies.set("callaid-receipt", receipt, {
      ...options,
      maxAge: 600,
    });
    return response;
  } catch {
    // Keep the reservation until its deadline if room deletion is uncertain.
    try {
      await new RoomServiceClient(
        c.LIVEKIT_URL,
        c.LIVEKIT_API_KEY,
        c.LIVEKIT_API_SECRET,
      ).deleteRoom(room);
      await db.rpc("finish_demo_session", { p_room: room, p_status: "failed" });
    } catch {}
    return NextResponse.json(
      {
        error:
          "The voice service could not start. Please try later or view an example report.",
      },
      { status: 503, headers: privateHeaders },
    );
  }
}
