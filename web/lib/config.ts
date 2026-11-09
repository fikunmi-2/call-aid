import "server-only";
import { z } from "zod";
const integer = (fallback: number, max = 100000000) =>
  z.coerce.number().int().min(1).max(max).default(fallback);
const schema = z.object({
  APP_ORIGIN: z.url(),
  LIVEKIT_URL: z.url().refine((v) => v.startsWith("wss://")),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(20),
  LIVEKIT_AGENT_NAME: z.string().min(1).default("call-aid"),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SESSION_HMAC_SECRET: z.string().min(32),
  MAX_CALL_SECONDS: integer(180, 600),
  MAX_CONCURRENT_SESSIONS: integer(1, 5),
  MAX_STARTS_10_MINUTES: integer(2),
  MAX_STARTS_PER_DAY: integer(5),
  MAX_GLOBAL_STARTS_PER_DAY: integer(10),
  MAX_DAILY_VOICE_SECONDS: integer(900),
  MONTHLY_BUDGET_MICRODOLLARS: integer(2000000),
  RESERVED_COST_MICRODOLLARS: integer(150000),
});
export function config() {
  if (process.env.DEMO_ENABLED !== "true") throw new Error("disabled");
  const values = schema.parse(process.env);
  const unlimitedUsage =
    process.env.DEV_UNLIMITED_SESSIONS === "true" &&
    process.env.NODE_ENV === "development" &&
    process.env.VERCEL !== "1" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(values.APP_ORIGIN).hostname,
    );
  return { ...values, unlimitedUsage };
}
