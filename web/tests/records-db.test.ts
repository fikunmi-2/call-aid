import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { parsePublishedReport } from "@/lib/intake-report";

const db = new PGlite();
const fixture = JSON.parse(
  readFileSync("../contracts/fixtures/completed.json", "utf8"),
);
beforeAll(async () => {
  await db.exec(
    "create role anon; create role authenticated; create role service_role;",
  );
  for (const file of [
    "202611080001_sessions.sql",
    "202611080002_sbar_records.sql",
    "202611080003_record_finalization_fix.sql",
    "202611090004_save_before_closing.sql",
  ])
    await db.exec(readFileSync(`../supabase/migrations/${file}`, "utf8"));
});
afterAll(() => db.close());
async function session() {
  const id = randomUUID(),
    room = `synthetic-${id}`;
  await db.query(
    "insert into private.demo_sessions(id,room_name,participant_identity,receipt_hash,status,started_at,expires_at,call_seconds,reserved_seconds,reserved_cost_units) values($1::uuid,$2,'synthetic-visitor',$1::text,'active',now(),now()+interval '4 minutes',180,180,100)",
    [id, room],
  );
  const payload = structuredClone(fixture);
  payload.case_id = randomUUID();
  payload.demonstration_label = `Demo Case ${payload.case_id.slice(0, 6).toUpperCase()}`;
  return { id, room, payload };
}
async function finalize(
  room: string,
  payload: unknown,
  decision = "published",
  reason: string | null = null,
) {
  return (
    await db.query<{ r: { publication: string; record?: typeof fixture } }>(
      "select public.finalize_demo_record($1,$2::jsonb,$3,$4) r",
      [
        room,
        payload === null ? null : JSON.stringify(payload),
        decision,
        reason,
      ],
    )
  ).rows[0].r;
}
describe("trusted record transactions on PostgreSQL", () => {
  it("persists once, derives saved text/dates and returns identical retries", async () => {
    const s = await session();
    const a = await finalize(s.room, s.payload),
      b = await finalize(s.room, s.payload);
    expect(a).toEqual(b);
    expect(a.publication).toBe("published");
    expect(a.record.recommendation.record_saved).toBe(true);
    expect(parsePublishedReport(a.record)).not.toBeNull();
    expect(a.record.recommendation.text).toContain("generated and saved");
    expect(a.record.recommendation.text).not.toContain("temporary");
    expect(
      (
        await db.query(
          "select * from private.sbar_records where session_id=$1",
          [s.id],
        )
      ).rows,
    ).toHaveLength(1);
    const receipt = (
      await db.query<{ r: { case_id: string; publication: string } }>(
        "select public.demo_session_receipt($1) r",
        [s.id],
      )
    ).rows[0].r;
    expect(receipt.case_id).toBe(s.payload.case_id);
    expect(receipt.publication).toBe("published");
    await db.query("select public.finish_demo_session($1,'aborted')", [s.room]);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from private.demo_sessions where id=$1",
          [s.id],
        )
      ).rows[0].status,
    ).toBe("completed");
    expect(
      (await finalize(s.room, null, "failed", "save_unavailable")).publication,
    ).toBe("published");
    const changed = structuredClone(s.payload);
    changed.reviewed = false;
    await expect(finalize(s.room, changed)).rejects.toThrow(/conflicting/);
  });
  it("links incomplete and disconnect-finalized cases without inventing completion", async () => {
    const s = await session();
    s.payload.status = "incomplete";
    s.payload.reviewed = false;
    s.payload.recommendation.actions = ["recap_prepared", "session_incomplete"];
    await db.query("select public.finish_demo_session($1,'aborted')", [s.room]);
    const result = await finalize(s.room, s.payload);
    expect(result.record.status).toBe("incomplete");
    expect(result.record.reviewed).toBe(false);
  });
  it("withheld and failed attempts do not create public records", async () => {
    for (const decision of ["withheld", "failed"]) {
      const s = await session();
      await finalize(
        s.room,
        null,
        decision,
        decision === "withheld"
          ? "privacy_or_scope"
          : "save_unavailable",
      );
      expect(
        (
          await db.query(
            "select id from private.sbar_records where session_id=$1",
            [s.id],
          )
        ).rows,
      ).toHaveLength(0);
      if (decision === "withheld")
        await expect(finalize(s.room, s.payload)).rejects.toThrow(
          /unavailable/,
        );
    }
  });
  it("rejects unclaimed/late/invalid cases and rolls back without success state", async () => {
    const s = await session();
    await db.query(
      "update private.demo_sessions set started_at=null where id=$1",
      [s.id],
    );
    await expect(finalize(s.room, s.payload)).rejects.toThrow(/unclaimed/);
    await db.query(
      "update private.demo_sessions set started_at=now(),expires_at=now()-interval '30 seconds' where id=$1",
      [s.id],
    );
    await expect(finalize(s.room, s.payload)).rejects.toThrow(/unavailable/);
    await db.query(
      "update private.demo_sessions set expires_at=now()+interval '1 minute' where id=$1",
      [s.id],
    );
    s.payload.transcript = "unrestricted text";
    await expect(finalize(s.room, s.payload)).rejects.toThrow(/projection/);
    expect(
      (
        await db.query<{ publication_status: string }>(
          "select publication_status from private.demo_sessions where id=$1",
          [s.id],
        )
      ).rows[0].publication_status,
    ).toBe("pending");
  });
  it("public DTOs exclude operational columns; expiry filters immediately and cleanup retains accounting", async () => {
    const s = await session();
    await finalize(s.room, s.payload);
    const read = async () =>
      (
        await db.query<{
          r: { records: unknown[]; stats: { total: number; flagged: number } };
        }>("select public.read_demo_records($1,0,20) r", [s.payload.case_id])
      ).rows[0].r;
    const before = await read();
    expect(before.records).toHaveLength(1);
    expect(JSON.stringify(before)).not.toMatch(
      /room_name|session_id|receipt|participant_identity/,
    );
    expect(before.stats.flagged).toBeGreaterThan(0);
    await db.query(
      "update private.sbar_records set expires_at=now()-interval '1 second' where session_id=$1",
      [s.id],
    );
    expect((await read()).records).toHaveLength(0);
    await db.query("select public.cleanup_demo_records()");
    expect(
      (
        await db.query("select id from private.demo_sessions where id=$1", [
          s.id,
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it("denies direct anonymous/authenticated reads and writes and every privileged RPC", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      try {
        for (const statement of [
          "select * from private.sbar_records",
          "insert into private.sbar_records default values",
          "update private.sbar_records set status='completed'",
          "delete from private.sbar_records",
          "select public.finalize_demo_record('x',null,'failed','save_unavailable')",
          "select public.save_demo_record_for_closing('x',null,'failed','save_unavailable')",
          "select public.read_demo_records()",
          "select public.cleanup_demo_records()",
          "select public.demo_session_receipt('x')",
        ])
          await expect(db.query(statement)).rejects.toThrow(
            /permission denied/,
          );
      } finally {
        await db.exec("reset role");
      }
    }
  });
  it("allows the service role to read only through the trusted RPC", async () => {
    await db.exec("set role service_role");
    try {
      expect(
        (await db.query("select public.read_demo_records()")).rows,
      ).toHaveLength(1);
      await expect(
        db.query("select * from private.sbar_records"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
  it("holds capacity through a saved closing and releases it only after room shutdown", async () => {
    await db.exec(
      "update private.demo_sessions set status='aborted' where status in ('active','reserved')",
    );
    const s = await session();
    const saved = await db.query<{ r: { publication: string } }>(
      "select public.save_demo_record_for_closing($1,$2::jsonb,'published',null) r",
      [s.room, JSON.stringify(s.payload)],
    );
    expect(saved.rows[0].r.publication).toBe("published");
    const held = await db.query<{ status: string; ended_at: unknown }>(
      "select status,ended_at from private.demo_sessions where id=$1",
      [s.id],
    );
    expect(held.rows[0]).toEqual({ status: "active", ended_at: null });
    const id = randomUUID();
    const reserve = async () =>
      (
        await db.query<{ r: { allowed: boolean; reason?: string } }>(
          "select public.reserve_demo_session($1::uuid,$2,'visitor','receipt','network',$1::text,180,1,null,null,null,null,null,100) r",
          [id, `room-${id}`],
        )
      ).rows[0].r;
    expect(await reserve()).toEqual({ allowed: false, reason: "busy" });
    await db.query("select public.finish_demo_session($1,'aborted')", [s.room]);
    expect(
      (
        await db.query<{ status: string }>(
          "select status from private.demo_sessions where id=$1",
          [s.id],
        )
      ).rows[0].status,
    ).toBe("completed");
    await db.query(
      "select public.save_demo_record_for_closing($1,$2::jsonb,'published',null)",
      [s.room, JSON.stringify(s.payload)],
    );
    expect(
      (
        await db.query<{ status: string }>(
          "select status from private.demo_sessions where id=$1",
          [s.id],
        )
      ).rows[0].status,
    ).toBe("completed");
    expect((await reserve()).allowed).toBe(true);
  });
  it("saves rich projected SBAR JSON and returns it through the public read operation", async () => {
    const s = await session();
    const projected = JSON.parse(
      readFileSync("../contracts/fixtures/projected.json", "utf8"),
    );
    projected.case_id = s.payload.case_id;
    projected.demonstration_label = s.payload.demonstration_label;
    const result = await finalize(s.room, projected);
    const report = parsePublishedReport(result.record);
    expect(report).not.toBeNull();
    expect(report?.status).toBe("completed");
    expect(
      report?.background.facts.find((f) => f.field === "associated_symptoms")
        ?.values,
    ).toHaveLength(4);
    expect(
      report?.background.facts.find((f) => f.field === "background")?.values,
    ).toHaveLength(5);
    expect(report?.assessment.public_data_handling?.details_omitted).toBe(true);
    expect(report?.recommendation.record_saved).toBe(true);
    expect(await finalize(s.room, projected)).toEqual(result);
    const read = await db.query<{ r: { records: unknown[] } }>(
      "select public.read_demo_records($1,0,20) r",
      [s.payload.case_id],
    );
    expect(read.rows[0].r.records).toEqual([result.record]);
  });
});
