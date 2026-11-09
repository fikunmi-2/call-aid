# Call AId

**Not for medical use.** Public browser voice research prototype for rural Saskatchewan. Use fictional information only. No diagnosis, prescription, validated triage, clinical referral, telephone integration or real patient processing.

Milestone 2 adds Python-controlled adaptive intake, Pydantic validation, deterministic simulated screening and a temporary SBAR preview to the public voice application. No authentication, scenario gate or acknowledgement form.

**New voice conversations generate temporary SBAR reports but do not save or publish them.** Review the spoken recap, correct any important details, then confirm it. A validated generalized preview and JSON appear on `/demo`; refreshing or starting another call clears them. The public records pages still contain static synthetic examples. Saved public reports belong to milestone 3, whose essential test remains a newly completed browser voice conversation producing a saved Supabase report visible in the public console.

## Architecture

Browser → Next.js session endpoint → private Supabase reservation → scoped LiveKit token and named dispatch → Python realtime agent → validated in-memory SBAR → reliable room data → temporary browser preview. The browser publishes microphone audio only; agent recording, text input/output and video are disabled. Only content-free operational session state is persisted. No audio, raw transcripts, symptom content or SBAR records are written to Supabase.

`agent/src/intake.py` owns conditional questions, corrections, unknowns, turn limits and review/completion. `intake_schema.py` defines strict Pydantic models; `rules.py` contains versioned simulated markers; `sbar.py` assembles approved templates. `intake_agent.py` connects these to LiveKit tools and committed conversation events. The model interprets meaning and phrases questions; it cannot write database records, choose clinical urgency or supply arbitrary SBAR narratives. The recap must finish playing before a subsequent caller confirmation can mark it reviewed. An interrupted or corrected recap requires another review.

Only bounded categories enter the temporary report. Evidence quotes are checked transiently against the current caller utterance and excluded from workflow facts/reports; the SDK/model necessarily keep conversation and tool context in worker memory until the job ends. The code does not persist that context. A matching quote does not prove semantic accuracy: the caller review and synthetic model checks are necessary, and neither can establish that a real speaker is fictional. Publication is disabled entirely in this milestone. The combination/privacy publication policy must be completed before milestone 3 exposes any new report publicly.

Public routes: `/`, `/demo`, `/records`, `/records/[id]`. The records pages currently serve curated synthetic examples directly from source, so judges can inspect recognizable SBAR even when services are offline. They never request LiveKit or Supabase credentials. All secrets stay in server modules/env files. Supabase Auth is unused.

`web/` is Next.js 15 / React 19 / TypeScript / Tailwind 4. `agent/` is Python 3.12+ / LiveKit Agents 1.8 / Pydantic. `supabase/` contains the private session table and service-only RPC migration. No Redis, extra API server, queue or scheduled automation is required for this milestone.

## Local setup

Install Node.js 24, pnpm 9.15.9, Python 3.12 and uv. LiveKit CLI is needed for cloud configuration/deployment. Docker plus Supabase CLI are needed only to run the full local Supabase stack; the targeted SQL tests also run through PGlite without Docker.

Dependencies are pinned by `web/pnpm-lock.yaml` and `agent/uv.lock`. This session downloaded project-local tools into ignored `.tools/`; they are not part of the portable project. Normal installed `pnpm`, `uv` and `lk` work with the commands below.

### 1. Explore the website and fixtures without credentials

```powershell
cd web
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

Open http://localhost:3000. Keep `DEMO_ENABLED=false` until the services below are configured. The landing page, example dashboard and example detail pages work immediately. Voice requests return a safe unavailable message while disabled. No sample LiveKit assistant is used.

### 2. Configure Supabase admission state

Create a development Supabase project. In its SQL editor run [the migration](supabase/migrations/202611080001_sessions.sql), or link the Supabase CLI to that development project and run `supabase db push`. Do not run destructive resets against a hosted database.

For a disposable local database, start Docker, then from the repository root:

```powershell
supabase start
supabase db reset
```

The migration creates `private.demo_sessions` with RLS and no anonymous/authenticated grants. Four RPC functions are in `public` for PostgREST routing, but only `service_role` can execute them. Browser clients cannot read the table or execute writes. Server credentials bypass RLS; the trusted routes and SQL functions enforce limits. No public database client or publishable key is needed by the frontend.

Put `SUPABASE_URL` and the server secret/service-role key in **both** `web/.env.local` and `agent/.env.local`. Never use privileged keys in `NEXT_PUBLIC_*`. The SQL functions are the only database boundary used here. Keep the private schema out of Supabase's exposed-schema list.

### 3. Configure LiveKit

Create a LiveKit Cloud Build project. Obtain the WebSocket URL, API key and API secret. Set them in both env files. Use the same `LIVEKIT_AGENT_NAME=call-aid` for web and agent. Disable development token servers, recordings and transcript observability exports in the project; the Python code also explicitly uses `session.start(record=False)`.

The tested realtime configuration is `google/gemini-3.8-live` with voice `Puck`, using `livekit.agents.inference.RealtimeModel`. See [the milestone 2 report](MILESTONE_2_REPORT.md) for actual test results and limitations. Other realtime models have different cost/voice settings; change the model/voice together after consulting the [Inference catalog](https://docs.livekit.io/agents/models/inference/). No direct model-provider API key is needed.

Generate a random HMAC secret for the web server, for example with this local command, then copy its output directly into `SESSION_HMAC_SECRET` in the local env file (never into chat or Git):

```powershell
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
```

Set `APP_ORIGIN=http://localhost:3000` locally. Set `DEMO_ENABLED=true` only when database migration, credentials and a running agent are ready. Restart Next.js after changing environment variables.

### 4. Start the agent in another terminal

```powershell
cd agent
Copy-Item .env.example .env.local
# Fill the credentials before running dev.
uv sync --locked
uv run src/agent.py dev
```

No separate STT/TTS plugins or model asset download is required by this realtime configuration. The agent only accepts a room with a valid, single-use server reservation. Normal browser flow creates that reservation. Sending it arbitrary rooms or the generic Playground will be rejected by design.

Click Start Voice Session, permit the microphone, and use headphones. A cold start may take several seconds. Speak an ordinary fictional symptom description. The assistant should continue naturally, ask a short follow-up, refuse actual clinical advice and avoid claiming that a record was saved. The connected screen includes a microphone selector and input-level meter: check that the meter moves while speaking, and choose another input if it stays flat. Use mute or End Session to stop.

## Limits and failure behavior

For repeated local testing, set `DEV_UNLIMITED_SESSIONS=true` in `web/.env.local` and run `pnpm dev`. This disables application-level start counts, daily reserved voice-time totals and monthly estimated-budget admission checks. Existing reservation history is kept and does not block this mode. The flag works only with `NODE_ENV=development`, a loopback `APP_ORIGIN`, and outside Vercel; production always uses the configured caps. No database migration is needed. It keeps authentication-free infrastructure protections, concurrency, per-call duration, idle timeout and turn limits. LiveKit's own credits/quotas still apply. Set the flag to false to resume normal metering; existing reservations then count again.

Configure limits in `web/.env.local`: default one active session, 180-second conversation, connection/finalization grace, rolling start limits, daily voice allowance and a conservative per-session cost reservation. `agent/.env.local` controls idle timeout (45 seconds) and user-turn cap (20). Database reservations serialize across server instances and remain counted for budgets even after an error. Token expiry alone does not end a connected call: the worker enforces the deadline and deletes the room. The browser End endpoint also deletes it.

Rate limiting uses server-keyed HMAC network/browser buckets, never raw IP storage. Hosted code trusts Vercel's overwritten `x-vercel-forwarded-for`, not arbitrary forwarding headers; local development shares one network bucket. Shared networks may hit limits collectively. IP/cookie rotation can bypass individual friction; global caps remain. All configuration checks fail closed. `DEMO_ENABLED=false` disables new calls. The active worker still enforces existing deadlines.

Budget reservations are estimates, not exact token-based billing limits. Check actual project credit balance and other development usage before sharing. A busy service, missing configuration or expired credit must leave examples viewable. No automatic paid upgrades. Database/session metadata cleanup and fuller usage reconciliation are deferred; before a long-running public demo add the plan's retention maintenance. No health content is stored meanwhile.

## Targeted checks

From `web/`:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

The SQL tests apply the actual migration to a disposable PGlite PostgreSQL instance. They cover permissions, concurrency, one-time claims, rolling limits and non-refunded budget reservations. PGlite does not test Supabase's hosted PostgREST gateway or multi-connection lock contention; those remain hosted integration checks. Connected-microphone component regressions exercise the real device-selection hook with synthetic browser devices. Browser tests use synthetic microphone input and check anonymous navigation, SBAR fixtures, responsive overflow, unavailable service, microphone denial and unknown record IDs. The unavailable-service response is mocked so routine browser tests do not consume LiveKit credits. They do not prove real voice/model behavior. Set `PLAYWRIGHT_BASE_URL` to test an already-running local server on another port, such as http://localhost:3001.

From `agent/`:

```powershell
uv run ruff check src tests
uv run ruff format --check src tests
uv run pytest
```

These cover adaptive intake, unknowns/corrections, simulated rules, grounded templates, review delivery, bounded leases and lifecycle wiring. An admitted call disables recording and deletes the room; unreserved jobs never initialize inference. Scripted tests do not establish model understanding or audio quality. `scenarios.yaml` includes synthetic headache correction, abdominal unknowns, prompt injection and clinical-advice checks for optional cloud simulation. See the milestone 2 report for the separate actual audio/browser results. Extensive automation is deferred.

For live verification, use the actual browser path and inspect content-free status/logs. `src/agent.py` requires a trusted reservation; do not weaken admission for the debugger. The separate synthetic-only `debug_intake.py` exercises the same Assistant without database access:

```powershell
cd agent
lk agent debugger start --audio --idle-timeout 3m debug_intake.py
lk agent debugger say "I have a headache that began gradually yesterday."
lk agent debugger say "Actually, it began today."
lk agent debugger stop
```

The CLI needs the existing LiveKit project credentials/configuration as well as the agent's env file. Debugger audio uses additional inference TTS credits; its temporary logs/history must contain synthetic input only. Never enter real patient information or enable transcript exports/DEBUG logging for public visitors. Regular tests run offline; paid cloud simulations remain opt-in, outside CI.

Regenerate the shared JSON Schema, controlled value labels and synthetic fixture after changing Pydantic contracts: from `agent/`, run `uv run python export_contract.py`. The web validates received JSON at runtime with strict Zod models and approved templates. Python is canonical; cross-language fixtures and targeted tests detect drift. No transcript is sent through the preview channel or stored in browser storage.

## Early deployment configuration

Milestone 1 is ready for a credentialed preview setup; no hosted deployment has been performed in this session.

1. Push this repository to your GitHub repository. Connect Vercel with **Root Directory = web**, package manager pnpm, build `pnpm build`. Add the web env variables in Vercel settings. Use a stable preview URL as `APP_ORIGIN` and redeploy after changing it. Microphone access needs HTTPS outside localhost.
2. Authenticate LiveKit CLI with `lk cloud auth`. From `agent/`, run `lk agent create --help` and create the cloud agent from this Dockerfile using the documented secret-file option for your CLI version. Keep generated `livekit.toml` project/agent IDs; never place secrets in it. Set the same dispatch name in both runtimes.
3. Add agent secrets from `agent/.env.local` through the CLI/LiveKit console secret settings. Verify the Build plan, model availability and Inference balance. Use a single hosted deployment; no paid deployment slots are needed for this preview.
4. Apply the Supabase migration, enable new calls, then complete a synthetic HTTPS microphone smoke test: start → assistant heard → visitor heard → mute → end → room removed. Check denied microphone, unavailable worker and rate/deadline failures. Keep examples accessible. Do not describe voice or cloud integration as verified until these pass.

At initial implementation, cloud credentials were unavailable. Subsequent local setup verified the Supabase session RPC, LiveKit worker registration and synthetic browser audio in both directions. Milestone 2 also verified structured intake and a temporary browser report. Local env files remain ignored. Broader model safety behavior, hosted browser deployment and full hosted RLS testing remain unverified. See the milestone reports for results. The current local dev URL is http://localhost:3001; keep `APP_ORIGIN` equal to the URL used by the browser.

## Starter and skill provenance

- Web foundation: [livekit-examples/agent-starter-react](https://github.com/livekit-examples/agent-starter-react), commit `9e1fc2f40fd7ceaccbe4a872b21765b49eefea80`. Reused dependency/config conventions and token endpoint foundation; replaced unrestricted token grants and removed unused starter features. MIT license retained in `web/LICENSE`.
- Python foundation: [livekit-examples/agent-starter-python](https://github.com/livekit-examples/agent-starter-python), commit `228095c442fcb259c80e9786fc0d7c5534e6af46`. Adapted AgentServer entry point, uv project and Dockerfile to native realtime and server reservations. MIT license retained in `agent/LICENSE`.
- Official [LiveKit Agent Skills](https://github.com/livekit/agent-skills), commit `e1195b497388b1aecad5dd2e9a0c9bdfbaba1878`, were installed manually by copying their skill directories into `agent/.agents/skills`, as supported by the [installation docs](https://docs.livekit.io/reference/developer-tools/agent-skills/). These are local developer tools excluded from Git; install them locally when needed. No global Codex settings were changed. The project-local CLI is 2.19.3 and installed Python SDK is 1.8.10.

Review the approved [project plan](PROJECT_PLAN.md). Milestone 3 requires separate approval; no SBAR persistence has been implemented.
