# Call AId project plan

Status: architecture approved; milestones 1–3 implemented locally, 2026-11-08. See [Milestone 1](MILESTONE_1_REPORT.md), [Milestone 2](MILESTONE_2_REPORT.md) and [Milestone 3](MILESTONE_3_REPORT.md) for results and limitations. Milestone 3's real voice-to-Supabase-to-public-report test passed. Stop before milestone 4; deployment and wider verification require approval.

## Repository and revised scope

The original inspection found an empty initialized repository. The workspace now contains independently managed web/agent projects, generated contracts, targeted tests, and three Supabase migrations. LiveKit and Supabase are configured locally; the public records console reads only sanitized published DTOs. README documents tools, pinned starters, setup and remaining deployment work.

Call AId is a publicly shareable browser research prototype for rural Saskatchewan. There is no login, signup, invited account, user ownership, mandatory scenario selection or acknowledgement form. A visitor clicks **Start Voice Session**, grants the browser's microphone permission, and speaks naturally. Starting a call remains subject to capacity and credit limits, with clear availability messages.

| Route | Required behavior |
| --- | --- |
| `/` | Public landing page, disclaimer, Start Voice Session, records link |
| `/demo` | Public voice conversation, microphone/mute/end controls, status and result link |
| `/records` | Public recent demonstration records, reported symptoms, simulated flags and SBAR previews |
| `/records/[id]` | Public formatted SBAR report for a sanitized, published case |

The records console is a core milestone 3 deliverable. Successful finalization leads directly to the generated report. If publication is withheld or saving fails, show that outcome instead of a report link or false success message.

## Safety and public data boundary

Display **Not for medical use** prominently on all four routes and in the agent opening. Explain that this is a research prototype and ask visitors to use made-up symptoms and context, without real personal or medical information. Place the warning beside the start button and in the conversation; no blocking acknowledgement form. Do not solicit names, contact details, health identifiers, exact ages/birth dates, addresses or precise locations.

The agent asks relevant follow-ups about reported symptoms, onset, duration and context within a bounded demonstration workflow. It must not diagnose, prescribe, recommend avoiding medical care, or claim validated triage. Screening flags are explicitly simulated rule matches, not clinical urgency or clearance. No flags means only that no configured demonstration rule matched. Recommendation content is limited to actions performed by the demonstration and approved general information. No independent treatment advice, clinical referrals, telephone/SIP integration or live 911 functionality. Disable camera, screen sharing and audio recording.

Accept ordinary fictional symptom descriptions naturally; do not end a conversation merely because symptoms could be real. Keep the disclaimer and refuse actual requests for diagnosis, treatment or other clinical advice using a fixed non-medical response. Do not claim to reliably distinguish fictional from real medical information. If identifiers are volunteered, ask the visitor to omit them and exclude them from all public output; withhold any case whose publication safety cannot be established. All fixtures, automated tests, screenshots and examples use synthetic data.

### Publication is separate from intake

1. Keep transcripts and source evidence only in the Python worker's memory during the call and a short bounded finalization period. Do not store audio or raw transcripts in Supabase, browser storage, analytics, logs or traces. Disable starter recording and transcript observability exports where configurable; verify service processing/retention settings before sharing a link. Cloud audio processing still occurs; do not claim Canadian residency or that data never leaves the browser.
2. Extract into strict Pydantic models with transient source references. Reject unexpected fields. Unknown/declined values stay unknown, never inferred as negative. Clarify contradictions conversationally when practical; never fill gaps with invented facts.
3. Generate a **separate public projection** using approved symptom categories, coarse onset/duration/severity bands, bounded context categories, simulated rule codes and template-based SBAR wording. Do not copy arbitrary free text, raw quotations or hidden narrative fields into published JSON. Preserve all approved categories without symptom-count, background-count or combination rejection rules. Represent specific details only through faithful broad categories; otherwise leave them unknown. Indicate generalized/omitted details in constrained report metadata.
4. Optional patient labels are server-generated, such as `Demo Case A7K2`, never spoken names or user-supplied pseudonyms. Location is null by default; emit only a broad approved region when supplied and safely generalizable. Never infer it from IP or publish small communities, facilities, addresses, postal codes or coordinates. Omit rather than misrepresent a location.
5. A deterministic publication validator checks the constrained schema, approved templates, grounding and finalization state. Publish reduced or incomplete reports containing only safe categorical information and explicit unknowns; identifiers in a source do not invalidate unrelated safe categories. Never use original text as a fallback. Invalid application/schema/session state or database failure prevents a success claim and retains only a content-free failure code. The constrained projection reduces disclosure risk but cannot prove anonymity.
6. Public pages/APIs expose only the accepted DTO, without session IDs, room names, receipts, network buckets, raw evidence or precise operational timestamps. Public timestamps are generalized date buckets and labeled accordingly. Escape all rendered content; no model-supplied HTML. Use `noindex` as defense in depth, while explaining that public records can be copied and crawler exclusion is not access control.

Reports must remain clinically recognizable and informative: approved deterministic SBAR templates should preserve validated, generalized patient-reported details while clearly separating reported facts, unknowns, simulated flags and prototype actions. A detector finding no identifiers is insufficient to authorize publication. Do not publish unrestricted AI-generated narratives.

## Simplified architecture

One repository, two independently managed projects: `web/` and `agent/`. Reuse the current official LiveKit React/Next.js and Python starters, record upstream commits and preserve licenses. Read their `AGENTS.md` files. Install/read the official project-local LiveKit Codex Agent Skills in milestone 1; their availability has been verified in official documentation, but no skills are installed by this planning task.

- **Next.js on Vercel:** public pages, server-side token issuance, admission checks and bounded status/record reads. No Supabase Auth or account machinery. Credentials stay in server-only modules/environment variables.
- **LiveKit Cloud:** WebRTC audio, named agent dispatch, Inference realtime speech model and Python worker hosting. Replace sample-agent defaults and unrestricted development token services.
- **Python LiveKit Agents SDK:** guided intake, Pydantic extraction, deterministic screening, grounded SBAR assembly, publication checks and trusted finalization. Core workflow/rules remain plain Python independent of SDK callbacks.
- **Supabase PostgreSQL:** two tables for private operational sessions and finalized sanitized records. Reuse the same database for shared admission accounting; no Redis, separate API server, queue, vector database, identity service or transcript/evidence tables.

### Session flow

1. Start sends a same-origin POST to a Next.js session endpoint. Validate request shape/size. Accept no arbitrary room, participant identity or agent name from the browser. Origin checks help against browser misuse but are neither authentication nor sufficient abuse protection.
2. Atomically reserve capacity and usage budget in PostgreSQL. Generate random session, room and participant IDs server-side. Mint a short-lived token scoped to that room/identity with audio publish and required subscriptions, without room administration. No user form is required.
3. Dispatch the Python agent. It resolves the trusted room/session mapping, reservation and absolute deadline from server state. Refuse unreserved/expired jobs. Client metadata and model tools cannot authorize writes or extend deadlines. Enforce the intended visitor-plus-agent room membership.
4. Ask one relevant question at a time, using conditional follow-ups within allowed intake topics rather than a selected scenario or rigid universal questionnaire. Python governs tools, state transitions, required/optional fields, stop conditions and maximum turns. Pure screening rules consume validated values; the model cannot choose clinical urgency or flags.
5. At completion or End Session, run bounded finalization on collected content: assemble SBAR, check meaning against transient sources, sanitize and apply the publication gate. Persist only accepted sanitized JSON atomically. A safe partial record may be published with `status: incomplete` and explicit unknowns. Disconnects must never become completed cases; unsafe partials are withheld.
6. Emit only public case ID/status on success and show **View demonstration record**. A bounded status poll handles missed events/disconnects. Issue a random session receipt automatically in an HttpOnly cookie and store only its hash. It permits that browser to query content-free operational status; it is not a user account and does not restrict public report access. Never include it in URLs or public JSON.
7. Public records pages use paginated server-side queries and an explicit DTO. Pending, withheld and failed cases are absent; guessed IDs return a generic unavailable/404 response. No operational sessions or rejected content are exposed. Apply separate public read request limits.

Use a currently supported **LiveKit Inference native realtime voice model**. In milestone 1 compare supported models for cost, tools, transcript events and installed SDK compatibility; pin a tested model ID in configuration. Begin with that model's validated tools for extraction and assemble SBAR from structured values/templates. Add one bounded Inference text-model finalization call only if tests demonstrate a need, within the same budget. Avoid a separate STT/LLM/TTS pipeline or direct provider integration unless required.

## SBAR contract

Pydantic is canonical; generate JSON Schema and frontend types from it. Validate network JSON at runtime; TypeScript types are insufficient. Persist the public projection, not the richer in-memory extraction state.

| Section | Public JSON content |
| --- | --- |
| Metadata | Random case ID; schema/workflow/rules/publication-policy versions; generalized start/end/created timestamps; completed/incomplete status; optional generated demonstration label and safe broad community region |
| Situation | Generalized user-reported chief complaint and presenting concern; unknown when not supplied |
| Background | Supplied symptom categories, broad onset/duration, associated symptoms, safely generalized reported history/context; no inferred negatives |
| Assessment | Structured observations labeled as user-reported, missing information and deterministic simulated flags; fixed “not a clinical diagnosis or validated triage” label |
| Recommendation | Demonstration action codes such as `summary_generated` or `session_ended_incomplete`, plus optional approved general-information IDs/text from a versioned local catalog; no independently generated treatment advice |

Values carry known/unknown/declined state where appropriate. Transient evidence references must point to this session's statements and support the asserted meaning; ID existence alone is not semantic grounding. Do not publish raw evidence snippets. Explain that reports are sanitized demonstrations, not verbatim clinical records. Unsupported content is omitted or causes withholding, never fabricated.

## Database: two tables

Logical proposal only; migrations arrive during implementation. Exact operational timestamps use UTC `timestamptz`. Public date buckets display in `America/Regina` and are explicitly generalized.

| Table | Main columns | Constraints and visibility |
| --- | --- | --- |
| `demo_sessions` | `id uuid PK`, `room_name text UNIQUE`, `participant_identity text`, `receipt_hash text`, `status text`, `publication_status text`, `created_at`, `started_at`, `ended_at`, `expires_at`, `network_bucket text NULL`, `browser_bucket text NULL`, `reserved_seconds integer`, `reserved_cost_units integer`, `failure_code text NULL` | Private bookkeeping only. Session status: reserved/active/completed/incomplete/aborted/failed/expired. Publication status: pending/published/withheld/failed. No symptoms, real identifiers, transcript or location. Valid-state/nonnegative-budget checks; indexes on active deadlines and rate/budget windows. |
| `sbar_records` | `id uuid PK`, `session_id uuid UNIQUE FK demo_sessions`, `status text CHECK` (completed/incomplete), `public_payload jsonb`, `published_at timestamptz`, `expires_at timestamptz` | Sanitized finalized records only. One case per session. SQL checks essential JSON shape/status/version fields; strict Python publication validation precedes insertion. Public projection excludes session ID and precise internal publication time. |

Put both tables in a non-exposed schema, enable RLS without anonymous/browser policies, and revoke browser/anon table and function grants. Public presentation goes through Next.js; it does not require public database access. No direct browser INSERT/UPDATE/DELETE, RPC write or raw-table read path.

For simplicity, use server-only Supabase secret/service credentials and client SDKs for narrow trusted functions/queries rather than a custom role hierarchy or separate database API. These credentials bypass RLS: the backend and SQL functions must enforce admission/publication rules themselves. RLS is not protection against a compromised privileged server. Fix SQL function `search_path`, revoke PUBLIC execution and accept no browser-provided SBAR for publication. Server reads return an explicit public projection, never raw `select *` results.

Atomic operations:

- **Reserve:** serialize shared admission checks, ignore expired leases, verify rate/concurrency/budget limits and insert the reservation before issuing a token. Fail closed if the database is unavailable. Vercel process-local counters are insufficient.
- **Lifecycle:** compare-and-set legal state transitions. Allow bounded cold-start grace without extending the hard absolute deadline. Expire stale sessions on admission/status operations; correctness does not depend on a scheduler.
- **Finalize:** lock the session, validate permitted transitions and deadline, insert one accepted record and update publication state in one transaction. Repeated identical retries return the existing case ID; conflicting payloads are rejected. Late disconnect events cannot downgrade completed sessions. Cap finalization time/retries/cost.
- **Failure:** save content-free status/reason only. Show record unavailable/not saved/not published accurately. No durable retry queue of raw content. Worker failure before saving leaves no public record.

Retention: publish sanitized records for seven days; filter expired rows immediately, then delete via bounded scheduled Supabase cleanup or a trusted maintenance command. Retain only content-free session accounting through the current UTC billing month, deleting it shortly after rollover, so seven-day record cleanup cannot reset the monthly budget. Clear receipt and keyed network/browser bucket hashes after their short operational window (proposed 48 hours); never store raw IPs. Delete expired records before their referenced sessions. Treat hashes as private operational data and minimize identifying metadata in hosting logs. No extra accounting table is needed.

## Cost and access controls

Target LiveKit's free **Build** plan where possible. Current sources list $2.50 monthly Inference credits, 1,000 agent-session minutes and up to five concurrent hosted agent sessions. Inference and hosting allowances are separate; credits may run out well before hosting minutes. Build allowances are hard caps shared across a user's free projects; exhausted allowance causes requests to fail rather than overage charges. Recheck project entitlements/prices before deployment. Build agents can cold-start with a 10–20 second delay, so show a connecting state. Use one hosted agent and a Vercel preview initially rather than paid non-production deployment slots. [Pricing](https://livekit.com/pricing), [quotas](https://docs.livekit.io/deploy/admin/quotas-and-limits/), [deployment management](https://docs.livekit.io/deploy/agents/managing-deployments/).

Proposed configurable initial controls:

| Control | Initial limit |
| --- | --- |
| Concurrent voice sessions | 1 globally; clear busy state, no queue |
| Call duration | 180 seconds of conversation; up to 45 seconds connecting and 15 seconds finalizing, bounded by one server deadline |
| Idle/turn limits | End after 45 seconds without input; cap conversation turns, tool calls and payload sizes |
| New sessions | 2 starts per rolling 10 minutes and 5 per day per network/browser HMAC bucket; 10 globally per day; one active call per browser bucket |
| Global usage | Reserve maximum expected call/finalization cost before admission; initial daily voice allowance 15 minutes and monthly Inference budget $2.00 equivalent, leaving headroom below the listed free credit |
| Availability | Server-only `DEMO_ENABLED` kill switch, optional opening hours, adjustable caps; disable new sessions on unavailable checks/credits |

Estimate reservations using current model billing units and conservative input/output/context limits, including finalization. Minutes alone are not an exact cap on token-based spend. If a credible upper bound is unavailable, reduce admission caps and report estimated versus actual cost; LiveKit's allowance remains the authoritative billing cap. Reconcile dashboard usage, including developer tests and other free projects. No automatic upgrade/top-up and no guarantee of unlimited availability or zero total service cost.

Enforce the hard deadline in Python and end/remove the LiveKit room; token TTL alone does not terminate an established connection. Prevent session/token reuse from recreating rooms or extending deadlines. Return 429/retry information for rate limits and clear capacity/credit errors without infrastructure details. Platform quotas are an additional backstop.

Network/browser limits are abuse friction, not user identity. Shared rural networks may affect multiple visitors; cookie/IP rotation may bypass individual limits. Global atomic limits and the kill switch protect the budget. Trust only hosting-provided client address metadata, not arbitrary forwarded headers. Do not introduce login, CAPTCHA screens, scenario gates or acknowledgement forms in the initial flow.

## Simplified folders

```text
call-aid/
  PROJECT_PLAN.md
  README.md                         # setup, architecture, safety, manual checks
  .gitignore
  .github/workflows/ci.yml
  web/
    app/
      page.tsx
      demo/page.tsx
      records/page.tsx
      records/[id]/page.tsx
      api/sessions/route.ts
      api/sessions/status/route.ts
    components/                     # voice controls, disclaimer, SBAR views
    lib/                            # server-only admission/LiveKit/DB; public DTOs
    tests/
    e2e/
    .env.example
    package.json
    pnpm-lock.yaml
  agent/
    src/
      agent.py                      # starter SDK entry point
      intake.py                     # guided workflow and extraction tools
      intake_agent.py               # SDK tools/events around the plain workflow
      intake_schema.py              # internal/temporary-report Pydantic models
      rules.py                      # pure demonstration screening
      sbar.py                       # grounding, projection, publication
      persistence.py                # trusted lifecycle/finalization
    tests/
    .env.example
    pyproject.toml
    uv.lock
    Dockerfile
    livekit.toml
  contracts/
    sbar.schema.json                 # generated public contract
    fixtures/                       # synthetic test examples only
  supabase/
    config.toml
    migrations/
    tests/
```

Keep starter-required filenames where needed. No auth directories, scenario catalog, transcript/evidence storage, extra documentation hierarchy or separate backend service. Add abstractions only when useful.

## Four implementation milestones

### 1. Public frontend and working LiveKit voice conversation

Priority: deploy a working vertical foundation with essential protections and targeted tests. Defer extensive CI, scheduled maintenance, opening-hours controls, generated contract tooling and additional abstractions until the functioning prototype needs them. Configuration must remain adjustable. Include clearly labeled preloaded synthetic SBAR examples that judges can view even when voice/cloud services are unavailable; examples never count as successful live persistence.

Import/pin official starters, preserve licenses, install/read LiveKit Codex skills, add ignored environment setup and initial README. Build public landing and /demo, visible warnings, Start/mute/end/error states, a short guided opening, server-generated scoped tokens and named Python agent dispatch with a supported Inference realtime model.

Add minimal private session bookkeeping/admission functions in this milestone because the public Vercel preview needs shared rate/concurrency/credit controls immediately. Final SBAR persistence and the records console remain milestone 3. Early Supabase use avoids temporary Redis or unsafe per-process limits. No case content is saved yet; records routes may show a clearly labeled milestone 3 placeholder.

Deploy a minimal Vercel preview and LiveKit Cloud agent during milestone 1 after local checks and credentials are configured. Test the actual HTTPS public URL and Build-plan behavior before polishing. This early preview is part of the proposed milestone scope; this plan update itself creates no deployment.

Acceptance: web lint/typecheck/build, Python lint/import checks, token scope/no-secret checks, concurrent-admission/rate/budget tests, deadline/idle/kill-switch checks, missing-credit/DB/agent errors, microphone denial, cold start and disconnect/end handling. Complete a synthetic hosted two-way voice smoke test. Verify recording/transcript exports are disabled and no sample agent is used. Stop for review.

### 2. Structured intake, simulated screening rules and SBAR generation

Implement relevant conditional questions, strict Pydantic models, corrections/unknowns, pure versioned rules and grounded SBAR. Implement the public projection and fail-closed publication validator before publishing any records. Show a transient sanitized preview after successful generation, explicitly not saved until milestone 3; collected statements stay only in worker memory.

Acceptance: pytest for workflow transitions, invalid tools, unknown/declined inputs, corrections/contradictions, rule boundaries and missing values; grounding failures, forbidden advice and prompt injection; synthetic identifiers, rare combinations and publication withholding; partial/deadline finalization. Run a small synthetic audio script against the actual model. Report probabilistic model results separately from deterministic test results. Stop for review.

### 3. Supabase persistence and public records console

Essential end-to-end acceptance test: a newly completed browser voice conversation reaches the Python agent, generates a validated SBAR record, saves it to Supabase, and appears in the public dashboard/detail route. A preloaded fixture, mocked connection or transient preview does not satisfy this test. Do not claim the full workflow works until this actual path has been demonstrated.

Add finalized SBAR storage, atomic idempotency, safe failure tracking, retention and public DTO reads. Build /records and /records/[id] as core features with recent cases, reported symptoms, simulated flags and formatted SBAR. Completion links directly to the saved report after a bounded processing state; receipt-based polling recovers missed events. Accepted partial reports are visibly incomplete; withheld/failed sessions create no public case.

Acceptance: SQL/integration tests for transaction rollback, duplicate/conflicting retries, late disconnects, expired sessions, database failure and retention. Verify direct anon/public Supabase table reads and INSERT/UPDATE/DELETE/RPC writes are denied. Verify routes never expose operational columns or withheld content. Playwright covers anonymous call-to-report, list/detail navigation, unknown fields, incomplete status, rejected publication, save failure, guessed IDs and escaped content. Stop for review.

### 4. Deployment, testing and documentation

Harden the already deployed preview, complete synthetic E2E testing and responsive/accessibility polish, finish CI and README/runbook, and publish the final shareable URL. Document model choice, starter commits, startup, secrets, limits, public-data policy, cleanup, failure recovery, rollback by redeploy and disabling new sessions. Confirm Vercel/Supabase free-tier constraints as well as LiveKit allowances; paid service changes need a separate decision.

Acceptance: cloud-free CI, disposable local setup/migration rehearsal, hosted microphone/token/agent/public-report workflow, busy/exhausted-credit states, headers/projections and log inspection. Check desktop/mobile and keyboard controls. Record real results and unresolved limitations; never label credential-dependent unrun checks as passed. Stop for review.

## Dependencies and local operation

Use compatible starter versions with committed pnpm/uv lockfiles; consult current docs before SDK changes.

- Web: Next.js, React, TypeScript, Tailwind, LiveKit client/UI/server SDK and a server-only Supabase JS client. No Auth integration or ORM.
- Agent: supported Python/uv, LiveKit Agents SDK, Pydantic/settings and only required plugins. Use the Supabase Python client for trusted functions without a separate API server.
- Tools/tests: Git, pnpm, LiveKit CLI, Docker and Supabase CLI; pytest/pytest-asyncio, Ruff, Vitest/React Testing Library, Playwright and Supabase SQL tests.
- Services: LiveKit Cloud transport/Inference/agent hosting, Supabase PostgreSQL, Vercel and GitHub. No telephone service or direct model-provider account required for Inference.

After implementation, use separate PowerShell terminals:

1. Verify/install tools. Start Docker and run `supabase start` at the root. Use `supabase db reset` only against disposable local data to apply migrations/fixtures; never reset a hosted project as routine testing.
2. In web/: `pnpm install --frozen-lockfile`, copy .env.example to .env.local, set server configuration, then `pnpm dev`. Open http://localhost:3000; no accounts or scenario setup.
3. In agent/: `uv sync --locked`, configure .env.local, download model assets only if the tested configuration requires them, then `uv run python src/agent.py dev`. Match the named agent dispatch. Local audio still uses LiveKit Cloud and consumes credits.
4. Run `uv run pytest`, `uv run ruff check .`, web lint/typecheck/unit/build scripts, `supabase test db` and Playwright. Define exact web scripts in milestone 1. Offline workflow/publication tests use fake models and persistence without cloud keys. Validate synthetic contract fixtures consistently in Python and TypeScript.
5. Run a brief synthetic browser session and supported LiveKit debugger audio workflow to exercise the real realtime model. Use headphones. Optional cloud simulations are separately budgeted, outside default CI.

## Configuration the owner must complete

- Install missing tools and create a LiveKit Build project. Authenticate the CLI, inspect current quotas/model availability and obtain credentials. In milestone 1 run project-local `lk skills install --agent codex`, read installed skills and starter instructions, and apply relevant guidance. No skills or global MCP settings change during this plan revision.
- Create a Supabase project in milestone 1 for shared hosted admission state; use local Supabase for tests. Apply needed migrations. Supply server-only secret credentials to web and agent. Visitors need no Supabase account or database credentials.
- Configure web: LiveKit URL/key/secret, named agent, Supabase URL/server secret, HMAC/receipt secrets and limit settings. Configure agent: matching LiveKit credentials/name, tested model ID, Supabase server secret and deadline/safety settings. Privileged credentials never belong in NEXT_PUBLIC variables, browser bundles, URLs, chat or commits.
- Add .gitignore before credentials: ignore .env and .env.* except placeholder .env.example, node_modules, virtual environments, build/test artifacts and local service state. Rotate exposed secrets.
- Connect GitHub, Vercel with web/ root and LiveKit agent with agent/ build root. Bind preview web only to the intended test agent/database. Disable unused token services, recordings, camera and telephony. Configure retention/maintenance and minimal logs using existing services. No infrastructure is created by this plan update.

## Sources and necessary adjustments

Check current official docs again when implementing:

- [Official Next.js starter](https://github.com/livekit-examples/agent-starter-react) and [Python starter](https://github.com/livekit-examples/agent-starter-python): reuse their foundations and adapt sample-agent, token and recording defaults.
- [LiveKit coding-agent support](https://docs.livekit.io/intro/coding-agents/) and [skills installation](https://docs.livekit.io/reference/developer-tools/livekit-cli/skills/): use official Codex skills during implementation.
- [LiveKit Inference catalog](https://docs.livekit.io/agents/models/inference/): verify current native realtime models and SDK support; pricing/limits sources are above.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): infrastructure permissions remain necessary even when presentation is public.

Changes from the original plan: remove authentication, ownership and scenario machinery; replace six data tables with two and transient evidence; replace general narratives with sanitized SBAR JSON; move a small Supabase admission slice and first hosted voice smoke test into milestone 1. These adjustments preserve immediate public access, trusted writes, validation, safe errors and budget protection without extra services.

Current authorized work: milestone 3 only. Stop before milestone 4.

Implementation update: structured intake and public persistence are implemented. A new synthetic browser conversation produced a confirmed completed Supabase record, and its generated link opened the public SBAR report and console entry. Earlier ended calls were saved as incomplete. Migrations 001–003 are applied; 003 was explicitly approved after a hosted dry run. Vercel/hosted-worker deployment and broader verification remain pending. See milestone reports and README.
