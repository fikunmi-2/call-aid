# Milestone 1 implementation report

Prepared 2026-11-08; updated after local credential setup. Code and the credentialed local audio smoke test pass. Hosted deployment acceptance remains pending. Milestone 2 has not started.

## Available now

- Responsive public landing and `/demo`, without accounts, scenario selection or acknowledgement forms. Clear research disclaimer and Not for medical use notice.
- Microphone permission/start/mute/end UI, LiveKit audio rendering and agent connection states. Recoverable denied-microphone and offline-service behavior.
- Server-generated room/participant IDs, microphone-only short-lived tokens, named agent dispatch, private receipt cookies, no-store session responses and server-only credentials.
- Actual Supabase SQL migration for content-free session reservations, atomic admission, rate/concurrency/estimated-budget limits, one-time worker claims and bounded lifecycle handling. No transcript or symptom persistence.
- Python AgentServer using LiveKit Inference native realtime, `record=False`, no text/video output, trusted reservation binding, idle/turn/time limits and room shutdown. Ordinary fictional symptom descriptions are allowed by the prompt; real clinical advice requests must be refused. Actual model compliance is not yet tested.
- Public `/records` and `/records/[id]` show two clearly labeled preloaded synthetic SBAR examples even when voice is unavailable. They are not live generated/saved reports.
- Setup instructions, ignored environment templates, lockfiles, retained starter licenses and project-local official LiveKit skills.

## Local verification

| Check | Result |
| --- | --- |
| Web unit/integration tests | 18 passed: the original 14 token/admission/SQL checks plus four connected microphone regressions covering stable device enumeration, a labeled fallback, switch errors and mute state |
| Browser checks | 12 passed across desktop and mobile Chromium, using synthetic microphone input; public navigation, fixture SBAR, offline fallback, microphone denial, unknown IDs and layout overflow |
| Python tests | 8 passed: lease/config validation, privacy room options, scripted lifecycle, unreserved-job rejection, normal/already-closed/uncertain room deletion |
| Web lint/typecheck | Passed |
| Python Ruff checks | Passed |
| Production Next.js build | Passed |
| Credentialed local voice smoke test | Passed: Supabase session RPC returned 200, worker registered with LiveKit, browser session returned 200, synthetic microphone sent 25,285 audio bytes and received 4,883 agent audio bytes; UI reached listening/speaking and End Session completed |
| Post-greeting reply check | Passed in a separate synthetic browser session: speech was delayed until after the opening, two distinct assistant speaking turns were observed, and 140,070 agent audio bytes were received. This does not establish the cause of a user's unresponsive microphone or semantic correctness. |
| Connected microphone regression check | Passed with real browser capture and the live agent: three labeled inputs, one initial capture, successful device switch, peak meter 0.69, two assistant speaking turns, 30,716 sent/151,212 received audio bytes, zero render-loop/page errors, working mute/unmute and all capture tracks stopped after End Session |
| Visual inspection | Desktop and mobile landing screenshots reviewed; no clipping/overflow observed |
| Environment ignore checks | Local env files, tools, virtualenvs, build/test artifacts and generated package metadata excluded from Git |

Resolved during verification: a LiveKit log-level spelling mismatch, Next.js empty POST stream handling, a repeated browser deadline cleanup request, and a room deletion race that could otherwise retain capacity after a completed shutdown.

The first microphone selector introduced an unstable inline error callback. LiveKit used its identity to memoize the device observer, so meter renders repeatedly recreated the subscription and triggered a React update loop. A connected-state regression reproduced the failure. The callback is now stable, device switching uses the room-based SDK API, the select always has a labeled system-default option, and startup publishes the same microphone track it captured instead of stopping and reacquiring input. Four component regressions, all 18 targeted web tests and 12 desktop/mobile browser checks now pass. The live connected-microphone check above verifies the meter and post-greeting audio; a person's physical microphone still needs their own retry.

Local testing now explicitly uses `DEV_UNLIMITED_SESSIONS=true` in ignored `web/.env.local`, bypassing cumulative application usage caps rather than repeatedly raising individual thresholds. Reservations are still recorded. Production, Vercel and non-loopback origins cannot activate the bypass. Per-call duration, concurrency, idle timeout, turn limits and external LiveKit quotas remain in effect. Six additional regression checks cover unlimited SQL admission, retained concurrency and development/production/hosted/origin gating; all 24 targeted web tests pass.

## Remaining configuration and limits

LiveKit and Supabase credentials are now configured in ignored local env files. The owner applied the session migration, its RPC responded successfully, and the local worker registered with LiveKit. A synthetic browser audio smoke test passed. This proves audio transport and model audio output, not transcription accuracy, clinical-advice refusal quality, or human-perceived audio quality. No hosted Vercel preview has been deployed.

PGlite runs the actual SQL migration but does not verify the hosted Supabase gateway or multi-connection advisory-lock contention. Docker is unavailable, so the deployment image has not been built locally. Cloud debugger/simulation runs were not performed; the admission-bound RTC entry point deliberately rejects unreserved generic rooms. Python tests using a scripted session prove wiring, not language understanding.

The local worker and Next.js dev server are running; the local allowed origin is `http://localhost:3001` and voice sessions are enabled. A private HMAC secret was generated without printing it. The smoke test counts toward configured usage limits. For hosted acceptance, deploy web with Vercel root `web/` and the worker from `agent/`, set the hosted origin, and test synthetic speech/shutdown over HTTPS. Confirm project-level recording/observability exports are off as well as the worker's explicit `record=False`. No secrets should be pasted into chat or committed.

Structured intake, deterministic screening and new SBAR generation are deferred to milestone 2. Saving and publishing newly generated reports is milestone 3. The essential new-conversation-to-saved-public-report acceptance test remains pending those milestones; static examples and mocked tests do not satisfy it. Extensive automation and retention scheduling are deferred per the approved priorities.

Stop here for review. Do not begin milestone 2.
