"""Synthetic regression cases for category-preserving public projection."""

import json
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError
from test_intake import turn
from test_persistence import finished

from intake import IntakeWorkflow
from intake_schema import VALUES, Fact, PublishedSBARReport, SBARReport
from persistence import Finalizer
from publication import prepare_publication
from sbar import generate_sbar


def rich_workflow():
    workflow = finished()
    for field, values in {
        "associated_symptoms": ["nausea", "light_sensitivity", "dizziness", "weakness"],
        "background": [
            "similar_episode",
            "sleep_change",
            "recent_exertion",
            "health_context",
            "medication_context",
        ],
        "functional_impact": ["some"],
    }.items():
        workflow.facts[field] = Fact(field=field, state="reported", values=values)
    return workflow


def saved_response(_operation, args):
    data = json.loads(json.dumps(args["p_payload"]))
    data.update(
        schema_version="3.0",
        publication="published",
        publication_policy_version="public-1.0",
    )
    rec = data["recommendation"]
    rec["record_saved"] = True
    rec["actions"].append("record_saved")
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
        "record": PublishedSBARReport.model_validate(data).model_dump(mode="json"),
    }


@pytest.mark.asyncio
async def test_complex_completed_intake_saves_all_categories_without_count_rejections():
    workflow = rich_workflow()
    assert sum(len(f.values) for f in workflow.facts.values()) > 12
    rpc = AsyncMock(side_effect=saved_response)
    result = await Finalizer("trusted-room", rpc).finalize(workflow, keep_active=True)
    assert result.publication == "published" and result.status == "completed"
    assert workflow.record.recommendation.record_saved is True
    sent = SBARReport.model_validate(rpc.call_args.args[1]["p_payload"])
    facts = {
        f.field: f
        for s in (sent.situation, sent.background, sent.assessment)
        for f in s.facts
    }
    for field, fact in workflow.facts.items():
        assert facts[field] == fact
    assert sent.assessment.public_data_handling.details_omitted
    assert result.case_id == workflow.case_id


@pytest.mark.parametrize("field", ["associated_symptoms", "background"])
def test_every_approved_category_survives(field):
    for category in VALUES[field]:
        workflow = finished()
        workflow.facts[field] = Fact(field=field, state="reported", values=[category])
        report = prepare_publication(generate_sbar(workflow))
        assert next(f for f in report.background.facts if f.field == field).values == [
            category
        ]


@pytest.mark.asyncio
async def test_specific_details_generalize_without_publishing_identifiers_or_source_quotes():
    workflow = IntakeWorkflow()
    turn(
        workflow,
        {
            "chief_complaint": "other",
            "background": ["health_context", "medication_context", "other"],
        },
        text="Synthetic Person at 123 Example Street, synthetic@example.invalid, health ID 123456789: unusual concern and private health and medication details",
        identifying_details=True,
    )
    workflow.finish_incomplete()
    rpc = AsyncMock(side_effect=saved_response)
    result = await Finalizer("trusted-room", rpc).finalize(workflow)
    assert result.publication == "published" and result.status == "incomplete"
    public = workflow.record.model_dump_json()
    for forbidden in (
        "Synthetic Person",
        "123 Example",
        "example.invalid",
        "123456789",
        "evidence_quote",
        "private health",
        "trusted-room",
    ):
        assert forbidden not in public
    assert (
        "another concern" in public
        and "medication context (details not retained)" in public
    )
    assert workflow.record.assessment.public_data_handling.details_omitted
    assert workflow.record.assessment.missing_information


@pytest.mark.asyncio
async def test_empty_or_incomplete_intake_can_save_a_minimal_unknown_report():
    workflow = IntakeWorkflow()
    rpc = AsyncMock(side_effect=saved_response)
    result = await Finalizer("trusted-room", rpc).finalize(workflow)
    assert result.publication == "published" and result.status == "incomplete"
    assert workflow.record.situation.facts[0].state == "unknown"
    assert not workflow.record.reviewed


def test_unvalidated_free_text_cannot_be_a_public_fallback():
    report = prepare_publication(generate_sbar(rich_workflow())).model_dump(mode="json")
    report["assessment"]["public_data_handling"]["notes"] = "Synthetic Person"
    with pytest.raises(ValidationError):
        SBARReport.model_validate(report)
    with pytest.raises(ValidationError):
        Fact(field="background", state="reported", values=["Synthetic Person"])


@pytest.mark.asyncio
async def test_invalid_application_state_is_a_technical_failure_without_raw_fallback():
    workflow = finished()
    workflow.facts["chief_complaint"] = Fact.model_construct(
        field="chief_complaint", state="reported", values=["private arbitrary content"]
    )
    rpc = AsyncMock(return_value={"publication": "failed"})
    result = await Finalizer("trusted-room", rpc).finalize(workflow)
    assert result.publication == "failed" and result.case_id is None
    assert rpc.call_args.args[1]["p_payload"] is None
