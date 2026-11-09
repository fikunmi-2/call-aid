import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac } from "node:crypto";
import { databaseConfig } from "./config";
import type { RoomServiceClient } from "livekit-server-sdk";
export async function deleteRoom(service: RoomServiceClient, room: string) {
  try {
    await service.deleteRoom(room);
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "not_found"
    )
      throw error;
  }
}
export function database(c: ReturnType<typeof databaseConfig>) {
  return createClient(c.SUPABASE_URL, c.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url, options) =>
        fetch(url, {
          ...options,
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        }),
    },
  });
}
export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function bucket(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (
    origin === new URL(process.env.APP_ORIGIN || "http://localhost:3000").origin
  )
    return true;
  // Preview URLs change on every deploy. Accept only Vercel-provided hosts,
  // never caller-supplied Host/forwarding headers; production stays canonical.
  return (
    process.env.VERCEL === "1" &&
    process.env.VERCEL_ENV === "preview" &&
    [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].some(
      (host) => host && origin === `https://${host}`,
    )
  );
}
export const privateHeaders = { "Cache-Control": "no-store" };
