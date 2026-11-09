"""Actual SDK objects, synthetic messages: adapter wiring, not model semantics."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from livekit.agents.llm import ChatMessage

from intake_agent import Assistant
from intake_schema import TurnRequest


def message(assistant, role, text, interrupted=False):
    assistant.conversation_item_added(
        SimpleNamespace(
            item=ChatMessage(
                role=role,
                content=[text],
                interrupted=interrupted,
            )
        )
    )


class Speech:
    interrupted = False

    def add_done_callback(self, callback):
        self.callback = callback


@pytest.mark.asyncio
async def test_sdk_tool_uses_committed_caller_source_and_sends_only_sanitized_report():
    send = AsyncMock()
    assistant = Assistant(on_report=send)
    message(assistant, "assistant", "Do you have a cough?")
    message(assistant, "user", "A cough since yesterday. My name is Synthetic Alice.")
    result = await assistant.record_turn(
        SimpleNamespace(speech_handle=Speech()),
        TurnRequest(
            updates=[
                {
                    "field": "chief_complaint",
                    "state": "reported",
                    "values": ["cough"],
                    "evidence_quote": "A cough",
                },
                {
                    "field": "onset",
                    "state": "reported",
                    "values": ["yesterday"],
                    "evidence_quote": "since yesterday",
                },
            ]
        ),
    )
    assert result["question_field"] == "breathing_difficulty"
    payload = send.call_args.args[0]
    assert "Synthetic Alice" not in str(payload)
    assert "evidence_quote" not in str(payload)
    assert payload["recommendation"]["record_saved"] is False


@pytest.mark.asyncio
async def test_review_receipt_depends_on_actual_noninterrupted_assistant_playout():
    assistant = Assistant()
    speech = Speech()
    message(assistant, "user", "Please give me a recap")
    result = await assistant.record_turn(
        SimpleNamespace(speech_handle=speech), TurnRequest(intent="recap")
    )
    assert not assistant.workflow.review_delivered
    message(assistant, "assistant", result["recap_read_exactly"])
    speech.callback(speech)
    assert assistant.workflow.review_delivered
    message(assistant, "user", "Actually, I have a headache")
    await assistant.record_turn(
        SimpleNamespace(speech_handle=Speech()),
        TurnRequest(
            updates=[
                {
                    "field": "chief_complaint",
                    "state": "reported",
                    "values": ["headache"],
                    "evidence_quote": "I have a headache",
                },
            ]
        ),
    )
    assert not assistant.workflow.review_delivered


@pytest.mark.asyncio
async def test_interrupted_recap_cannot_be_confirmed_and_disconnect_keeps_partial():
    assistant = Assistant()
    speech = Speech()
    message(assistant, "user", "Recap please")
    result = await assistant.record_turn(
        SimpleNamespace(speech_handle=speech), TurnRequest(intent="recap")
    )
    message(assistant, "assistant", result["recap_read_exactly"], interrupted=True)
    speech.interrupted = True
    speech.callback(speech)
    assert not assistant.workflow.review_delivered
    report = await assistant.finish_incomplete()
    assert report.status == "incomplete" and not report.reviewed
    assert assistant.latest_source is None


@pytest.mark.asyncio
async def test_split_audio_transcriptions_support_the_same_unconsumed_answer():
    assistant = Assistant()
    message(assistant, "user", "I have a cough since yesterday.")
    message(assistant, "user", "It is mild and I can breathe normally.")
    result = await assistant.record_turn(
        SimpleNamespace(speech_handle=Speech()),
        TurnRequest(
            updates=[
                {
                    "field": "chief_complaint",
                    "state": "reported",
                    "values": ["cough"],
                    "evidence_quote": "I have a cough",
                },
                {
                    "field": "onset",
                    "state": "reported",
                    "values": ["yesterday"],
                    "evidence_quote": "since yesterday",
                },
                {
                    "field": "severity",
                    "state": "reported",
                    "values": ["mild"],
                    "evidence_quote": "It is mild",
                },
            ]
        ),
    )
    assert result["question_field"] == "breathing_difficulty"
    message(assistant, "user", "No difficulty breathing")
    assert "cough" not in assistant.latest_source.text


@pytest.mark.asyncio
async def test_repeated_ungrounded_tool_updates_fall_back_to_one_clarification():
    assistant = Assistant()
    message(assistant, "user", "An unclear answer")
    bad = TurnRequest(
        updates=[
            {
                "field": "chief_complaint",
                "state": "reported",
                "values": ["cough"],
                "evidence_quote": "I have a cough",
            }
        ]
    )
    context = SimpleNamespace(speech_handle=Speech())
    assert "error" in await assistant.record_turn(context, bad)
    result = await assistant.record_turn(context, bad)
    assert result["question_field"] == "chief_complaint"
    assert result["phase"] == "question"
    assert not assistant.workflow.facts
    assert assistant.workflow.turns == 1
