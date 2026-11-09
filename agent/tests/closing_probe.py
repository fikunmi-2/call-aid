"""Opt-in real-model closing check, SYNTHETIC data and MOCKED database only.

From agent/: set CLOSING_PROBE_OUTCOME=published|withheld|failed, then
lk agent debugger start --audio tests/closing_probe.py
lk agent debugger say "Yes, that summary is accurate."
lk agent debugger stop
Consumes inference credits. Never use real patient input. Production never
uses this entrypoint or its mocked database. No Supabase operation occurs here.
"""

import os

from dotenv import load_dotenv
from livekit.agents import AgentServer, AgentSession, JobContext, cli, inference

from config import Settings
from intake_agent import Assistant
from intake_schema import Fact, PublishedSBARReport
from persistence import Finalizer

load_dotenv(".env.local")
server = AgentServer()


@server.rtc_session()
async def entrypoint(ctx: JobContext):
    settings = Settings()
    outcome = os.environ.get("CLOSING_PROBE_OUTCOME", "failed")
    if outcome not in ("published", "failed", "withheld"):
        raise ValueError("Choose a supported synthetic outcome")
    session = AgentSession(
        llm=inference.RealtimeModel(
            model=settings.realtime_model, voice=settings.realtime_voice
        )
    )

    async def mock_rpc(_operation, values):
        if outcome == "failed":
            raise ConnectionError("Synthetic database outage")
        if values["p_decision"] == "withheld":
            return {"publication": "withheld"}
        payload = values["p_payload"]
        payload = {
            **payload,
            "schema_version": "3.0",
            "publication": "published",
            "publication_policy_version": "public-1.0",
            "recommendation": dict(payload["recommendation"]),
        }
        rec = payload["recommendation"]
        rec["record_saved"] = True
        rec["actions"] = [*rec["actions"], "record_saved"]
        rec["text"] = (
            rec["text"]
            .replace(
                "The prototype prepared an intake recap.",
                "The prototype generated and saved this demonstration report.",
            )
            .replace(
                " No record was saved and no clinical recommendation was made.",
                " No clinical recommendation was made.",
            )
        )
        return {
            "publication": "published",
            "record": PublishedSBARReport.model_validate(payload).model_dump(
                mode="json"
            ),
        }

    finalizer = Finalizer("synthetic-probe-only", mock_rpc)
    assistant = Assistant(
        on_finalize=lambda workflow: finalizer.finalize(workflow, keep_active=True)
    )
    concern = os.environ.get("CLOSING_PROBE_CONCERN", "headache")
    if concern not in ("headache", "cough", "back_pain"):
        raise ValueError("Choose a supported synthetic concern")
    fields = {
        "chief_complaint": [concern],
        "onset": ["yesterday"],
        "duration": ["intermittent"],
        "progression": ["stable"],
        "severity": ["moderate"],
        "associated_symptoms": ["none_reported"],
        "background": ["no_similar_episode"],
    }
    conditional = {
        "headache": ("onset_pattern", "gradual"),
        "cough": ("breathing_difficulty", "no"),
        "back_pain": ("functional_impact", "some"),
    }
    key, value = conditional[concern]
    fields[key] = [value]
    if os.environ.get("CLOSING_PROBE_RICH") == "true":
        fields["associated_symptoms"] = ["nausea", "light_sensitivity", "dizziness"]
        fields["background"] = ["similar_episode", "sleep_change", "recent_exertion"]
    for key, values in fields.items():
        assistant.workflow.facts[key] = Fact(field=key, state="reported", values=values)
    assistant.workflow.publication_risk = outcome == "withheld"
    assistant.workflow.prepare_review()
    assistant.bind(session)
    await session.start(agent=assistant, room=ctx.room, record=False)
    handle = session.generate_reply(
        instructions="This is an automated synthetic check. Read this recap exactly, then ask if it is accurate or needs correcting. Do not close or save until the caller responds: "
        + assistant.workflow.recap()
    )
    assistant._observe_playout(handle, review=True)
    await handle


if __name__ == "__main__":
    cli.run_app(server)
