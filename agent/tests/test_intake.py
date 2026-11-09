"""Synthetic domain tests: state, grounding, review, and deterministic screening."""

import json

import pytest
from pydantic import ValidationError

from intake import IntakeWorkflow, SourceTurn
from intake_schema import Fact, SBARReport, TurnRequest
from sbar import generate_sbar


def turn(workflow, values=None, intent="continue", text=None, **kwargs):
    values = values or {}
    text = text or " ".join(str(v) for v in values.values()) or intent
    updates = [
        {
            "field": field,
            "state": "unknown" if value is None else "reported",
            "values": []
            if value is None
            else value
            if isinstance(value, list)
            else [value],
            "evidence_quote": text,
        }
        for field, value in values.items()
    ]
    return workflow.apply(
        TurnRequest(intent=intent, updates=updates, **kwargs),
        SourceTurn(f"turn-{workflow.turns + 1}", workflow.last_sequence + 1, text),
    )


@pytest.mark.parametrize(
    "complaint,probe",
    [
        ("cough", "breathing_difficulty"),
        ("headache", "onset_pattern"),
        ("abdominal_pain", "vomiting"),
        ("fatigue", "sleep_change"),
        ("back_pain", "functional_impact"),
    ],
)
def test_relevant_conditional_question(complaint, probe):
    workflow = IntakeWorkflow()
    step = turn(workflow, {"chief_complaint": complaint, "onset": "yesterday"})
    assert step.field == probe
    assert step.question.count("?") == 1


def complete_answers(workflow, complaint="headache"):
    return turn(
        workflow,
        {
            "chief_complaint": complaint,
            "onset": "today",
            "duration": "hours",
            "progression": "stable",
            "severity": "moderate",
            "associated_symptoms": ["light_sensitivity"],
            "background": ["similar_episode"],
            "onset_pattern": "gradual",
        },
    )


def test_review_requires_delivery_and_later_confirmation_then_generates_sbar():
    workflow = IntakeWorkflow()
    step = complete_answers(workflow)
    assert step.kind == "review"
    assert generate_sbar(workflow).status == "review_pending"
    assert turn(workflow, intent="confirm").kind == "review"
    assert not workflow.reviewed
    assert not workflow.mark_review_delivered(
        workflow.revision, workflow.recap(), interrupted=True
    )
    assert not workflow.mark_review_delivered(workflow.revision, "a made up recap")
    assert workflow.mark_review_delivered(workflow.revision, workflow.recap())
    assert turn(workflow, intent="confirm").kind == "completed"
    report = generate_sbar(workflow)
    assert report.status == "completed"
    assert report.recommendation.record_saved is False
    assert report.publication == "not_published"
    assert "not a diagnosis" in report.assessment.disclaimer


def test_correction_invalidates_review_and_preserves_other_fields():
    workflow = IntakeWorkflow()
    complete_answers(workflow)
    revision = workflow.revision
    workflow.mark_review_delivered(revision, workflow.recap())
    turn(workflow, {"onset": "yesterday"})
    assert workflow.revision == revision + 1
    assert not workflow.review_delivered
    assert workflow.facts["severity"].values == ["moderate"]
    assert not workflow.mark_review_delivered(revision, workflow.recap())
    turn(workflow, intent="confirm")
    assert not workflow.reviewed
    assert "yesterday" in generate_sbar(workflow).background.text


def test_identical_update_does_not_change_revision():
    workflow = IntakeWorkflow()
    complete_answers(workflow)
    workflow.mark_review_delivered(workflow.revision, workflow.recap())
    revision = workflow.revision
    turn(workflow, {"severity": "moderate"}, intent="confirm")
    assert workflow.reviewed
    assert workflow.revision == revision


def test_evidence_must_be_current_and_failed_updates_are_atomic():
    workflow = IntakeWorkflow()
    request = TurnRequest(
        updates=[
            {
                "field": "chief_complaint",
                "state": "reported",
                "values": ["cough"],
                "evidence_quote": "I have a cough",
            }
        ]
    )
    with pytest.raises(ValueError, match="Evidence"):
        workflow.apply(request, SourceTurn("t1", 1, "I have a headache"))
    assert not workflow.facts and workflow.turns == 0
    workflow.apply(request, SourceTurn("t1", 1, "I have a cough"))
    with pytest.raises(ValueError, match="later actual caller"):
        workflow.apply(request, SourceTurn("t1", 1, "I have a cough"))


def test_unknown_declined_and_unclear_answers_are_not_negative_facts():
    workflow = IntakeWorkflow()
    turn(workflow, {"chief_complaint": "cough", "onset": None})
    turn(workflow, intent="clarify")
    step = turn(workflow, intent="clarify")
    assert workflow.facts["breathing_difficulty"].state == "unknown"
    assert step.field == "duration"
    workflow.apply(
        TurnRequest(
            updates=[
                {
                    "field": "duration",
                    "state": "declined",
                    "evidence_quote": "I'd rather skip that",
                }
            ]
        ),
        SourceTurn("t4", 4, "I'd rather skip that"),
    )
    workflow.finish_incomplete()
    report = generate_sbar(workflow)
    assert "onset" in report.assessment.missing_information
    assert "breathing_difficulty" in report.assessment.missing_information
    assert "not provided" in report.background.text
    assert report.status == "incomplete"
    assert "breathing difficulty denied" not in report.model_dump_json()


@pytest.mark.parametrize(
    "updates,flag",
    [
        (
            {"chief_complaint": "cough", "breathing_difficulty": "yes"},
            "DEMO_BREATHING_REPORTED",
        ),
        (
            {"chief_complaint": "headache", "onset_pattern": "sudden"},
            "DEMO_SUDDEN_HEADACHE",
        ),
        (
            {"chief_complaint": "abdominal_pain", "severity": "severe"},
            "DEMO_MAJOR_IMPACT",
        ),
        ({"chief_complaint": "fatigue", "progression": "worsening"}, "DEMO_WORSENING"),
    ],
)
def test_deterministic_simulation_markers(updates, flag):
    workflow = IntakeWorkflow()
    turn(workflow, updates)
    report = generate_sbar(workflow)
    assert flag in [f.code for f in report.assessment.simulated_flags]
    assert report.rules_version == "demo-rules-1.0"
    assert all(
        f.label.startswith("Simulated") for f in report.assessment.simulated_flags
    )
    assert "triage" in report.assessment.disclaimer


def test_rules_do_not_treat_missing_values_as_denials_or_clearance():
    workflow = IntakeWorkflow()
    turn(workflow, {"chief_complaint": "cough", "breathing_difficulty": "no"})
    codes = [f.code for f in generate_sbar(workflow).assessment.simulated_flags]
    assert codes == ["DEMO_INCOMPLETE"]


@pytest.mark.parametrize(
    "bad",
    [
        {
            "field": "chief_complaint",
            "state": "reported",
            "values": ["Alice at 12 Main St"],
        },
        {"field": "onset", "state": "unknown", "values": ["today"]},
        {
            "field": "associated_symptoms",
            "state": "reported",
            "values": ["none_reported", "nausea"],
        },
        {
            "field": "severity",
            "state": "reported",
            "values": ["mild"],
            "diagnosis": "flu",
        },
    ],
)
def test_unrestricted_content_and_inconsistent_values_rejected(bad):
    with pytest.raises(ValidationError):
        Fact.model_validate(bad)


def test_transient_evidence_and_identifiers_never_enter_report():
    workflow = IntakeWorkflow()
    turn(
        workflow,
        {"chief_complaint": "cough"},
        text="I'm Synthetic Person at 123 Example Street and have a cough",
    )
    report = generate_sbar(workflow)
    serialized = report.model_dump_json()
    assert "Synthetic Person" not in serialized and "123 Example" not in serialized
    assert "evidence_quote" not in serialized
    assert report.demonstration_label.startswith("Demo Case ")
    assert "source" not in json.dumps(workflow.facts, default=str)


def test_explicit_early_end_and_bounded_workflow():
    workflow = IntakeWorkflow(max_turns=2)
    turn(workflow, {"chief_complaint": "fatigue"})
    assert turn(workflow, {"onset": "within_week"}).kind == "review"
    turn(workflow, intent="end")
    assert generate_sbar(workflow).status == "incomplete"
    assert not workflow.reviewed


def test_education_and_actual_advice_request_preserve_intake():
    workflow = IntakeWorkflow()
    step = turn(workflow, intent="education", education_topic="cough")
    assert "reflex" in step.information and step.field == "chief_complaint"
    step = turn(workflow, intent="clinical_advice")
    assert "cannot diagnose" in step.information
    assert workflow.facts == {}


def test_conflicting_reports_require_clarification_before_completion():
    workflow = IntakeWorkflow()
    step = turn(
        workflow,
        {
            "chief_complaint": "cough",
            "breathing_difficulty": "no",
            "associated_symptoms": ["breathlessness"],
        },
    )
    assert "conflicting" in step.question
    assert "breathing_difficulty" in workflow.missing()
    turn(workflow, intent="recap")
    workflow.mark_review_delivered(workflow.revision, workflow.recap())
    assert turn(workflow, intent="confirm").field == "breathing_difficulty"
    assert not workflow.reviewed
    turn(workflow, {"breathing_difficulty": "yes"})
    assert workflow.contradiction() is None


def test_sbar_revalidation_rejects_unrestricted_narrative_and_fabricated_flags():
    workflow = IntakeWorkflow()
    complete_answers(workflow)
    valid = generate_sbar(workflow).model_dump(mode="json")
    valid["situation"]["text"] = "A specific person has a diagnosed illness"
    with pytest.raises(ValidationError):
        SBARReport.model_validate(valid)
    valid = generate_sbar(workflow).model_dump(mode="json")
    valid["assessment"]["simulated_flags"][0]["label"] = "Clinically urgent"
    with pytest.raises(ValidationError):
        SBARReport.model_validate(valid)
