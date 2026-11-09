# Milestone 4: release preparation and deployment status

Date: November 9, 2026. **Milestone 4 is not complete.** The protected HTTPS Preview works with hosted Supabase; the first LiveKit image is pending. The owner authorized deployment and confirmed Build with $0.00 Inference credit usage. Manual GitHub Actions deployment is prepared to avoid the laptop's ISP upload restriction. Final hosted voice acceptance and approved public production release remain outstanding.

## Deployment state

| Component | Actual observed state |
| --- | --- |
| LiveKit project | Existing configured project is reachable using server credentials. Web and agent connection fields/dispatch names match. |
| Hosted agent | One existing pending agent, `CA_5zppKdPR3z8g`, bound in `agent/livekit.toml`, `us-east`. Secret names verified; status Setting Up, version `---`, zero reported CPU/memory usage. Image upload failed locally before a build. No duplicate agent created. |
| Python production command | Local `src/agent.py start` initialized and registered under `call-aid`. This verifies the start command, not a hosted container. Docker is unavailable locally. |
| Vercel | Authenticated Call-AId Hobby team; one `call-aid` web project created because none existed. Root `web/`, Next.js 15.5.28, Node 24, locked pnpm build. Explicit Preview is Ready; voice disabled in Preview and Production. |
| Preview URL | https://call-o13fakmd3-call-ai-d.vercel.app — owner-protected, not anonymous judge access. |
| Production state | First deployment automatically targeted/aliased production even without `--prod`. It completed before cancellation. Owner subsequently confirmed the required interactive pause; Vercel's paused-project listing now reports `paused: true`. No final release approval is claimed. |
| Supabase | Existing hosted project reachable, migrations 001–004 applied. Read-only dry run returned up to date; no migration/reset/data deletion was performed. |
| Hosted voice-to-SBAR acceptance | **Unverified.** No new call has been tested on a deployed HTTPS website with local workers stopped. Previous milestone local-browser/real-cloud tests are separate evidence. |

The owner authorized continuing the deployment after Vercel login and free-plan confirmation. The LiveKit create allocated only the existing Build project's first slot; its failed upload left a recoverable pending agent. `lk agent config --id` saved the binding for reuse. No paid staging slot or plan upgrade was enabled.

## First Vercel deployment incident

The CLI's first `deploy --yes --verify` invocation automatically targeted production although `--prod` was omitted. It was inspected while Building, but the cancel request arrived after completion and returned 400. It remained Vercel-auth protected with `DEMO_ENABLED=false`. Pausing via CLI required interactive owner confirmation and was not bypassed. The owner ran that command and the paused state was verified. A separate `--environment preview` deployment succeeded. All future deployments must name their target explicitly; do not resume/promote production without final approval.

## Release changes

- Preserved Milestone 1–3 workflow, screening, constrained SBAR, trusted saves and natural closing behavior. Committed the previously tested closing/publication changes separately as `412e904` (`feat: confirm saved reports and preserve safe intake categories`).
- Patched Next.js and eslint-config-next from 15.5.27 to 15.5.28; pinned Next's PostCSS dependency to 8.5.23. The original production audit found critical/high Next.js advisories and PostCSS advisories. The patched production audit reports **zero known vulnerabilities**. No framework major upgrade or redesign was introduced.
- Committed security/deployment-origin changes as `78b1446` (`fix: patch web dependencies and validate preview origins`). Vercel Git connection was attempted but failed due to GitHub repository access; project inspection confirms no Git link, so pushing code does not trigger this project's production deployment. Connecting the Vercel GitHub app still needs owner repository authorization.
- Added a small preview-origin guard: only exact Vercel-provided deployment/branch origins are accepted in Preview. Production still requires the configured canonical origin; caller-controlled forwarding headers are ignored. Regression coverage verifies both boundaries.
- Added `.vercelignore` to exclude secrets, local tools, Python source and caches from web uploads. Tightened agent `.dockerignore` to omit test/debug harnesses and build output. Local env files remain ignored.
- Added a cloud-free GitHub Actions workflow for the existing Python, web, PostgreSQL and browser checks. Repository permission is read-only. **The workflow has not run on GitHub yet.**
- Added browser capacity/usage-error checks and clarified that the visible report result confirms persistence. No model instructions or clinical behavior changed in Milestone 4.
- Updated README with features, synthetic screenshots, environment reference, current deployment commands, rollback, maintenance, constraints and an explicitly pending public URL.
- Configured Preview/Production server credentials via Vercel's supported stdin env workflow, with sensitive keys hidden. Voice is off. Added period-expiring verified historical test offsets so the new bounded release allowance does not require deleting accounting or expanding future periods.
- Added `.github/workflows/deploy-livekit.yml` using the official `livekit/deploy-action`, pinned v2 commit `31f4161e507defdf9e99779af95fcaf8c90115eb`. It is manual `workflow_dispatch` only, deploys `agent/` to the existing ID, uses read-only repository permissions, queues concurrent runs and waits for Running status. There is no create/delete/paid environment operation. See [GitHub deployment guide](docs/LIVEKIT_GITHUB_DEPLOY.md).

## Executed checks

| Check | Result |
| --- | --- |
| Python intake/rules/validation/persistence/closing tests | 64 passed |
| Python Ruff check and format | Passed |
| Exact agent environment dependency consistency | 81 installed packages compatible, Python 3.12.16 |
| Web/API/PostgreSQL tests | 59 passed, including preview-origin guard and UTC offset expiry |
| ESLint and TypeScript | Passed; production build also checks types |
| Next.js production build | Passed on patched 15.5.28; records routes remain dynamic |
| Production dependency audit | Zero known vulnerabilities after patch |
| Final patched browser suite | 16 passed across desktop/mobile, including capacity and usage errors |
| Hosted migration dry run | Up to date; no changes applied |
| Hosted database permissions | RLS enabled on both private tables; anon SELECT/INSERT/UPDATE/DELETE all false |
| Credential scan | No exact configured credential values in tracked/staged files or built browser JS; no forbidden tracked env/tool paths |
| Production-mode worker smoke | Local named worker registration succeeded; no inference call made by this startup check |
| GitHub workflow validation | Official actionlint 1.7.12 passed for both workflows; deployment workflow not executed until repository secrets/manual dispatch |
| Hosted Preview browser checks | Passed on desktop/mobile through the owner's supported automation bypass: HTTPS routes, real published detail, 14 actual saved cases, clear unknown/incomplete state, origin rejection, disabled-voice 503 and no page errors/overflow |
| Anonymous Preview access | Redirects to Vercel authentication (302); not reported as public judge access |

The SQL tests execute actual migrations in disposable PGlite and cover idempotency, transaction failure, incomplete states, capacity, budgets and denied privileged access. Database failure and save-confirmation authority are covered by tests; a real hosted database outage was not induced. Browser unavailable/capacity/usage responses are mocked and microphone denial is browser-injected. These are not hosted outage tests or physical-device microphone checks.

The patched production server returned HTTP 200 for `/`, `/demo`, `/records` and a sample `/records/[id]` at desktop and mobile widths. All eight route/viewport checks had no horizontal overflow or page errors. Checks verified privacy headers, no operational session fields in public HTML, real database statistics, receipt-free status returning unavailable, and rejection of an untrusted request origin. Desktop landing and mobile SBAR screenshots were visually reviewed. All documentation screenshots contain synthetic data only.

## Configured free-tier release controls

Read-only admission accounting on November 9 showed:

- 31 monthly reservations; **4,500,100 estimated reserved microdollars**.
- 21 starts that UTC day; 3,780 reserved voice seconds.

The owner confirmed Build with $0.00 Inference credits used. The release retains a $2 **new estimated reservation** allowance, 150,000 estimated microdollars per call, one concurrent session, 180-second calls, two starts per ten minutes, five per visitor/day, ten globally/day and 900 reserved seconds/day. Existing verified test totals are added only for their original UTC month/day using the server-only `PRIOR_TEST_*` variables. Regression tests verify daily and monthly rollover automatically removes these offsets. No history was deleted and no production unlimited bypass was added.

These totals are application estimates, **not actual billed usage or a guaranteed token-cost bound**. The configured $2 estimate leaves headroom below the currently documented $2.50 Build credits, with the Build hard cap as billing backstop. Dashboard balance is owner-reported; it is not exposed by this CLI. Vercel is Hobby with its default basic build machine. Both environments remain `DEMO_ENABLED=false` until the hosted agent and new-call workflow are verified. No paid upgrade/top-up or unlimited public access is assumed.

## Upload-network failure and GitHub recovery

The laptop resolves LiveKit's Oracle upload host to an ISP address serving an expired, unrelated `*.myaccess.coop` certificate. Verified TLS failed in CLI/curl. A diagnostic DNS-over-HTTPS query returned Oracle addresses instead. No DNS, trust-store or TLS verification setting was altered, and no credentialed request was sent after the certificate failure. This is not an application-code build failure.

The owner explicitly requested the official GitHub-hosted deployment action. Repository secrets must be configured directly in GitHub: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. The workflow constructs `SECRET_LIST` for supported runtime secret injection, preserves the tested dispatch/model settings, and uploads from GitHub's Ubuntu runner to LiveKit's build service. The local network upload restriction is therefore not on that path. Actual runner success, startup logs and call health remain unverified until the owner adds secrets and runs it.

Non-sensitive deployment recovery feedback was submitted through the official [LiveKit agent skills](https://github.com/livekit/agent-skills), as required by the local reading-livekit-docs skill/project instructions. The installed skills remain ignored local tooling.

## Remaining release gates

1. Add the five repository secrets directly in [GitHub Actions settings](https://github.com/fikunmi-2/call-aid/settings/secrets/actions), then manually run **Deploy LiveKit agent (manual)** on `main`. The workflow must deploy to the existing pending ID, not create a replacement.
2. Inspect the actual Actions run, hosted agent version/status/secret names and bounded startup logs. A reported Running status alone does not prove audio or persistence. Verify that no paid service was enabled.
3. Keep production paused. After a healthy worker, enable only Preview voice for a bounded synthetic check, stop every local worker and complete the HTTPS new voice → reviewed recap → saved report → accurate warm closing → generated link → same dashboard case. Cloud recording/transcript export settings still need verification.
4. Owner-authorize the Vercel GitHub app for this repository if automatic Git integration is desired; CLI source deployment currently works without that link. Confirm any Git connection will not prematurely publish production.
5. Test hosted failure states and project recording/observability settings; do not claim local mocks prove hosted behavior. Physical mobile microphone, noise/accents and human audio quality remain manual checks.
6. Present the actual tested preview/version/limits for final owner approval before production promotion or a production-triggering Git push. Update public URLs and this report only after that deployment succeeds. No force-push or history rewrite.
7. Configure daily trusted cleanup using existing Supabase maintenance. Records expire after seven days and are filtered immediately; scheduling is not yet verified.

## Known limitations

Speech extraction and closing wording remain probabilistic. Earlier synthetic tests sometimes required clarification or lost categories; review/correction remains essential. Strict public categories omit nuance, and flags are simulated rather than validated triage. A disconnect/deadline can cut off goodbye, but only a confirmed saved record authorizes a report link. Cloud processing does not establish Canadian residency, anonymity or fictional input. Free-tier cold starts/credit exhaustion can interrupt availability. No raw transcripts, real names or health identifiers are a fallback.

The working local service path is documented in Milestone 3/publication reports; it is not evidence that a public release or local-worker independence has passed.

Local web/agent development processes are restored after production-mode validation and must be stopped for hosted call acceptance. No healthy hosted agent is claimed yet. Five optional period-bound accounting variables were added; no database migration was needed. Never paste any secret values into chat or commits.

## Security advisory sources

- [Next.js RCE advisory and patched 15.5.28](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw).
- [Next.js App Router denial-of-service advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r).
- [PostCSS source-map disclosure fix](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp).
- [LiveKit deployment](https://docs.livekit.io/deploy/agents/quickstart/), [secret injection](https://docs.livekit.io/deploy/agents/secrets/), [quota behavior](https://docs.livekit.io/deploy/admin/quotas-and-limits/).
