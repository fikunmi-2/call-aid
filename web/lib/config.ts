import "server-only";
import { z } from "zod";
const integer = (fallback: number, max = 100000000) =>
  z.coerce.number().int().min(1).max(max).default(fallback);
const priorTotal = z.coerce.number().int().min(0).max(100000000).default(0);
export function databaseConfig() {
  return z
    .object({ SUPABASE_URL: z.url(), SUPABASE_SECRET_KEY: z.string().min(1) })
    .parse(process.env);
}
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
  PRIOR_TEST_MONTH: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  PRIOR_TEST_COST_MICRODOLLARS: priorTotal,
  PRIOR_TEST_DAY: z.iso.date().optional(),
  PRIOR_TEST_STARTS: priorTotal,
  PRIOR_TEST_VOICE_SECONDS: priorTotal,
});
export function config() {
  if (process.env.DEMO_ENABLED !== "true") throw new Error("disabled");
  const values = schema.parse(process.env);
  // Preserve historical reservations without consuming a fresh release allowance.
  // Server-configured, verified test totals apply only to their UTC period;
  // they automatically expire rather than increasing future free-tier budgets.
  const today = new Date().toISOString().slice(0, 10);
  if (values.PRIOR_TEST_MONTH === today.slice(0, 7))
    values.MONTHLY_BUDGET_MICRODOLLARS += values.PRIOR_TEST_COST_MICRODOLLARS;
  if (values.PRIOR_TEST_DAY === today) {
    values.MAX_GLOBAL_STARTS_PER_DAY += values.PRIOR_TEST_STARTS;
    values.MAX_DAILY_VOICE_SECONDS += values.PRIOR_TEST_VOICE_SECONDS;
  }
  const unlimitedUsage =
    process.env.DEV_UNLIMITED_SESSIONS === "true" &&
    process.env.NODE_ENV === "development" &&
    process.env.VERCEL !== "1" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(values.APP_ORIGIN).hostname,
    );
  return { ...values, unlimitedUsage };
}
