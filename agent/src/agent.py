"""LiveKit lifecycle, trusted persistence and result-grounded spoken closing."""

import asyncio
import json
import logging
import os

import httpx
from dotenv import load_dotenv
from livekit import api
from livekit.agents import (
    AgentServer,
    AgentSession,
    AutoSubscribe,
    JobContext,
    cli,
    inference,
)

from config import Lease, Settings, room_options
from intake_agent import INSTRUCTIONS, OPENING, Assistant  # noqa: F401
from log_privacy import install_content_free_logging
from persistence import Finalizer

load_dotenv(".env.local")
logger = logging.getLogger("callaid")


async def rpc(settings: Settings, name: str, values: dict):
    # Secret keys stay in headers; response bodies and exceptions are never logged.
    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.post(
            f"{settings.supabase_url.rstrip('/')}/rest/v1/rpc/{name}",
            headers={
                "apikey": settings.supabase_secret_key.get_secret_value(),
                "Authorization": f"Bearer {settings.supabase_secret_key.get_secret_value()}",
            },
            json=values,
        )
        response.raise_for_status()
        return response.json() if response.content else None


server = AgentServer(log_level="WARN")


@server.rtc_session(agent_name=os.getenv("LIVEKIT_AGENT_NAME", "call-aid"))
async def entrypoint(ctx: JobContext):
    install_content_free_logging()
    try:
        settings = Settings()
        reservation = await rpc(
            settings, "claim_demo_session", {"p_room": ctx.room.name}
        )
        if not reservation:
            ctx.shutdown(reason="unreserved_or_expired")
            return
        lease = Lease.model_validate(reservation)
    except Exception:
        logger.warning("session_admission_unavailable")
        ctx.shutdown(reason="admission_unavailable")
        return

    session = AgentSession(
        llm=inference.RealtimeModel(
            model=settings.realtime_model, voice=settings.realtime_voice
        ),
        user_away_timeout=settings.idle_seconds,
    )
    stopped = asyncio.Event()
    turns = 0
    outcome = "aborted"

    async def send_report(payload):
        await ctx.room.local_participant.publish_data(
            json.dumps(payload).encode(),
            reliable=True,
            topic="callaid.sbar.v1",
            destination_identities=[lease.identity],
        )

    finalizer = Finalizer(
        ctx.room.name, lambda name, values: rpc(settings, name, values)
    )

    async def save_before_goodbye(workflow):
        return await asyncio.wait_for(
            finalizer.finalize(workflow, keep_active=True),
            timeout=min(20, lease.remaining()),
        )

    assistant = Assistant(
        on_report=send_report, on_finished=stopped.set, on_finalize=save_before_goodbye
    )
    assistant.bind(session)

    @ctx.room.on("data_received")
    def control(packet):
        if (
            packet.participant
            and packet.participant.identity == lease.identity
            and packet.topic == "callaid.control.v1"
            and packet.data == b"end"
        ):
            if control_tasks or stopped.is_set():
                return

            async def end_with_preview():
                await assistant.finish_incomplete()
                stopped.set()

            task = asyncio.create_task(end_with_preview())
            control_tasks.add(task)
            task.add_done_callback(control_tasks.discard)

    control_tasks = set()

    @session.on("user_state_changed")
    def user_state(event):
        if event.new_state == "away":
            stopped.set()

    @session.on("user_input_transcribed")
    def user_input(event):
        nonlocal turns
        if event.is_final:
            turns += 1
            if turns >= settings.max_user_turns:
                stopped.set()

    @session.on("close")
    def closed(_event):
        stopped.set()

    @session.on("error")
    def error(_event):
        nonlocal outcome
        outcome = "failed"
        stopped.set()

    @ctx.room.on("participant_connected")
    def participant_connected(participant):
        if participant.identity != lease.identity:
            stopped.set()

    @ctx.room.on("participant_disconnected")
    def participant_disconnected(_participant):
        stopped.set()

    try:
        # The whole connection/model lifecycle is bounded, even if the provider stalls.
        async with asyncio.timeout(lease.remaining()):
            await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
            await asyncio.wait_for(
                ctx.wait_for_participant(identity=lease.identity),
                timeout=min(45, lease.remaining()),
            )
            if any(
                p.identity != lease.identity
                for p in ctx.room.remote_participants.values()
            ):
                raise ValueError("unexpected participant")
            async with asyncio.timeout(min(lease.call_seconds, lease.remaining())):
                await session.start(
                    agent=assistant,
                    room=ctx.room,
                    room_options=room_options(lease.identity),
                    record=False,
                )
                await session.generate_reply(instructions=OPENING)
                await stopped.wait()
    except TimeoutError:
        outcome = "expired"
    except Exception:
        outcome = "failed"
        logger.warning("voice_session_failed")
    finally:
        for task in control_tasks:
            task.cancel()
        try:
            await asyncio.wait_for(session.aclose(), timeout=5)
        except Exception:
            pass
        room_closed = False
        try:
            await ctx.api.room.delete_room(api.DeleteRoomRequest(room=ctx.room.name))
            room_closed = True
        except Exception as error:
            room_closed = getattr(error, "code", None) == "not_found"
            # Do not free capacity early if cloud room shutdown is uncertain.
            if not room_closed:
                logger.warning("room_shutdown_unconfirmed")
        if room_closed:
            # Close/drain the SDK first so edits cannot race the database commit.
            # An unheard/unprocessed final correction cannot become completed.
            if (
                finalizer.result is None
                and assistant.latest_source
                and assistant.latest_source.sequence > assistant.workflow.last_sequence
            ):
                assistant.workflow.phase = "ended"
                assistant.workflow.reviewed = False
            try:
                await asyncio.wait_for(finalizer.finalize(assistant.workflow), 20)
            except Exception:
                logger.warning("record_finalization_unavailable")
            try:
                await rpc(
                    settings,
                    "finish_demo_session",
                    {"p_room": ctx.room.name, "p_status": outcome},
                )
            except Exception:
                logger.warning("session_status_write_failed")
        ctx.shutdown(reason="demonstration_ended")


if __name__ == "__main__":
    cli.run_app(server)
