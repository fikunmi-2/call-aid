import asyncio
import json
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from intake import IntakeWorkflow
from intake_schema import Fact, PublishedSBARReport
from persistence import Finalizer
from publication import source_has_identifiers, validate_publication
from sbar import generate_sbar

FIXTURES = Path(__file__).resolve().parents[2] / "contracts/fixtures"


def finished():
    data = json.loads((FIXTURES / "completed.json").read_text())
    workflow = IntakeWorkflow()
    workflow.case_id = data["case_id"]
    for section in ("situation", "background", "assessment"):
        for fact in data[section]["facts"]:
            workflow.facts[fact["field"]] = Fact.model_validate(fact)
    workflow.phase = "completed"
    workflow.reviewed = True
    return workflow


def saved():
    return {
        "publication": "published",
        "record": json.loads((FIXTURES / "published.json").read_text()),
    }


@pytest.mark.asyncio
async def test_concurrent_finalization_commits_once_and_only_returns_confirmed_case():
    workflow = finished()
    rpc = AsyncMock(return_value=saved())
    finalizer = Finalizer("trusted-room", rpc)
    first, second = await asyncio.gather(
        finalizer.finalize(workflow), finalizer.finalize(workflow)
    )
    assert first == second and first.case_id == workflow.case_id
    rpc.assert_awaited_once()
    candidate = rpc.call_args.args[1]["p_payload"]
    assert candidate["publication"] == "not_published"
    assert candidate["recommendation"]["record_saved"] is False
    assert "room" not in candidate
    PublishedSBARReport.model_validate(saved()["record"])


@pytest.mark.asyncio
async def test_ambiguous_response_retry_uses_identical_payload_and_case_id():
    rpc = AsyncMock(side_effect=[TimeoutError(), saved()])
    workflow = finished()
    result = await Finalizer("trusted-room", rpc).finalize(workflow)
    assert result.publication == "published"
    assert rpc.call_args_list[0].args[1] == rpc.call_args_list[1].args[1]


@pytest.mark.asyncio
async def test_database_failure_never_claims_saved_or_returns_a_case_link():
    rpc = AsyncMock(side_effect=ConnectionError())
    result = await Finalizer("trusted-room", rpc).finalize(finished())
    assert result.publication == "failed" and result.case_id is None
    assert rpc.await_count == 3
    assert rpc.call_args.args[1]["p_decision"] == "failed"


@pytest.mark.asyncio
async def test_lost_write_responses_recover_an_existing_confirmed_record():
    workflow = finished()
    rpc = AsyncMock(side_effect=[TimeoutError(), TimeoutError(), saved()])
    result = await Finalizer("trusted-room", rpc).finalize(workflow)
    assert result.publication == "published" and result.case_id == workflow.case_id
    assert workflow.record.recommendation.record_saved is True


@pytest.mark.asyncio
async def test_privacy_signal_withholds_without_sending_content_to_database():
    workflow = finished()
    workflow.publication_risk = True
    rpc = AsyncMock(return_value={"publication": "withheld"})
    result = await Finalizer("trusted-room", rpc).finalize(workflow)
    assert result.publication == "withheld" and result.case_id is None
    assert rpc.call_args.args[1]["p_payload"] is None


def test_publication_rejects_specific_combinations_and_uninformative_partials():
    workflow = finished()
    assert validate_publication(generate_sbar(workflow)) is None
    workflow.facts["associated_symptoms"] = Fact(
        field="associated_symptoms",
        state="reported",
        values=["nausea", "vomiting", "light_sensitivity"],
    )
    assert validate_publication(generate_sbar(workflow)) == "specific_combination"
    empty = IntakeWorkflow()
    empty.finish_incomplete()
    assert validate_publication(generate_sbar(empty)) == "insufficient_information"


@pytest.mark.parametrize(
    "text",
    [
        "email synthetic@example.invalid",
        "postal S0A 0A0",
        "health number 123456789",
        "call 306-555-0100",
    ],
)
def test_obvious_identifier_signals_only_reject(text):
    assert source_has_identifiers(text)
    assert not source_has_identifiers("A mild cough started yesterday")
