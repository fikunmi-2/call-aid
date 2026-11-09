"""Trusted facts for a naturally phrased closing, independent of LiveKit."""

from intake import IntakeWorkflow
from intake_schema import fact_text
from persistence import FinalizationResult

CLOSING_INSTRUCTIONS = """Give a brief, natural closing in your own words (about
three or four short sentences). Keep this order: symptom-specific empathy,
a warm wish, the actual save/publication result, then an explicit goodbye.
Acknowledge the supplied reported concern with gentle
empathy, and wish the caller well/that they feel better soon; this is a wish,
not medical reassurance. Use only the supplied concern, not invented symptoms.
Then explain the actual persistence result: published means the intake record
has been successfully saved and can be viewed in the Records Console; failed
means saving could not be completed/confirmed and they can try again; withheld
means the report could not be published and is not available in the public
console. If the saved record is incomplete, do not call the intake complete.
Finish with a friendly farewell that explicitly says goodbye. Vary the wording to fit the caller; do not
recite a stock script or repeat the recap. Never say temporary, repeat the
fiction/research disclaimer, promise nurse review or follow-up care, diagnose,
reassure that symptoms are safe, or give treatment advice. Never claim saved or
console availability unless the corresponding trusted flags are true."""


def closing_details(
    workflow: IntakeWorkflow, result: FinalizationResult | None
) -> dict:
    saved = bool(
        result
        and result.publication == "published"
        and result.case_id == workflow.case_id
        and result.status in ("completed", "incomplete")
    )
    publication = (
        "published"
        if saved
        else "withheld"
        if result and result.publication == "withheld"
        else "failed"
    )
    concern = workflow.facts.get("chief_complaint")
    return {
        "persistence_status": publication,
        "record_saved": saved,
        "public_console_available": saved,
        "record_status": result.status if saved else None,
        "reported_concern": fact_text(concern)
        if concern and concern.state == "reported"
        else None,
    }
