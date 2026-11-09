# Milestone 3 — persistence and public records

Status: milestone 3 implemented and verified locally with real LiveKit/Supabase services on 2026-11-08. Hosted migration 003 was approved and applied. Stop before milestone 4; no authentication or deployment was added.

## Implementation

- Existing LiveKit admission, scoped microphone tokens, concurrency, duration, usage budgets and local testing overrides remain intact. A reviewed intake is frozen after SDK shutdown, then finalized through trusted Python code. Unprocessed final caller input prevents a completed record.
- `publication.py` enforces `public-1.0`: strict templates and codes, informative presenting concern, common categories, at most two associated symptoms, one background category and twelve total values. Unsupported/specific combinations or identifying/scope signals are withheld. Names, precise locations, transcripts and audio have no report fields. Location is not collected or inferred.
- One private `sbar_records` table stores approved JSONB linked to the original session. A unique session FK and locked SQL transaction make identical retries idempotent and reject conflicts. Case IDs stay stable. Completed and safe incomplete cases are supported; rejected cases retain only content-free bookkeeping.
- The model cannot set publication/saving flags. Draft schema 2.0 remains unsaved; SQL produces published schema 3.0, `publication: published`, `record_saved: true`, and saved recommendation wording in the same transaction as insertion. Python validates the confirmed response again. Unavailable writes never produce a successful record link.
- `/records` uses actual published-record statistics and recent cases; separately identified examples are excluded. `/records/[id]` renders formatted SBAR, missing information, simulated flags and prototype actions. Unknown/withheld/expired IDs are unavailable. No login is used.
- After disconnect/end, `/demo` polls the existing receipt-bound status route for about 45 seconds and offers a manual retry. It distinguishes pending, saved completed/incomplete, withheld and failed results. Only a confirmed case ID produces **View Generated Record**. Browser tokens still cannot publish arbitrary room data.
- Database fetches use no-store; records routes are dynamic; the dashboard refreshes every 15 seconds/on focus. Reads remain available with voice disabled. Public payloads contain generalized dates, not operational timestamps or session identifiers.
- Records expire after seven days. Reads hide expired data immediately. A bounded service-only cleanup function removes expired rows, clears old hashed buckets/receipts and preserves current-month budget accounting.

## Migration review and approval

The owner applied `202611080002_sbar_records.sql` while linking Supabase. A read-only comparison confirmed its original function contains an INSERT mismatch (four columns, three values). The applied migration is preserved. Correction **003** replaces that function and the simulated-marker count, with no reset or data deletion.

The hosted dry run listed only `202611080003_record_finalization_fix.sql`. After the owner's explicit approval, the CLI applied only that migration successfully. See [MIGRATION_REVIEW.md](supabase/MIGRATION_REVIEW.md) for the review and recorded approval. No hosted reset was performed.

Hosted read-only verification confirmed the private schema is not Data API exposed (`406 PGRST106`), records RLS is enabled, anonymous/authenticated table access is denied, anonymous finalization/read RPC execution is denied, and service-role finalization is granted. Both runtimes use narrow exposed-schema RPCs, not `.schema("private")` queries or anonymous grants. Secrets remain server-side.

## Checks so far

| Check | Result |
| --- | --- |
| Python pytest | 47 passed, including publication rejection, bounded retries, concurrent finalization, lost-response recovery and database failure |
| Web Vitest | 54 passed, including seven PostgreSQL migration/transaction/access tests, API projection/failure checks, saved/withheld/failed UI states and public page rendering |
| Desktop/mobile Playwright | 12 passed: offline examples, public navigation, unknown IDs, microphone denial and voice controls; additional actual saved-record/dashboard checks passed at 1280px and 390px |
| Python Ruff / web lint and TypeScript | Passed |
| Production build | Passed |
| New real voice → Supabase → public report | **Passed**, new case `b24de479-0742-4b02-8aa5-6ff8457b6eb6` |

Local tests use synthetic fixtures and a disposable PGlite PostgreSQL instance. They apply 001 → 002 → 003; no hosted reset was used. SQL output is runtime-validated using the published web contract. Probabilistic voice verification and real cloud persistence are separate from these deterministic tests.

## Real acceptance test

An actual Chromium browser with a synthetic microphone opened Call AId, started the named LiveKit agent, described a headache, answered a background follow-up, heard the recap, confirmed it and clicked End Session. Receipt-based polling exposed **View Generated Record** only after Supabase confirmation. Clicking it opened the saved SBAR detail, then the dashboard showed the same case. The public count increased from 5 to 6; curated examples were excluded. There were no browser page errors.

Saved JSON was independently checked: stable case ID, `schema_version: 3.0`, `workflow_version: intake-2.0`, `rules_version: demo-rules-1.0`, `publication_policy_version: public-1.0`, `status: completed`, `reviewed: true`, `publication: published`, `record_saved: true`, no missing required fields, and faithful reported onset `yesterday`. Recommendation text said the report was generated and saved; it did not claim temporary/unsaved status. Rendered HTML contained no private session fields. Screenshots of the actual report and dashboard were visually reviewed.

Final read-only checks on 2026-11-09 verified the real saved report returned HTTP 200 with no-store headers, an unknown valid UUID returned 404, and the saved report/dashboard had no horizontal overflow at desktop and mobile widths. Mobile and desktop screenshots were inspected. A hosted migration dry run returned `upToDate: true` with no pending migrations, seeds or role changes.

Earlier synthetic attempts exposed timing and speech-fixture limitations. Some volunteered facts/corrections were missed or could not be grounded, so the workflow asked follow-ups or repeated review. These calls were not forced to completed: five ended calls were saved as incomplete, including unreviewed cases, and uninformative cases were withheld. The browser harness was synchronized with assistant responses and used a stable virtual microphone. The final passing acceptance path did not require an extra correction; correction tests from milestone 2 remain in the regression suite. The official audio debugger separately verified repeated spoken turns and appropriate headache/onset questions with the current agent.

Six live synthetic records (one completed, five incomplete) were retained under normal seven-day expiry. No real patient information was used. This proves live cloud-service integration through local web/worker processes; it is not a Vercel or hosted-worker deployment test.

## Configuration and limits

No new application environment variables, dependencies or cloud services. Existing Supabase/LiveKit credentials are sufficient. CLI login/linking is separate local tooling configuration. Keep `private` out of exposed schemas and recording/transcript exports disabled. Restart the local worker after code changes; the current browser origin is `http://localhost:3001`.

Schedule or manually run `public.cleanup_demo_records()` through a trusted connection daily; it is not browser-accessible. Physical deletion needs that maintenance step, although expired cases disappear from public reads immediately.

Category extraction remains probabilistic; quote matching and recap review cannot prove clinical accuracy or fictional input. The publication policy deliberately withholds some useful but overly specific demonstrations. Identifier signals are additional rejection checks, not a de-identification guarantee. Model scope wording can still be repetitive. Worker/process loss can lose uncommitted in-memory information; polling must never turn an unconfirmed save into success. Public records can be copied despite `noindex` and later deletion.

Full hosted web/agent deployment, mobile hardware audio, exhaustive model safety/abuse testing and broader automation remain milestone 4/manual verification work. Stop before milestone 4.
