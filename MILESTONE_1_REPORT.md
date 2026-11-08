# Milestone 1 implementation report

Prepared 2026-11-08. Code implemented and locally checked; credentialed voice/cloud acceptance remains pending. Milestone 2 has not started.

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
| Web unit/integration tests | 14 passed: real token verification, successful/denied dispatch boundaries, private receipts, request/config failure paths, SQL permissions/admission/idempotent claims/budgets and shutdown handling |
| Browser checks | 12 passed across desktop and mobile Chromium, using synthetic microphone input; public navigation, fixture SBAR, offline fallback, microphone denial, unknown IDs and layout overflow |
| Python tests | 8 passed: lease/config validation, privacy room options, scripted lifecycle, unreserved-job rejection, normal/already-closed/uncertain room deletion |
| Web lint/typecheck | Passed |
| Python Ruff checks | Passed |
| Production Next.js build | Passed |
| Visual inspection | Desktop and mobile landing screenshots reviewed; no clipping/overflow observed |
| Environment ignore checks | Local env files, tools, virtualenvs, build/test artifacts and generated package metadata excluded from Git |

Resolved during verification: a LiveKit log-level spelling mismatch, Next.js empty POST stream handling, a repeated browser deadline cleanup request, and a room deletion race that could otherwise retain capacity after a completed shutdown.

## Remaining configuration and limits

The LiveKit CLI reports no configured projects. No LiveKit/Supabase/Vercel credentials were available. No hosted preview or live two-way voice smoke test was completed. The candidate model ID is documented as supported, but real model behavior, audio quality and clinical-advice refusals remain unverified.

PGlite runs the actual SQL migration but does not verify the hosted Supabase gateway or multi-connection advisory-lock contention. Docker is unavailable, so the deployment image has not been built locally. Cloud debugger/simulation runs were not performed; the admission-bound RTC entry point deliberately rejects unreserved generic rooms. Python tests using a scripted session prove wiring, not language understanding.

To finish milestone 1's cloud acceptance, follow README: create/link LiveKit Build and Supabase projects, apply the session migration, configure server-only credentials and a shared agent name, run the Python worker, set the HMAC secret and allowed web origin, then enable new sessions. Deploy web with Vercel root `web/` and the worker from `agent/`; test synthetic speech and room shutdown over HTTPS. No secrets should be pasted into chat or committed.

Structured intake, deterministic screening and new SBAR generation are deferred to milestone 2. Saving and publishing newly generated reports is milestone 3. The essential new-conversation-to-saved-public-report acceptance test remains pending those milestones; static examples and mocked tests do not satisfy it. Extensive automation and retention scheduling are deferred per the approved priorities.

Stop here for review. Do not begin milestone 2.
