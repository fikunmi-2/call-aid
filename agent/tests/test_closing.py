"""Closing authority follows trusted persistence, never an LLM assertion."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from test_intake_agent import Speech, message

from closing import closing_details
from intake import IntakeWorkflow
from intake_agent import Assistant
from intake_schema import Fact, TurnRequest
from persistence import FinalizationResult, Finalizer


def reviewed_workflow():
    workflow = IntakeWorkflow()
    workflow.facts["chief_complaint"] = Fact(
        field="chief_complaint", state="reported", values=["headache"]
    )
    workflow.prepare_review()
    assert workflow.mark_review_delivered(workflow.revision, workflow.recap())
    return workflow


@pytest.mark.parametrize("status", ["published", "failed", "withheld"])
def test_closing_authority_and_symptom_come_from_backend_and_validated_facts(status):
    workflow = reviewed_workflow()
    result = FinalizationResult(
        status,
        workflow.case_id if status == "published" else None,
        "incomplete" if status == "published" else None,
    )
    details = closing_details(workflow, result)
    assert details["record_saved"] is (status == "published")
    assert details["public_console_available"] is (status == "published")
    assert details["reported_concern"] == "headache"
    assert details["persistence_status"] == status


def test_mismatched_or_missing_backend_confirmation_cannot_authorize_saved_speech():
    workflow = reviewed_workflow()
    for result in (
        None,
        FinalizationResult("published", "different-case", "completed"),
        FinalizationResult("published", workflow.case_id, None),
    ):
        assert closing_details(workflow, result)["record_saved"] is False


@pytest.mark.asyncio
@pytest.mark.parametrize("publication", ["published", "failed", "withheld"])
async def test_tool_waits_for_database_result_before_returning_closing_and_waits_for_audio_before_shutdown(
    publication,
):
    started = asyncio.Event()
    release = asyncio.Event()

    async def finalize(workflow):
        started.set()
        await release.wait()
        return FinalizationResult(
            publication,
            workflow.case_id if publication == "published" else None,
            "incomplete" if publication == "published" else None,
        )

    # The real runtime callback is synchronous (Event.set).
    closed = []
    assistant = Assistant(on_finalize=finalize, on_finished=lambda: closed.append(True))
    assistant.workflow = reviewed_workflow()
    message(assistant, "user", "Yes, that is accurate")
    speech = Speech()
    task = asyncio.create_task(
        assistant.record_turn(
            SimpleNamespace(speech_handle=speech), TurnRequest(intent="confirm")
        )
    )
    await started.wait()
    assert not task.done() and not closed
    release.set()
    result = await task
    assert result["closing"]["persistence_status"] == publication
    assert result["record_saved"] is (publication == "published")
    assert not closed
    speech.callback(speech)
    assert closed == [True]


@pytest.mark.asyncio
async def test_unconfirmed_or_interrupted_review_never_starts_saving():
    finalize = AsyncMock()
    assistant = Assistant(on_finalize=finalize)
    assistant.workflow = reviewed_workflow()
    assistant.workflow.review_delivered = False
    message(assistant, "user", "Yes")
    result = await assistant.record_turn(
        SimpleNamespace(speech_handle=Speech()), TurnRequest(intent="confirm")
    )
    assert result["phase"] == "review"
    finalize.assert_not_awaited()


@pytest.mark.asyncio
async def test_backend_exception_gives_failure_closing_not_success():
    assistant = Assistant(on_finalize=AsyncMock(side_effect=ConnectionError()))
    assistant.workflow = reviewed_workflow()
    message(assistant, "user", "Yes")
    result = await assistant.record_turn(
        SimpleNamespace(speech_handle=Speech()), TurnRequest(intent="confirm")
    )
    assert result["closing"]["persistence_status"] == "failed"
    assert result["record_saved"] is False


@pytest.mark.asyncio
async def test_real_finalizer_callback_keeps_confirmed_saved_json_for_the_closing():
    from test_persistence import finished, saved

    workflow = finished()
    workflow.prepare_review()
    assert workflow.mark_review_delivered(workflow.revision, workflow.recap())
    rpc = AsyncMock(return_value=saved())
    finalizer = Finalizer("trusted-room", rpc)
    send = AsyncMock()
    assistant = Assistant(
        on_report=send,
        on_finalize=lambda workflow: finalizer.finalize(workflow, keep_active=True),
    )
    assistant.workflow = workflow
    message(assistant, "user", "Yes, that is accurate")
    result = await assistant.record_turn(
        SimpleNamespace(speech_handle=Speech()), TurnRequest(intent="confirm")
    )
    assert rpc.call_args.args[0] == "save_demo_record_for_closing"
    assert result["record_saved"] is True
    final_payload = send.call_args.args[0]
    assert final_payload["recommendation"]["record_saved"] is True
    assert "temporary" not in final_payload["recommendation"]["text"]
    assert "No record was saved" not in final_payload["recommendation"]["text"]
    await assistant.finish_incomplete()
    assert send.call_args.args[0]["publication"] == "published"
