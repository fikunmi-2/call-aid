# Manual LiveKit deployment from GitHub

This uses the official [livekit/deploy-action](https://github.com/livekit/deploy-action), pinned to reviewed v2 commit `31f4161e507defdf9e99779af95fcaf8c90115eb`. The workflow is [deploy-livekit.yml](../.github/workflows/deploy-livekit.yml), named **Deploy LiveKit agent (manual)**. It runs only when manually dispatched on `main`; pushes run ordinary tests but do not deploy this agent.

It always uses `OPERATION: deploy`, working directory `agent/`, the checked-in Dockerfile, and existing agent **CA_5zppKdPR3z8g** in project **call-aid-dev-j5qdhieo** (`us-east`). It has no create operation, paid-environment operation, telephony or external notification step. The pending agent is reused. Concurrent manual deployments queue rather than interrupting another deployment.

## Configure repository secrets yourself

Open [Call AId Actions secrets](https://github.com/fikunmi-2/call-aid/settings/secrets/actions). Under **Repository secrets**, choose **New repository secret** for each name below. Copy values directly from your existing local env/project dashboard into GitHub; do not paste values into chat, issues, workflow YAML or a commit. Paste just the value, without surrounding quotes or trailing whitespace.

| GitHub repository secret | Source and purpose |
| --- | --- |
| `LIVEKIT_URL` | Existing project WebSocket URL in `agent/.env.local`, matching `agent/livekit.toml` |
| `LIVEKIT_API_KEY` | Existing project API key; authorizes runner deployment |
| `LIVEKIT_API_SECRET` | Matching project API secret |
| `SUPABASE_URL` | Existing hosted Supabase project URL used by both web and agent |
| `SUPABASE_SECRET_KEY` | Existing server-only Supabase secret/service-role credential for trusted RPCs |

Exactly these **five repository secrets** are required. There is no need to add a `SECRET_LIST` secret: the workflow constructs the official action's runtime secret list from the two Supabase secrets and versioned non-sensitive configuration. LiveKit Cloud supplies its own LiveKit credentials to the running agent; they are used by the GitHub runner for deployment and are not added as runtime overrides.

Runtime non-secrets remain `LIVEKIT_AGENT_NAME=call-aid`, `REALTIME_MODEL=google/gemini-3.8-live`, `REALTIME_VOICE=Puck`, `IDLE_SECONDS=45`, `MAX_USER_TURNS=20`. Change these deliberately in the workflow if the tested configuration changes. No extra model-provider key is required for LiveKit Inference.

Do not supply a custom `GITHUB_TOKEN` secret or grant repository write permissions. GitHub provides the checkout token automatically; this deploy-only workflow needs only `contents: read`. No GitHub environment or paid runner is required. GitHub Actions' own hosted-runner allowances and LiveKit's existing Build quotas still apply.

## Trigger the deployment

1. Open [the manual deployment workflow](https://github.com/fikunmi-2/call-aid/actions/workflows/deploy-livekit.yml).
2. Choose **Run workflow**, select branch **main**, then **Run workflow** again.
3. Open the run. The preflight step must validate all five secrets and the existing agent binding. It prints names/errors only, never secret values.
4. The official action starts on GitHub's Ubuntu runner, uploads `agent/` to LiveKit's build service, builds the Python image there, and updates the existing agent. No deployment upload goes through the laptop or its ISP. TLS verification remains enabled, and no DNS override is configured.
5. The final official status step waits up to five minutes for `Running`. A green status is deployment evidence, not proof of a successful conversation. If a required secret is missing, add it and rerun the failed workflow; do not create another agent.

If GitHub asks you to enable Actions for this repository, enable ordinary repository Actions. Do not enable paid plans or third-party notification integrations. If the Run workflow button is absent, confirm this file is on the default `main` branch and you have repository write access.

## Verify after the run

Tell the engineering agent the run succeeded, or provide the run URL (not its secrets). It can inspect public Actions results and use the existing local project credentials to query agent status, version, secret names and bounded logs. `agent/livekit.toml` remains the binding; use `lk agent status` / `lk agent logs` from `agent/` in an authenticated CLI when inspecting manually. Stop the local Python worker before testing a browser call so the hosted agent must serve it.

Keep hosted web voice disabled until this agent is healthy. Then enable only the Preview for a bounded synthetic test: browser microphone → relevant intake → corrected/confirmed recap → actual Supabase save → accurate warm closing → generated link → same case in the public records list. Verify a newly created case. Final production resume/promotion and public judge access remain subject to owner approval.

On failure, inspect **Deploy existing agent** build logs and LiveKit status. Do not print/download env values into workflow artifacts, disable TLS, change DNS to arbitrary addresses, delete the pending agent or upgrade plans to work around a build error. The workflow does not store recordings or transcripts.
