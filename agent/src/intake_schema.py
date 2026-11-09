"""Pure Pydantic contracts. No SDK, transcript storage, or database dependencies."""

from datetime import date
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

FieldName = Literal[
    "chief_complaint",
    "onset",
    "duration",
    "progression",
    "severity",
    "functional_impact",
    "associated_symptoms",
    "background",
    "onset_pattern",
    "breathing_difficulty",
    "vomiting",
    "sleep_change",
]
Status = Literal["reported", "unknown", "declined"]
VALUES: dict[str, dict[str, str]] = {
    "chief_complaint": {
        "cough": "cough",
        "headache": "headache",
        "abdominal_pain": "abdominal discomfort",
        "back_pain": "back discomfort",
        "fatigue": "tiredness",
        "sore_throat": "sore throat",
        "chest_discomfort": "chest discomfort",
        "breathing_concern": "breathing concern",
        "minor_injury": "minor injury",
        "skin_concern": "skin concern",
        "other": "another concern",
    },
    "onset": {
        "today": "earlier today",
        "yesterday": "yesterday",
        "within_week": "within the past week",
        "within_month": "within the past month",
        "longer": "more than a month ago",
    },
    "duration": {
        "minutes": "minutes at a time",
        "hours": "hours",
        "days": "several days",
        "weeks": "weeks or longer",
        "continuous": "continuous",
        "intermittent": "comes and goes",
    },
    "progression": {
        "improving": "improving",
        "stable": "about the same",
        "worsening": "getting worse",
        "variable": "variable",
    },
    "severity": {"mild": "mild", "moderate": "moderate", "severe": "severe"},
    "functional_impact": {
        "none": "no reported activity limitation",
        "some": "some activity limitation",
        "major": "major activity limitation",
    },
    "associated_symptoms": {
        "fatigue": "tiredness",
        "feverish": "feeling feverish",
        "nausea": "nausea",
        "vomiting": "vomiting",
        "light_sensitivity": "light sensitivity",
        "dizziness": "dizziness",
        "weakness": "weakness",
        "numbness": "numbness",
        "sore_throat": "sore throat",
        "wheeze": "wheezing",
        "breathlessness": "breathlessness",
        "cough": "cough",
        "headache": "headache",
        "rash": "rash",
        "none_reported": "no additional symptoms reported",
        "other": "other associated symptoms (details not retained)",
    },
    "background": {
        "similar_episode": "a similar episode before",
        "no_similar_episode": "no similar episode reported",
        "sleep_change": "a change in sleep",
        "recent_exertion": "recent exertion",
        "recent_illness": "a recent illness",
        "health_context": "relevant health context (generalized)",
        "medication_context": "medication context (details not retained)",
        "none_reported": "no relevant background reported",
        "other": "other context (details not retained)",
    },
    "onset_pattern": {"sudden": "sudden", "gradual": "gradual"},
    "breathing_difficulty": {
        "yes": "breathing difficulty reported",
        "no": "breathing difficulty denied",
    },
    "vomiting": {"yes": "vomiting reported", "no": "vomiting denied"},
    "sleep_change": {"yes": "sleep change reported", "no": "sleep change denied"},
}
LABELS = {
    "chief_complaint": "Presenting concern",
    "onset": "Onset",
    "duration": "Duration",
    "progression": "Progression",
    "severity": "Severity",
    "functional_impact": "Activity impact",
    "associated_symptoms": "Associated symptoms",
    "background": "Reported background",
    "onset_pattern": "Onset pattern",
    "breathing_difficulty": "Breathing difficulty",
    "vomiting": "Vomiting",
    "sleep_change": "Sleep change",
}
MULTI = {"associated_symptoms", "background"}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", validate_assignment=True)


class Fact(StrictModel):
    field: FieldName
    state: Status
    values: list[str] = Field(default_factory=list, max_length=8)

    @model_validator(mode="after")
    def validate_values(self) -> Self:
        if self.state != "reported" and self.values:
            raise ValueError("Unknown/declined facts cannot contain values")
        if self.state == "reported":
            if not self.values or any(v not in VALUES[self.field] for v in self.values):
                raise ValueError("Unsupported value")
            if self.field not in MULTI and len(self.values) != 1:
                raise ValueError("One value required")
            if len(set(self.values)) != len(self.values):
                raise ValueError("Duplicate values")
            if "none_reported" in self.values and len(self.values) > 1:
                raise ValueError("Conflicting negative answer")
            if self.field == "background" and {
                "similar_episode",
                "no_similar_episode",
            } <= set(self.values):
                raise ValueError("Conflicting background")
        return self


class FieldUpdate(Fact):
    evidence_quote: str = Field(
        min_length=1,
        max_length=240,
        description="Exact short quote from the latest caller message supporting this field. Never quote another speaker or invent wording.",
    )


Intent = Literal[
    "continue", "clarify", "recap", "confirm", "end", "education", "clinical_advice"
]
EducationTopic = Literal["onset", "severity", "sbar", "cough"]


class TurnRequest(StrictModel):
    intent: Intent = "continue"
    updates: list[FieldUpdate] = Field(default_factory=list, max_length=12)
    education_topic: EducationTopic | None = None
    identifying_details: bool = Field(
        default=False,
        description="True if the caller supplied a name, contact information, exact location, health identifier or other identifying detail. Never copy these into values. The public projection omits these details; this flag cannot authorize saving.",
    )

    @model_validator(mode="after")
    def unique_fields(self) -> Self:
        if len({u.field for u in self.updates}) != len(self.updates):
            raise ValueError("One update per field")
        if self.intent == "education" and self.education_topic is None:
            raise ValueError("Choose an approved education topic")
        return self


class SimulatedFlag(StrictModel):
    code: Literal[
        "DEMO_BREATHING_REPORTED",
        "DEMO_SUDDEN_HEADACHE",
        "DEMO_MAJOR_IMPACT",
        "DEMO_WORSENING",
        "DEMO_INCOMPLETE",
    ]
    label: str
    evidence_fields: list[FieldName]


def fact_text(fact: Fact) -> str:
    if fact.state == "unknown":
        return "unknown"
    if fact.state == "declined":
        return "not provided"
    return ", ".join(VALUES[fact.field][v] for v in fact.values)


class Section(StrictModel):
    text: str = Field(max_length=2400)
    facts: list[Fact] = Field(max_length=12)

    @model_validator(mode="after")
    def template_only(self) -> Self:
        if len({f.field for f in self.facts}) != len(self.facts):
            raise ValueError("Duplicate fields")
        expected = " ".join(f"{LABELS[f.field]}: {fact_text(f)}." for f in self.facts)
        if self.text != expected:
            raise ValueError("Only approved fact templates are allowed")
        return self


class PublicDataHandling(StrictModel):
    policy_version: Literal["projection-1.1"] = "projection-1.1"
    generalized_fields: list[FieldName] = Field(default_factory=list, max_length=12)
    details_omitted: bool = False

    @model_validator(mode="after")
    def unique_fields(self) -> Self:
        if len(set(self.generalized_fields)) != len(self.generalized_fields):
            raise ValueError("Duplicate generalized fields")
        return self


class Assessment(Section):
    disclaimer: Literal[
        "User-reported information and simulated flags only; not a diagnosis or validated triage."
    ] = "User-reported information and simulated flags only; not a diagnosis or validated triage."
    missing_information: list[FieldName]
    simulated_flags: list[SimulatedFlag]
    public_data_handling: PublicDataHandling | None = None


class Recommendation(StrictModel):
    text: str
    actions: list[
        Literal[
            "recap_prepared", "caller_reviewed", "session_incomplete", "record_saved"
        ]
    ]
    approved_information_ids: list[EducationTopic]
    record_saved: Literal[False] = False


class SBARReport(StrictModel):
    schema_version: Literal["2.0"] = "2.0"
    workflow_version: Literal["intake-2.0"] = "intake-2.0"
    rules_version: Literal["demo-rules-1.0"] = "demo-rules-1.0"
    case_id: UUID
    demonstration_label: str = Field(pattern=r"^Demo Case [A-F0-9]{6}$")
    started_on: date
    generated_on: date
    status: Literal["review_pending", "completed", "incomplete"]
    reviewed: bool
    not_for_medical_use: Literal[True] = True
    publication: Literal["not_published"] = "not_published"
    situation: Section
    background: Section
    assessment: Assessment
    recommendation: Recommendation

    @model_validator(mode="after")
    def approved_projection(self) -> Self:
        if self.demonstration_label != "Demo Case " + str(self.case_id)[:6].upper():
            raise ValueError("Use the generated case label")
        if self.status == "completed" and (
            not self.reviewed or self.assessment.missing_information
        ):
            raise ValueError(
                "Completed reports require review and known required fields"
            )
        if self.status == "review_pending" and self.reviewed:
            raise ValueError("Review is still pending")
        from rules import screen

        facts = {
            f.field: f
            for section in (self.situation, self.background, self.assessment)
            for f in section.facts
        }
        if self.assessment.simulated_flags != screen(facts, self.status != "completed"):
            raise ValueError("Flags must match the deterministic rules")
        saved = self.publication == "published"
        actions = (
            ["recap_prepared"]
            + (["caller_reviewed"] if self.reviewed else [])
            + (["session_incomplete"] if self.status != "completed" else [])
            + (["record_saved"] if saved else [])
        )
        text = (
            (
                "The prototype generated and saved this demonstration report."
                if saved
                else "The prototype prepared an intake recap."
            )
            + (
                " The caller reviewed it."
                if self.reviewed
                else " It has not been confirmed by the caller."
            )
            + (
                " Important information is incomplete."
                if self.assessment.missing_information
                else ""
            )
            + (
                " No clinical recommendation was made."
                if saved
                else " No record was saved and no clinical recommendation was made."
            )
        )
        if self.recommendation.actions != actions or self.recommendation.text != text:
            raise ValueError("Use approved action templates")
        return self


class SavedRecommendation(Recommendation):
    record_saved: Literal[True] = True


class PublishedSBARReport(SBARReport):
    schema_version: Literal["3.0"] = "3.0"
    publication_policy_version: Literal["public-1.0"] = "public-1.0"
    publication: Literal["published"] = "published"
    status: Literal["completed", "incomplete"]
    recommendation: SavedRecommendation
