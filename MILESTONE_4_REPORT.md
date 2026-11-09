# Milestone 4: release preparation and deployment status

Date: November 9, 2026. **Milestone 4 is not complete. No final production deployment has been published.** Local release checks are complete as listed below; cloud authorization, allowance review, production approval and hosted acceptance remain outstanding.

## Deployment state

| Component | Actual observed state |
| --- | --- |
| LiveKit project | Existing configured project is reachable using server credentials. Web and agent connection fields/dispatch names match. |
| Hosted agent | Official `lk agent list --json` returned no deployments. No duplicate, paid slot or new agent was created. No cloud build/rollout has been executed. |
| Python production command | Local `src/agent.py start` initialized and registered under `call-aid`. This verifies the start command, not a hosted container. Docker is unavailable locally. |
| Vercel | CLI 65.14.0 installed/invoked; `whoami` reports logged out. Owner device authorization was requested. No Vercel project, environment upload, preview or production URL has been verified. |
| Public demo URL | **Pending; none created or claimed.** |
| Supabase | Existing hosted project reachable, migrations 001–004 applied. Read-only dry run returned up to date; no migration/reset/data deletion was performed. |
| Hosted voice-to-SBAR acceptance | **Unverified.** No new call has been tested on a deployed HTTPS website with local workers stopped. Previous milestone local-browser/real-cloud tests are separate evidence. |

The first LiveKit create command uses the reserved production slot. The owner explicitly requested approval before production publishing; no create/promote/production push was used to bypass that requirement. Additional paid staging infrastructure is not necessary or authorized.

## Release changes

- Preserved Milestone 1–3 workflow, screening, constrained SBAR, trusted saves and natural closing behavior. Committed the previously tested closing/publication changes separately as `412e904` (`feat: confirm saved reports and preserve safe intake categories`).
- Patched Next.js and eslint-config-next from 15.5.27 to 15.5.28; pinned Next's PostCSS dependency to 8.5.23. The original production audit found critical/high Next.js advisories and PostCSS advisories. The patched production audit reports **zero known vulnerabilities**. No framework major upgrade or redesign was introduced.
- Committed security/deployment-origin changes as `78b1446` (`fix: patch web dependencies and validate preview origins`). GitHub `main` was inspected read-only and still points to `6ea31ee`; local commits have not been pushed because a currently uninspected Vercel Git connection might publish production automatically.
- Added a small preview-origin guard: only exact Vercel-provided deployment/branch origins are accepted in Preview. Production still requires the configured canonical origin; caller-controlled forwarding headers are ignored. Regression coverage verifies both boundaries.
- Added `.vercelignore` to exclude secrets, local tools, Python source and caches from web uploads. Tightened agent `.dockerignore` to omit test/debug harnesses and build output. Local env files remain ignored.
- Added a cloud-free GitHub Actions workflow for the existing Python, web, PostgreSQL and browser checks. Repository permission is read-only. **The workflow has not run on GitHub yet.**
- Added browser capacity/usage-error checks and clarified that the visible report result confirms persistence. No model instructions or clinical behavior changed in Milestone 4.
- Updated README with features, synthetic screenshots, environment reference, current deployment commands, rollback, maintenance, constraints and an explicitly pending public URL.

## Executed checks

| Check | Result |
| --- | --- |
| Python intake/rules/validation/persistence/closing tests | 64 passed |
| Python Ruff check and format | Passed |
| Exact agent environment dependency consistency | 81 installed packages compatible, Python 3.12.16 |
| Web/API/PostgreSQL tests | 58 passed, including new preview-origin guard |
| ESLint and TypeScript | Passed; production build also checks types |
| Next.js production build | Passed on patched 15.5.28; records routes remain dynamic |
| Production dependency audit | Zero known vulnerabilities after patch |
| Final patched browser suite | 16 passed across desktop/mobile, including capacity and usage errors |
| Hosted migration dry run | Up to date; no changes applied |
| Hosted database permissions | RLS enabled on both private tables; anon SELECT/INSERT/UPDATE/DELETE all false |
| Credential scan | No exact configured credential values in tracked/staged files or built browser JS; no forbidden tracked env/tool paths |
| Production-mode worker smoke | Local named worker registration succeeded; no inference call made by this startup check |

The SQL tests execute actual migrations in disposable PGlite and cover idempotency, transaction failure, incomplete states, capacity, budgets and denied privileged access. Database failure and save-confirmation authority are covered by tests; a real hosted database outage was not induced. Browser unavailable/capacity/usage responses are mocked and microphone denial is browser-injected. These are not hosted outage tests or physical-device microphone checks.

The patched production server returned HTTP 200 for `/`, `/demo`, `/records` and a sample `/records/[id]` at desktop and mobile widths. All eight route/viewport checks had no horizontal overflow or page errors. Checks verified privacy headers, no operational session fields in public HTML, real database statistics, receipt-free status returning unavailable, and rejection of an untrusted request origin. Desktop landing and mobile SBAR screenshots were visually reviewed. All documentation screenshots contain synthetic data only.

## Allowance and availability blocker

Read-only admission accounting on November 9 showed:

- 31 monthly reservations; **4,500,100 estimated reserved microdollars**.
- 21 starts that UTC day; 3,780 reserved voice seconds.

These exceed the configured example defaults of $2 cumulative monthly reservations, ten starts/day and 900 seconds/day. Consequently simply copying local configuration to production would reject new calls. Local unlimited mode does not apply in production or on Vercel. No history was deleted and no hosted bypass was added.

These totals are application estimates, **not actual billed usage or remaining credit**. The owner must confirm the current LiveKit plan and remaining Inference credit balance in the dashboard; the deployment CLI used here does not expose that balance. Keep `DEMO_ENABLED=false` until bounded launch thresholds are chosen against available allowance. No paid upgrade/top-up or unlimited public access is assumed.

## Remaining release gates

1. Complete Vercel authorization with the intended owner account; inspect existing projects, plan and Git connection before creating/linking anything. Configure root `web/`, Next.js, Node 24 and the locked pnpm build. Do not create an unclaimed temporary project as a workaround.
2. Confirm the existing LiveKit free-tier entitlement/remaining credits and select bounded release settings that include retained test history. Recheck Vercel/Supabase free-tier availability as well.
3. Obtain approval for the first production-slot agent creation, then build/deploy only one `us-east` agent, using supported secret-file injection for Supabase/model/name settings. LiveKit credentials are injected automatically; do not upload or bake them into the image. Inspect status, secret names, logs, versions and dispatch.
4. Configure server-only Vercel secrets and canonical origin, deploy a preview without `--prod`, and stop every local worker. Verify the HTTPS website's new anonymous voice conversation → reviewed recap → actual database save → warm accurate goodbye → generated link → same public dashboard record. Verify all four routes, responsive layout, no secret/metadata leakage and freshness.
5. Test hosted failure states and project recording/observability settings; do not claim local mocks prove hosted behavior. Physical mobile microphone, noise/accents and human audio quality remain manual checks.
6. Present the actual tested preview/version/limits for final owner approval before production promotion or a production-triggering Git push. Update public URLs and this report only after that deployment succeeds. No force-push or history rewrite.
7. Configure daily trusted cleanup using existing Supabase maintenance. Records expire after seven days and are filtered immediately; scheduling is not yet verified.

## Known limitations

Speech extraction and closing wording remain probabilistic. Earlier synthetic tests sometimes required clarification or lost categories; review/correction remains essential. Strict public categories omit nuance, and flags are simulated rather than validated triage. A disconnect/deadline can cut off goodbye, but only a confirmed saved record authorizes a report link. Cloud processing does not establish Canadian residency, anonymity or fictional input. Free-tier cold starts/credit exhaustion can interrupt availability. No raw transcripts, real names or health identifiers are a fallback.

The working local service path is documented in Milestone 3/publication reports; it is not evidence that a public release or local-worker independence has passed.

Local web/agent development processes are restored after production-mode validation. No cloud agent has been made available by this local restart. Vercel CLI sign-in and owner allowance confirmation were requested through the task UI; do not paste secrets into chat. No new application environment variables or database migrations were added by Milestone 4 preparation.

## Security advisory sources

- [Next.js RCE advisory and patched 15.5.28](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw).
- [Next.js App Router denial-of-service advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r).
- [PostCSS source-map disclosure fix](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp).
- [LiveKit deployment](https://docs.livekit.io/deploy/agents/quickstart/), [secret injection](https://docs.livekit.io/deploy/agents/secrets/), [quota behavior](https://docs.livekit.io/deploy/admin/quotas-and-limits/).
