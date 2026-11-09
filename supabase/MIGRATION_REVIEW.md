# Milestone 3 migration review

The owner applied `202611080002_sbar_records.sql` during CLI setup. Its original statements are preserved in this repository; applied history must not be rewritten. It adds the private JSONB records table and service-only finalization/read/cleanup functions, with publication bookkeeping on existing sessions. The existing admission function is unchanged.

Local transaction tests found that the applied finalizer's INSERT lists four columns but supplies three expressions. Saving a published case therefore fails. A separate migration, **`202611080003_record_finalization_fix.sql`**, supplies the missing status value and updates the dashboard count to include incomplete-session simulated markers. It replaces two functions, preserves privileges, and notifies the Data API to refresh its schema. It performs no resets, data deletion, table replacement or new anonymous grants.

Read-only hosted dry run on 2026-11-08, targeting the linked `call-aid-dev` project:

```text
DRY RUN: migrations will not be pushed to the database.
Would push these migrations:
 • 202611080003_record_finalization_fix.sql
upToDate: false
dryRun: true
seeds: []
roles: []
```

The current hosted Data API rejects the `private` profile with `406 PGRST106`; only the `public` schema is exposed. The existing service-only session RPC works. New code therefore uses explicitly granted `public` RPCs to reach private tables, rather than requesting a non-exposed schema or granting table access. API credentials remain server-side.

Disposable local PostgreSQL tests apply migrations 001 → 002 → 003, then exercise successful save, idempotency, conflicting retries, incomplete cases, withheld/failure states, expired sessions, retention, public projection and denied anonymous/authenticated access. Published SQL output is also validated by the web contract.

**Approved and applied:** the owner explicitly approved migration 003. `pnpm dlx supabase@3.0.0 db push --remote --yes` applied only `202611080003_record_finalization_fix.sql` successfully on 2026-11-08. No reset, seed or role changes were performed. CLI credentials are local tooling credentials; application env files need no new keys.
