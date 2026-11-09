"""Deterministic generalized SBAR. No model-generated narrative or persistence."""

from datetime import UTC, datetime

from intake import IntakeWorkflow
from intake_schema import (
    LABELS,
    Assessment,
    Fact,
    Recommendation,
    SBARReport,
    Section,
    fact_text,
)
from rules import screen


def generate_sbar(workflow: IntakeWorkflow) -> SBARReport:
    facts = workflow.facts
    missing = workflow.missing()
    completed = workflow.phase == "completed" and workflow.reviewed and not missing
    status = (
        "completed"
        if completed
        else "review_pending"
        if workflow.phase == "review"
        else "incomplete"
    )

    def section(keys: list[str]) -> Section:
        items = [facts.get(k, Fact(field=k, state="unknown")) for k in keys]
        return Section(
            text=" ".join(f"{LABELS[f.field]}: {fact_text(f)}." for f in items),
            facts=items,
        )

    situation = section(["chief_complaint"])
    background = section(["onset", "duration", "associated_symptoms", "background"])
    observation_keys = ["progression"] + [
        k
        for k in [
            "severity",
            "functional_impact",
            "onset_pattern",
            "breathing_difficulty",
            "vomiting",
            "sleep_change",
        ]
        if k in facts or k in workflow.requirements()
    ]
    observations = section(observation_keys)
    actions = ["recap_prepared"]
    if workflow.reviewed:
        actions.append("caller_reviewed")
    if not completed:
        actions.append("session_incomplete")
    return SBARReport(
        case_id=workflow.case_id,
        demonstration_label="Demo Case " + workflow.case_id[:6].upper(),
        started_on=workflow.started_on,
        generated_on=datetime.now(UTC).date().isoformat(),
        status=status,
        reviewed=workflow.reviewed,
        situation=situation,
        background=background,
        assessment=Assessment(
            **observations.model_dump(),
            missing_information=missing,
            simulated_flags=screen(facts, not completed),
        ),
        recommendation=Recommendation(
            text="The prototype prepared a temporary recap."
            + (
                " The caller reviewed it."
                if workflow.reviewed
                else " It has not been confirmed by the caller."
            )
            + (" Important information is incomplete." if missing else "")
            + " No record was saved and no clinical recommendation was made.",
            actions=actions,
            approved_information_ids=workflow.information_ids,
        ),
    )
