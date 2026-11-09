"""Versioned demonstration rules. These report input patterns, never clinical urgency."""

from intake_schema import Fact, SimulatedFlag

VERSION = "demo-rules-1.0"


def screen(facts: dict[str, Fact], incomplete: bool) -> list[SimulatedFlag]:
    def has(field, value):
        fact = facts.get(field)
        return bool(fact and fact.state == "reported" and value in fact.values)

    flags = []
    if has("breathing_difficulty", "yes") or has(
        "associated_symptoms", "breathlessness"
    ):
        flags.append(
            SimulatedFlag(
                code="DEMO_BREATHING_REPORTED",
                label="Simulated marker: breathing difficulty was reported",
                evidence_fields=["breathing_difficulty"]
                if has("breathing_difficulty", "yes")
                else ["associated_symptoms"],
            )
        )
    if has("chief_complaint", "headache") and has("onset_pattern", "sudden"):
        flags.append(
            SimulatedFlag(
                code="DEMO_SUDDEN_HEADACHE",
                label="Simulated marker: headache with reported sudden onset",
                evidence_fields=["chief_complaint", "onset_pattern"],
            )
        )
    if has("severity", "severe") or has("functional_impact", "major"):
        flags.append(
            SimulatedFlag(
                code="DEMO_MAJOR_IMPACT",
                label="Simulated marker: severe symptoms or major activity impact reported",
                evidence_fields=["severity"]
                if has("severity", "severe")
                else ["functional_impact"],
            )
        )
    if has("progression", "worsening"):
        flags.append(
            SimulatedFlag(
                code="DEMO_WORSENING",
                label="Simulated marker: worsening was reported",
                evidence_fields=["progression"],
            )
        )
    if incomplete:
        flags.append(
            SimulatedFlag(
                code="DEMO_INCOMPLETE",
                label="Simulated marker: intake has missing information or is unreviewed",
                evidence_fields=[],
            )
        )
    return flags
