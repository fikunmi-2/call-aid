import io
import json
import logging

from livekit.agents.cli.log import JsonFormatter

from log_privacy import ContentFreeLogs, install_content_free_logging


def test_sdk_tool_error_drops_evidence_and_exception_from_actual_json_formatter():
    secret = "Synthetic Person at 123 Made-up Street"
    record = logging.makeLogRecord(
        {
            "name": "livekit.agents",
            "levelname": "ERROR",
            "msg": "error parsing arguments for %s",
            "args": (secret,),
            "lk.pii.arguments": {"request": {"evidence_quote": secret}},
            "exc_info": (ValueError, ValueError(secret), None),
            "exc_text": secret,
            "stack_info": secret,
            "unmarked_extra": secret,
        }
    )
    assert ContentFreeLogs().filter(record)
    encoded = JsonFormatter().format(record)
    assert secret not in encoded
    result = json.loads(encoded)
    assert result["level"] == "ERROR"
    assert result["name"] == "livekit.agents"
    assert "lk.pii.arguments" not in result
    assert "exc_info" not in result


def test_safe_application_event_remains_useful_but_extras_are_dropped():
    record = logging.makeLogRecord(
        {"name": "callaid.intake", "msg": "intake_update_rejected", "reason": "private"}
    )
    ContentFreeLogs().filter(record)
    assert record.getMessage() == "intake_update_rejected"
    assert not hasattr(record, "reason")


def test_install_covers_child_loggers_without_duplicate_filters():
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    root = logging.getLogger()
    root.addHandler(handler)
    try:
        install_content_free_logging()
        install_content_free_logging()
        logging.getLogger("livekit.agents.child").error(
            "Synthetic private evidence", extra={"lk.pii.arguments": "private"}
        )
        assert stream.getvalue().strip() == "runtime_event_content_omitted"
        assert sum(isinstance(f, ContentFreeLogs) for f in handler.filters) == 1
    finally:
        root.removeHandler(handler)
