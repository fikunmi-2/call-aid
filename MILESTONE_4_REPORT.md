# Milestone 4: hosted verification and release status

Date: November 9, 2026. **The hosted voice ? SBAR ? Supabase ? Records Console test passed. Final public production release awaits owner approval.** Testing used an owner-protected Vercel Preview, synthetic microphone audio and the deployed LiveKit agent, with no local Python worker running. This does not establish anonymous judge access or physical microphone quality.

## Deployment state

| Component | Observed state |
| --- | --- |
| LiveKit | Existing Build project `call-aid-dev-j5qdhieo`, agent `CA_5zppKdPR3z8g`, region `us-east`, dispatch `call-aid`. No duplicate agent or paid environment. |
| Hosted acceptance version | `GaYhTPCKfqth`, Running; [deployment run 42703788441](https://github.com/fikunmi-2/call-aid/actions/runs/42703788441) passed. |
| Current hosted version | `GqvhsuGZ4Dvy`, Running, commit `21f27ff`; [manual deployment 42723826184](https://github.com/fikunmi-2/call-aid/actions/runs/42723826184) **passed**. Content-free logs retain numeric HTTP status; 68 Python tests pass. No conversational or persistence change. Prior logging update `eJReKCr4TJSJ` also deployed successfully. |
| Vercel | Existing Call-AId Hobby project `call-aid`; root `web/`, Next.js 15.5.28, Node 24, locked pnpm build. |
| Tested voice Preview | https://call-nydvy3gmm-call-ai-d.vercel.app ? Ready, Vercel-auth protected; voice enabled only for this deployment. Owner automation bypass used. |
| Production | https://call-aid.vercel.app ? final release not approved; Vercel protection and `DEMO_ENABLED=false` retained. Project resumed with approval for Preview testing, then paused again; API verified `paused: true`. |
| Supabase | Existing hosted project reachable; migrations 001?004 applied, dry run up to date. No new migration, reset or deletion. |
| Git integration | Existing repository receives normal pushes. Vercel Git link absent because repository-app authorization failed; CLI deployment works. Pushes currently do not auto-deploy this Vercel project. |

The laptop's ISP redirected the Oracle upload hostname and caused TLS verification to fail. The official pinned `livekit/deploy-action` uploaded from GitHub's runner and updated the existing agent successfully. No TLS/DNS/trust bypass, new resource or paid service was used. The owner configured the five required repository secrets directly. See [deployment guide](docs/LIVEKIT_GITHUB_DEPLOY.md).

The first Vercel CLI deployment auto-targeted production without `--prod` and completed before cancellation. It remained protected with voice disabled; the owner paused it. Later deployments explicitly targeted Preview. Temporary resumption was separately approved. Production promotion/removal of protection remains unauthorized.

## Hosted acceptance evidence

1. Opened the protected HTTPS Preview in Chromium and started an actual admitted voice session without application login.
2. Supplied invented headache symptoms through a synthetic browser microphone; answered follow-ups and clarified missing fields.
3. Reviewed and confirmed the recap. The hosted Python worker generated and saved the record; no local `src/agent.py` worker was running.
4. **View Generated Record** opened the new report; the console contained the same case. Actual database count increased **14 ? 15**, with zero browser page errors.
5. Independently read the saved record through the trusted hosted Supabase RPC and validated it with Pydantic: completed, reviewed, published, schema 3.0, `recommendation.record_saved=true`, no missing required fields.

New synthetic case: **`696a540c-beed-4696-a989-de6f2c08b039`** ([protected Preview report](https://call-nydvy3gmm-call-ai-d.vercel.app/records/696a540c-beed-4696-a989-de6f2c08b039)). It expires after seven days. This is a newly created record, not a fixture. Published categories include headache, yesterday, intermittent duration, moderate severity, gradual onset, nausea and changed sleep. The saved recommendation accurately describes generation and saving, with no temporary/unsaved wording.

The test captured **15.27 seconds** of synthetic assistant farewell locally. Optional LiveKit STT transcription failed with **429** after SDK retries. **Exact spoken closing wording was not verified in this hosted test.** Database save authority and displayed outcome passed; earlier real-model closing probes are separate evidence. No upgrade or alternate paid service bypassed the 429.

**Later retest failed:** after the logging-only deployment, an actual protected Preview call connected but disconnected before the opening. It did not produce a completed report; a subsequent content-free realtime connection probe identified `APIConnectionError` caused by `WSServerHandshakeError` with HTTP **429**. This is the inference gateway, not the application's session-start admission cap; admission and room connection had succeeded. Do not interpret the earlier success as proof of current inference availability. Credit exhaustion, quota and temporary throttling have not been distinguished; the owner was asked to inspect dashboard balance/warnings. Vercel was paused again. The initial completed case remains independently verified. Actual console totals after the interrupted attempt are 16 (4 completed / 12 incomplete), separate from sample cases.

The model needed retries/clarification and did not preserve every detail from a richer utterance. Eight grounding rejections and one malformed tool argument occurred before successful completion. Evidence validation remains intact. This is a probabilistic extraction limitation, not exhaustive clinical information capture.

## Executed checks

| Check | Result |
| --- | --- |
| Python intake/rules/SBAR/publication/persistence/closing | 64 passed originally; **68 passed** with four log privacy regressions |
| Ruff lint/format | Passed after correction |
| Dependency consistency | 81 packages compatible; Python 3.12.16, Agents SDK 1.8.10 |
| Web/API/PostgreSQL tests | 59 passed, including preview origin and UTC offset expiry |
| ESLint, TypeScript, production build | Passed on Next.js 15.5.28; record routes dynamic |
| Production audit | Zero known vulnerabilities after Next.js/PostCSS patches |
| Local desktop/mobile Playwright | 16 passed, including unavailable/capacity/usage errors |
| Cloud-free CI | [42703434876](https://github.com/fikunmi-2/call-aid/actions/runs/42703434876), [42703820419](https://github.com/fikunmi-2/call-aid/actions/runs/42703820419), [42722378177](https://github.com/fikunmi-2/call-aid/actions/runs/42722378177) and current [42723734707](https://github.com/fikunmi-2/call-aid/actions/runs/42723734707) passed |
| Workflow checks | actionlint 1.7.12 passed; synthetic preflight rejects missing/malformed/mismatched secrets without printing values |
| Hosted DB access | RLS enabled; anon SELECT/INSERT/UPDATE/DELETE denied on both private tables |
| Hosted desktop/mobile pages | All four routes passed, no overflow/page errors; new saved report and actual total 15 verified |
| Anonymous Preview access | 302 to Vercel authentication; not public judge access |
| New hosted voice-to-saved-report | **Passed**, local workers stopped; independent DB verification passed |
| Retest after log correction | **Failed before introduction**; separate realtime probe returned HTTP 429. Current availability unresolved. |
| Exact hosted farewell wording | **Unverified**, optional STT 429 |
| Secret scan | No configured credentials in tracked/staged files or browser JS; no tracked env/local tools |

SQL tests use actual migrations in disposable PGlite for retries, rollback, incomplete states, capacity/budgets and denied access. No real hosted DB outage was induced. Failure browser checks use mocked responses or injected microphone denial. Physical mobile/desktop microphones, noise, accents and subjective audio quality remain manual checks. Screenshots use synthetic data.

## Privacy correction discovered during hosted testing

Despite `session.start(record=False)`, an SDK tool-validation error emitted `lk.pii.arguments` containing synthetic evidence to worker stdout. Recording controls alone do not sanitize runtime console logs. Commit `7415acd` installs a content-free filter on existing job-process root handlers before admission/model setup. It retains severity, logger/source and fixed application event codes while removing arbitrary extras, exception details and uncontrolled message bodies. Intake, tools and database behavior are unchanged.

Four regression tests cover the installed SDK JSON formatter, child-logger propagation and numeric status preservation with synthetic identifying text. Bounded hosted logs on the first corrected version contained eight content-omitted events and zero `lk.pii.arguments` fields. Earlier provider logs contain synthetic content only; the correction is not retroactive. Project-level observability settings still require owner review. See [LiveKit PII redaction boundaries](https://docs.livekit.io/testing/observability/pii-redaction/); do not claim automatic detection guarantees de-identification.

## Cost and environment

The owner confirmed Build and **$0.00 Inference credits used before hosted checks**. Current billed balance is not exposed by the CLI and remains unverified. The STT 429 does not establish a billing cause.

Limits remain one concurrent call, 180 seconds, 45 seconds idle, 20 user turns, two starts/ten minutes, five per visitor/day, ten globally/day, 900 reserved seconds/day and $2 estimated monthly release reservations, reserving 150,000 microdollars per start. These are estimates, not guaranteed token-cost bounds. LiveKit Build caps are the billing backstop; check actual dashboard usage before sharing.

Historical test totals remain: 4,500,100 estimated reserved microdollars and 21 starts / 3,780 seconds on November 9 before release testing. Optional server-only `PRIOR_TEST_MONTH`, `PRIOR_TEST_COST_MICRODOLLARS`, `PRIOR_TEST_DAY`, `PRIOR_TEST_STARTS`, `PRIOR_TEST_VOICE_SECONDS` offsets allow a fresh bounded allowance only in their original UTC month/day, then expire automatically. Hosted acceptance consumed another reservation. No accounting reset or production unlimited flag.

No new migration or required application env variable in this resumed work. Privileged secrets remain server-side in ignored env files and supported cloud secret stores. No browser Supabase client, anonymous writes or paid service enabled.

## Remaining release gates

- Resolve the realtime HTTP 429 and rerun acceptance on current version `GqvhsuGZ4Dvy` before claiming current voice availability; the earlier deployed version passed actual hosted acceptance. Current CI passed and CLI reports the same existing agent Running.
- Owner check of exact farewell and physical microphone/mobile audio; automated transcription success is not claimed.
- **Owner approval before final production publication, resumption and judge access.** The tested Preview, source and limits are ready for review.
- Optional Vercel GitHub app repository authorization for automatic Git deployment.
- Configure/verify daily trusted `public.cleanup_demo_records()` maintenance. Expired records are immediately excluded; scheduled deletion is not yet verified.
- Owner dashboard review of project-wide recording, observability and retention settings. Agent recording is explicitly disabled; no Canadian residency/anonymity guarantee.

Disable new calls with `DEMO_ENABLED=false` plus redeployment. Existing calls remain bounded. Roll back versions rather than resetting the database. Free-tier cold starts/quotas can interrupt voice; labelled examples remain available when the site is serving. Reports are public demonstrations, not clinical records.

Earlier non-sensitive recovery feedback was submitted under the official [LiveKit agent skills](https://github.com/livekit/agent-skills) and local project instructions. Automatic approval review initially blocked a logging-documentation note without explicit user consent. The owner subsequently approved it, and `lk docs submit-feedback` confirmed successful submission on November 9. It contained the SDK version and generic synthetic error pattern, with no credentials, transcripts or project identifiers. See [README](README.md) for setup and deployment.
