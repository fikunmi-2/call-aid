# Call AId

**Not for medical use.** Public browser voice research prototype for rural Saskatchewan. Use fictional information only. No diagnosis, prescription, validated triage, clinical referral, telephone integration or real patient processing.

Milestone 1 implementation: public landing and voice UI, official LiveKit starter foundations, named Python realtime voice worker, private session admission in Supabase, and two clearly labeled preloaded synthetic SBAR examples. No authentication, scenario gate or acknowledgement form.

**New voice conversations do not generate or save SBAR reports yet.** Structured intake/rules/generation belong to milestone 2; saved public reports belong to milestone 3. The examples are static fixtures, not evidence of successful live persistence. The required milestone 3 test is a newly completed browser voice conversation producing a saved Supabase SBAR report visible in the public console.

## Architecture

Browser → Next.js session endpoint → private Supabase reservation → scoped LiveKit token and named dispatch → Python realtime agent. The browser publishes microphone audio only; agent recording, text input/output and video are disabled. Only content-free session state is persisted in milestone 1. No raw transcript or audio storage is implemented.

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

The current configured model candidate is `google/gemini-3.8-live` with voice `Puck`, using `livekit.agents.inference.RealtimeModel`. Official docs list it as supported; **this project's model/audio behavior still requires a credentialed live test**. OpenAI realtime alternatives have different cost/voice settings; change the model/voice together after consulting the [Inference catalog](https://docs.livekit.io/agents/models/inference/). No direct Google/OpenAI API key is needed.

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

Click Start Voice Session, permit the microphone, and use headphones. A cold start may take several seconds. Speak an ordinary fictional symptom description. The assistant should continue naturally, ask a short follow-up, refuse actual clinical advice and avoid claiming that a record was saved. Use mute or End Session to stop.

## Limits and failure behavior

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

The SQL tests apply the actual migration to a disposable PGlite PostgreSQL instance. They cover permissions, concurrency, one-time claims, rolling limits and non-refunded budget reservations. PGlite does not test Supabase's hosted PostgREST gateway or multi-connection lock contention; those remain hosted integration checks. Browser tests use synthetic microphone input and check anonymous navigation, SBAR fixtures, responsive overflow, unavailable service, microphone denial and unknown record IDs. They do not prove real voice/model behavior.

From `agent/`:

```powershell
uv run ruff check src tests
uv run ruff format --check src tests
uv run pytest
```

These cover bounded/validated leases, privacy room options and scripted lifecycle wiring: an admitted call starts with recording disabled and deletes the room, while an unreserved job never initializes inference. Mocked lifecycle tests do not establish language understanding or audio quality. `scenarios.yaml` defines fictional natural-symptom and clinical-advice-refusal checks for a later credentialed simulation. Extensive automation is deferred.

For live verification, use the actual browser path, then inspect content-free LiveKit status/logs. The generic debugger/console does not have a trusted database reservation; do not weaken admission to make it work. A future isolated SDK test harness can exercise the same Assistant with synthetic audio. Do not enable SDK DEBUG logging, transcript exports or recording to troubleshoot public participant input.

## Early deployment configuration

Milestone 1 is ready for a credentialed preview setup; no hosted deployment has been performed in this session.

1. Push this repository to your GitHub repository. Connect Vercel with **Root Directory = web**, package manager pnpm, build `pnpm build`. Add the web env variables in Vercel settings. Use a stable preview URL as `APP_ORIGIN` and redeploy after changing it. Microphone access needs HTTPS outside localhost.
2. Authenticate LiveKit CLI with `lk cloud auth`. From `agent/`, run `lk agent create --help` and create the cloud agent from this Dockerfile using the documented secret-file option for your CLI version. Keep generated `livekit.toml` project/agent IDs; never place secrets in it. Set the same dispatch name in both runtimes.
3. Add agent secrets from `agent/.env.local` through the CLI/LiveKit console secret settings. Verify the Build plan, model availability and Inference balance. Use a single hosted deployment; no paid deployment slots are needed for this preview.
4. Apply the Supabase migration, enable new calls, then complete a synthetic HTTPS microphone smoke test: start → assistant heard → visitor heard → mute → end → room removed. Check denied microphone, unavailable worker and rate/deadline failures. Keep examples accessible. Do not describe voice or cloud integration as verified until these pass.

No LiveKit/Supabase/Vercel credentials or linked cloud projects were available to this implementation session. Live audio, model safety behavior, hosted RLS/RPC integration and cloud deployment therefore remain unverified. See the milestone report for actual local check results.

## Starter and skill provenance

- Web foundation: [livekit-examples/agent-starter-react](https://github.com/livekit-examples/agent-starter-react), commit `9e1fc2f40fd7ceaccbe4a872b21765b49eefea80`. Reused dependency/config conventions and token endpoint foundation; replaced unrestricted token grants and removed unused starter features. MIT license retained in `web/LICENSE`.
- Python foundation: [livekit-examples/agent-starter-python](https://github.com/livekit-examples/agent-starter-python), commit `228095c442fcb259c80e9786fc0d7c5534e6af46`. Adapted AgentServer entry point, uv project and Dockerfile to native realtime and server reservations. MIT license retained in `agent/LICENSE`.
- Official [LiveKit Agent Skills](https://github.com/livekit/agent-skills), commit `e1195b497388b1aecad5dd2e9a0c9bdfbaba1878`, were installed manually by copying their skill directories into `agent/.agents/skills`, as supported by the [installation docs](https://docs.livekit.io/reference/developer-tools/agent-skills/). These are local developer tools excluded from Git; install them locally when needed. No global Codex settings were changed. The project-local CLI is 2.19.3 and installed Python SDK is 1.8.10.

Review the approved [project plan](PROJECT_PLAN.md). Stop after milestone 1; milestone 2 requires approval.
