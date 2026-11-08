"""Scripted SDK boundary tests: proves lifecycle wiring, not model behavior."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

import agent


@pytest.mark.asyncio
@pytest.mark.parametrize("delete_error", [None, "not_found", "unavailable"])
async def test_reserved_audio_session_disables_recording_and_closes_room(delete_error):
    listeners = {}
    fake = SimpleNamespace(
        on=lambda event: lambda callback: listeners.setdefault(event, callback),
        aclose=AsyncMock(),
        generate_reply=AsyncMock(),
    )

    async def start(**kwargs):
        assert kwargs["record"] is False
        assert kwargs["room_options"].text_output is False
        listeners["user_state_changed"](SimpleNamespace(new_state="away"))

    fake.start = AsyncMock(side_effect=start)
    room = SimpleNamespace(name="synthetic-room", remote_participants={})
    room.on = lambda _event: lambda callback: callback
    ctx = SimpleNamespace(
        room=room,
        connect=AsyncMock(),
        wait_for_participant=AsyncMock(),
        api=SimpleNamespace(room=SimpleNamespace(delete_room=AsyncMock())),
        shutdown=lambda **_kwargs: None,
    )
    if delete_error:
        error = RuntimeError("synthetic service error")
        error.code = delete_error
        ctx.api.room.delete_room.side_effect = error
    lease = {
        "identity": "synthetic-visitor",
        "expires_at": (datetime.now(UTC) + timedelta(seconds=60)).isoformat(),
        "call_seconds": 30,
    }
    settings = SimpleNamespace(
        realtime_model="google/gemini-3.8-live",
        realtime_voice="Puck",
        idle_seconds=45,
        max_user_turns=20,
    )
    calls = AsyncMock(side_effect=[lease, None])
    with (
        patch.object(agent, "Settings", return_value=settings),
        patch.object(agent, "rpc", calls),
        patch.object(agent, "AgentSession", return_value=fake),
        patch.object(agent.inference, "RealtimeModel", return_value=None),
    ):
        await agent.entrypoint(ctx)
    ctx.connect.assert_awaited_once()
    ctx.wait_for_participant.assert_awaited_once_with(identity="synthetic-visitor")
    fake.start.assert_awaited_once()
    fake.aclose.assert_awaited_once()
    ctx.api.room.delete_room.assert_awaited_once()
    if delete_error == "unavailable":
        assert (
            calls.await_count == 1
        )  # Keep the lease until expiry on uncertain shutdown.
    else:
        assert calls.await_args_list[-1].args[1] == "finish_demo_session"


@pytest.mark.asyncio
async def test_unreserved_job_never_initializes_model_or_connects():
    ctx = SimpleNamespace(
        room=SimpleNamespace(name="unknown-room"),
        connect=AsyncMock(),
        shutdown=lambda **_kwargs: None,
    )
    with (
        patch.object(agent, "Settings", return_value=object()),
        patch.object(agent, "rpc", AsyncMock(return_value=None)),
        patch.object(agent.inference, "RealtimeModel") as model,
    ):
        await agent.entrypoint(ctx)
    ctx.connect.assert_not_awaited()
    model.assert_not_called()
