"""Python-owned intake state and transitions; deliberately independent of LiveKit."""

import re
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from intake_schema import LABELS, VALUES, Fact, TurnRequest, fact_text

QUESTIONS: dict[str, str] = {
    "chief_complaint": "What brings you in today?",
    "onset": "When did you first notice it?",
    "duration": "How long does it last when it happens?",
    "progression": "How has it changed since it started?",
    "severity": "How would you describe how strong or bothersome it is?",
    "functional_impact": "How is it affecting your usual activities?",
    "associated_symptoms": "What other symptoms have you noticed along with it?",
    "background": "Is there any relevant background, such as a similar episode before?",
    "onset_pattern": "Did the headache come on suddenly or build gradually?",
    "breathing_difficulty": "Have you noticed any difficulty breathing?",
    "vomiting": "Have you had any vomiting with the discomfort?",
    "sleep_change": "Has your sleep changed alongside the tiredness?",
}
EDUCATION = {
    "onset": {
        "text": "In this intake, onset means when a symptom first began. Duration describes how long it lasts.",
        "source": None,
    },
    "severity": {
        "text": "Here, severity means how bothersome the symptom feels to you; activity impact means how it affects your usual day.",
        "source": None,
    },
    "sbar": {
        "text": "SBAR organizes information into situation, background, assessment, and recommendation. Here the assessment contains reported facts and simulated markers, not a diagnosis.",
        "source": "https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/sbar.html",
    },
    "cough": {
        "text": "A cough is a reflex that helps clear the throat and airways. That general fact does not establish the cause of a particular cough.",
        "source": "https://medlineplus.gov/cough.html",
    },
}


def normalized(text: str) -> str:
    # Lexical equivalence for evidence/delivery checks only; never classify
    # caller intent or clinical meaning using word matching.
    for short, expanded in {
        "i've": "i have",
        "i'm": "i am",
        "it's": "it is",
        "don't": "do not",
        "doesn't": "does not",
        "isn't": "is not",
        "haven't": "have not",
    }.items():
        text = re.sub(
            r"\b" + re.escape(short) + r"\b",
            expanded,
            text.replace("’", "'"),
            flags=re.IGNORECASE,
        )
    return " ".join(re.findall(r"\w+", text.casefold()))


@dataclass(frozen=True)
class SourceTurn:
    id: str
    sequence: int
    text: str


@dataclass(frozen=True)
class Step:
    kind: str
    question: str = ""
    field: str | None = None
    recap: str = ""
    information: str = ""


class IntakeWorkflow:
    def __init__(self, max_turns: int = 16):
        self.case_id = str(uuid4())
        self.started_on = datetime.now(UTC).date().isoformat()
        self.facts: dict[str, Fact] = {}
        self.sources: dict[str, str] = {}
        self.revision = 0
        self.turns = 0
        self.max_turns = max_turns
        self.last_sequence = 0
        self.phase = "intake"
        self.review_revision: int | None = None
        self.review_sequence = 0
        self.review_delivered = False
        self.reviewed = False
        self.clarifications: dict[str, int] = {}
        self.information_ids: list[str] = []
        self.record = None
        self.publication_risk = False

    def requirements(self) -> list[str]:
        chief = self.facts.get("chief_complaint")
        value = chief.values[0] if chief and chief.values else None
        conditional = {
            "cough": "breathing_difficulty",
            "breathing_concern": "breathing_difficulty",
            "chest_discomfort": "breathing_difficulty",
            "headache": "onset_pattern",
            "abdominal_pain": "vomiting",
            "fatigue": "sleep_change",
            "back_pain": "functional_impact",
            "minor_injury": "functional_impact",
        }.get(value)
        fields = ["chief_complaint", "onset"]
        if conditional:
            fields.append(conditional)
        fields += ["duration", "progression"]
        if not any(k in self.facts for k in ("severity", "functional_impact")):
            fields.append("severity")
        elif "severity" in self.facts:
            fields.append("severity")
        else:
            fields.append("functional_impact")
        fields += ["associated_symptoms", "background"]
        return list(dict.fromkeys(fields))

    def missing(self) -> list[str]:
        missing = [
            k
            for k in self.requirements()
            if k not in self.facts or self.facts[k].state != "reported"
        ]
        conflict = self.contradiction()
        if conflict and conflict not in missing:
            missing.append(conflict)
        return missing

    def contradiction(self) -> str | None:
        associated = self.facts.get("associated_symptoms")
        for field, value in [
            ("breathing_difficulty", "breathlessness"),
            ("vomiting", "vomiting"),
        ]:
            fact = self.facts.get(field)
            if (
                fact
                and fact.values == ["no"]
                and associated
                and value in associated.values
            ):
                return field
        return None

    def next_question(self) -> Step:
        conflict = self.contradiction()
        if conflict:
            return Step(
                "question",
                f"I have conflicting answers about {LABELS[conflict].lower()}. What should I record?",
                conflict,
            )
        for key in self.requirements():
            if key not in self.facts:
                return Step("question", QUESTIONS[key], key)
        return self.prepare_review()

    def recap(self) -> str:
        parts = []
        for key in [
            "chief_complaint",
            "onset",
            "onset_pattern",
            "duration",
            "progression",
            "severity",
            "functional_impact",
            "breathing_difficulty",
            "vomiting",
            "sleep_change",
            "associated_symptoms",
            "background",
        ]:
            fact = self.facts.get(key)
            if fact and fact.state == "reported":
                parts.append(f"{LABELS[key]}: {fact_text(fact)}.")
        return (
            "Here is what you reported. "
            + (
                " ".join(parts)
                if parts
                else "There is not enough information for a symptom summary."
            )
            + (" Some information remains unknown." if self.missing() else "")
        )

    def prepare_review(self) -> Step:
        self.phase = "review"
        self.review_revision = self.revision
        self.review_sequence = self.last_sequence
        self.review_delivered = False
        self.reviewed = False
        return Step(
            "review", "What would you like to correct or add?", recap=self.recap()
        )

    def mark_review_delivered(
        self, revision: int, text: str, interrupted: bool = False
    ) -> bool:
        # This checks delivery of application-owned wording, not natural-language intent.
        if (
            self.phase == "review"
            and revision == self.revision == self.review_revision
            and not interrupted
            and normalized(self.recap()) in normalized(text)
        ):
            self.review_delivered = True
            return True
        return False

    def apply(self, request: TurnRequest, source: SourceTurn) -> Step:
        # Rejection signals can only narrow publication; never approve it.
        self.publication_risk |= (
            request.identifying_details or request.intent == "clinical_advice"
        )
        if self.phase in ("completed", "ended"):
            raise ValueError("Intake is already closed")
        if source.sequence <= self.last_sequence:
            raise ValueError("A later actual caller turn is required")
        # Validate the entire proposed update before changing state. Quotes are checked
        # transiently, then discarded; only codes and opaque source IDs are retained.
        for update in request.updates:
            if not normalized(update.evidence_quote) or normalized(
                update.evidence_quote
            ) not in normalized(source.text):
                raise ValueError("Evidence must come from this caller turn")
        pending = {
            u.field: Fact(field=u.field, state=u.state, values=u.values)
            for u in request.updates
        }
        changed = any(self.facts.get(k) != v for k, v in pending.items())
        self.last_sequence = source.sequence
        self.turns += 1
        if changed:
            self.facts.update(pending)
            self.sources.update({k: source.id for k in pending})
            self.revision += 1
            self.review_delivered = False
            self.reviewed = False
            self.record = None
        if request.intent == "end":
            self.phase = "ended"
            return Step(
                "ended",
                information="The caller has ended the intake.",
            )
        if request.intent == "confirm" and not changed:
            if self.contradiction():
                return self.next_question()
            if (
                self.phase == "review"
                and self.review_delivered
                and self.review_revision == self.revision
                and source.sequence > self.review_sequence
                and not self.contradiction()
            ):
                self.reviewed = True
                self.phase = "completed"
                return Step(
                    "completed",
                    information="The caller has confirmed the recap.",
                )
            return self.prepare_review()
        if request.intent == "recap" or self.turns >= self.max_turns:
            return self.prepare_review()
        if request.intent == "education":
            topic = request.education_topic
            if topic not in self.information_ids:
                self.information_ids.append(topic)
            step = self.next_question()
            return Step(
                step.kind,
                step.question,
                step.field,
                step.recap,
                EDUCATION[topic]["text"],
            )
        if request.intent == "clinical_advice":
            step = self.next_question()
            return Step(
                step.kind,
                step.question,
                step.field,
                step.recap,
                "I can explain general concepts, but this prototype cannot diagnose or recommend individual treatment. For real health concerns, use an appropriate healthcare service.",
            )
        if request.intent == "clarify" and not pending:
            step = self.next_question()
            if step.field:
                self.clarifications[step.field] = (
                    self.clarifications.get(step.field, 0) + 1
                )
                if self.clarifications[step.field] >= 2:
                    self.facts[step.field] = Fact(field=step.field, state="unknown")
                    self.revision += 1
                    return self.next_question()
            return Step(
                step.kind,
                step.question,
                step.field,
                information="Take your time; it is fine if you do not know.",
            )
        return self.next_question()

    def finish_incomplete(self):
        if self.phase != "completed":
            self.phase = "ended"
            self.reviewed = False

    def allowed_values(self) -> dict:
        return VALUES
