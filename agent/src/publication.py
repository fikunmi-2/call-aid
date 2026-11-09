"""Fail-closed publication policy. No model text or evidence enters the DTO."""

import re

from intake_schema import SBARReport

VERSION = "public-1.0"
COMMON_ASSOCIATED = {
    "fatigue",
    "feverish",
    "nausea",
    "vomiting",
    "light_sensitivity",
    "sore_throat",
    "breathlessness",
    "cough",
    "headache",
    "none_reported",
}
COMMON_BACKGROUND = {
    "similar_episode",
    "no_similar_episode",
    "sleep_change",
    "recent_exertion",
    "recent_illness",
    "none_reported",
}


def source_has_identifiers(text: str) -> bool:
    # Additional rejection signals only. These patterns do not prove anonymity
    # or classify medical intent. Do not retain or log their matches.
    return any(
        re.search(pattern, text, re.IGNORECASE)
        for pattern in (
            r"[\w.+-]+@[\w.-]+\.[a-z]{2,}",
            r"\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b",
            r"\b\d[\d ()-]{7,}\d\b",
        )
    )


def validate_publication(report: SBARReport, *, risk: bool = False) -> str | None:
    """Return a content-free rejection code or None. Absence of identifiers is
    insufficient: only this low-detail, common-category projection is allowed.
    This policy reduces disclosure; it does not prove a speaker is fictional.
    """
    report = SBARReport.model_validate(report.model_dump(mode="json"))
    if risk:
        return "privacy_or_scope"
    if report.status == "review_pending":
        return "not_final"
    facts = {
        f.field: f
        for section in (report.situation, report.background, report.assessment)
        for f in section.facts
    }
    chief = facts.get("chief_complaint")
    if not chief or chief.state != "reported" or chief.values == ["other"]:
        return "insufficient_information"
    associated = facts["associated_symptoms"].values
    background = facts["background"].values
    if len(associated) > 2 or not set(associated) <= COMMON_ASSOCIATED:
        return "specific_combination"
    if len(background) > 1 or not set(background) <= COMMON_BACKGROUND:
        return "specific_combination"
    if sum(len(f.values) for f in facts.values()) > 12:
        return "specific_combination"
    if any(value == "other" for f in facts.values() for value in f.values):
        return "unsupported_context"
    return None
