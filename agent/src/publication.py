"""Constrained field-level projection. No source text or evidence enters the DTO."""

import re

from intake_schema import PublicDataHandling, SBARReport

VERSION = "projection-1.1"


def source_has_identifiers(text: str) -> bool:
    # Additional omission signals only. These patterns do not prove anonymity
    # or classify medical intent. Do not retain or log their matches.
    return any(
        re.search(pattern, text, re.IGNORECASE)
        for pattern in (
            r"[\w.+-]+@[\w.-]+\.[a-z]{2,}",
            r"\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b",
            r"\b\d[\d ()-]{7,}\d\b",
        )
    )


def validate_publication(report: SBARReport) -> str | None:
    """Only finalized, schema-valid projections may be submitted. Complexity and
    source privacy signals never reject otherwise approved categorical facts.
    Validation does not prove anonymity or that a speaker is fictional.
    """
    report = SBARReport.model_validate(report.model_dump(mode="json"))
    if report.status == "review_pending":
        return "not_final"
    return None


def prepare_publication(report: SBARReport, *, risk: bool = False) -> SBARReport:
    """Keep every validated category, including broad 'other' categories whose
    fixed templates explicitly omit details. Unmappable answers remain unknown
    at intake; never invent a replacement or copy the source as a fallback.

    Even when a source contains identifiers, only fixed vocabulary survives.
    Its contents are never passed here: risk is a content-free omission signal.
    Empty/partial intakes remain useful incomplete records with explicit unknowns.
    """
    if validate_publication(report):
        raise ValueError("Intake is not finalized")
    projected = report.model_copy(deep=True)
    facts = [
        fact
        for section in (projected.situation, projected.background, projected.assessment)
        for fact in section.facts
        if fact.state == "reported"
    ]
    projected.assessment.public_data_handling = PublicDataHandling(
        generalized_fields=[fact.field for fact in facts],
        details_omitted=risk
        or any(
            value in {"other", "health_context", "medication_context"}
            for fact in facts
            for value in fact.values
        ),
    )
    return SBARReport.model_validate(projected.model_dump(mode="json"))
