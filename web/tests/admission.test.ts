import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
const db = new PGlite();
beforeAll(async () => {
  await db.exec(
    "create role anon; create role authenticated; create role service_role;",
  );
  await db.exec(
    readFileSync("../supabase/migrations/202611080001_sessions.sql", "utf8"),
  );
});
afterAll(async () => {
  await db.close();
});
async function reserve({
  network = "network",
  browser = randomUUID(),
  concurrency = 1,
  rate = 2,
  cost = 150000,
  budget = 2000000,
}: {
  network?: string;
  browser?: string;
  concurrency?: number;
  rate?: number;
  cost?: number;
  budget?: number;
} = {}) {
  const id = randomUUID();
  const result = await db.query<{ r: { allowed: boolean; reason?: string } }>(
    "select public.reserve_demo_session($1,$2,$3,$4,$5,$6,180,$7,$8,5,10,900,$9,$10) r",
    [
      id,
      `room-${id}`,
      `visitor-${id}`,
      `receipt-${id}`,
      network,
      browser,
      concurrency,
      rate,
      budget,
      cost,
    ],
  );
  return { id, ...result.rows[0].r };
}
describe("real PostgreSQL admission functions (PGlite)", () => {
  it("serializes admissions and enforces global concurrency", async () => {
    const results = await Promise.all([reserve(), reserve()]);
    expect(results.filter((r) => r.allowed)).toHaveLength(1);
    expect(results.find((r) => !r.allowed)?.reason).toBe("busy");
  });
  it("denies direct anon reads and RPC execution", async () => {
    await db.exec("set role anon");
    try {
      await expect(
        db.query("select * from private.demo_sessions"),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("select public.claim_demo_session('x')"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
  it("claims a reservation only once and never reopens a finished session", async () => {
    const rooms = await db.query<{ room_name: string }>(
      "select room_name from private.demo_sessions",
    );
    const room = rooms.rows[0].room_name;
    const first = await db.query<{ r: unknown }>(
      "select public.claim_demo_session($1) r",
      [room],
    );
    expect(first.rows[0].r).toBeTruthy();
    const second = await db.query<{ r: unknown }>(
      "select public.claim_demo_session($1) r",
      [room],
    );
    expect(second.rows[0].r).toBeNull();
    await db.query("select public.finish_demo_session($1,'aborted')", [room]);
    expect(
      (
        await db.query<{ r: unknown }>(
          "select public.claim_demo_session($1) r",
          [room],
        )
      ).rows[0].r,
    ).toBeNull();
  });
  it("retains cost reservations after failure and stops at the budget", async () => {
    await db.exec("update private.demo_sessions set status='failed'");
    expect((await reserve({ budget: 150000 })).allowed).toBe(false);
  });
  it("enforces rolling network limits after sessions end", async () => {
    await db.exec("delete from private.demo_sessions");
    expect((await reserve({ rate: 1 })).allowed).toBe(true);
    await db.exec("update private.demo_sessions set status='aborted'");
    expect((await reserve({ rate: 1 })).reason).toBe("limit");
  });
  it("rejects invalid control values", async () => {
    await expect(reserve({ concurrency: 0 })).rejects.toThrow(/invalid limits/);
  });
});
