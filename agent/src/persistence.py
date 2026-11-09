"""Trusted, bounded finalization. Never accepts a browser/model SBAR payload."""

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from intake import IntakeWorkflow
from intake_schema import PublishedSBARReport
from publication import validate_publication
from sbar import generate_sbar


@dataclass(frozen=True)
class FinalizationResult:
    publication: str
    case_id: str | None = None
    status: str | None = None


class Finalizer:
    def __init__(self, room: str, rpc: Callable[[str, dict], Awaitable[dict | None]]):
        self.room = room
        self.rpc = rpc
        self.lock = asyncio.Lock()
        self.result: FinalizationResult | None = None

    async def finalize(self, workflow: IntakeWorkflow) -> FinalizationResult:
        async with self.lock:
            if self.result:
                return self.result
            workflow.finish_incomplete()
            report = generate_sbar(workflow)
            try:
                rejection = validate_publication(report, risk=workflow.publication_risk)
            except Exception:
                rejection = "validation_failed"
            values = {
                "p_room": self.room,
                "p_payload": None if rejection else report.model_dump(mode="json"),
                "p_decision": "withheld" if rejection else "published",
                "p_reason": rejection,
            }
            # Freeze one payload across ambiguous-response retries. The SQL
            # transaction compares it with any existing record, never overwrites.
            for attempt in range(2):
                try:
                    data = await self.rpc("finalize_demo_record", values)
                    if data and data.get("publication") == "published":
                        saved = PublishedSBARReport.model_validate(data["record"])
                        if str(saved.case_id) != workflow.case_id:
                            raise ValueError("Mismatched case")
                        workflow.record = saved
                        self.result = FinalizationResult(
                            "published", str(saved.case_id), saved.status
                        )
                    elif data and data.get("publication") == "withheld":
                        self.result = FinalizationResult("withheld")
                    else:
                        raise ValueError("Unconfirmed write")
                    return self.result
                except Exception:
                    if attempt == 0:
                        await asyncio.sleep(0.2)
            # The transaction may have committed despite a lost response. Mark
            # failure only if still pending; SQL never downgrades a saved case.
            try:
                data = await self.rpc(
                    "finalize_demo_record",
                    {
                        "p_room": self.room,
                        "p_payload": None,
                        "p_decision": "failed",
                        "p_reason": "save_unavailable",
                    },
                )
                if data and data.get("publication") == "published":
                    saved = PublishedSBARReport.model_validate(data["record"])
                    if str(saved.case_id) != workflow.case_id:
                        raise ValueError("Mismatched case")
                    workflow.record = saved
                    self.result = FinalizationResult(
                        "published", str(saved.case_id), saved.status
                    )
                    return self.result
                if data and data.get("publication") == "withheld":
                    self.result = FinalizationResult("withheld")
                    return self.result
            except Exception:
                pass
            self.result = FinalizationResult("failed")
            return self.result
