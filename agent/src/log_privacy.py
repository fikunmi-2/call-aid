"""Keep worker stdout content-free, including SDK tool-validation errors."""

import logging

_STANDARD_FIELDS = frozenset(logging.makeLogRecord({}).__dict__)
_SAFE_EVENTS = frozenset(
    {
        "session_admission_unavailable",
        "voice_session_failed",
        "room_shutdown_unconfirmed",
        "record_finalization_unavailable",
        "session_status_write_failed",
        "intake_preview_delivery_unavailable",
        "intake_source_not_ready",
        "intake_update_rejected",
        "closing_persistence_unavailable",
    }
)


class ContentFreeLogs(logging.Filter):
    """Retain severity/source, never conversation data or exception detail.

    Cloud session recording is separately disabled. SDK stdout handlers can still
    emit rejected tool arguments, so filtering telemetry alone is insufficient.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        # SDK retry logs may carry typed errors in args/exc_info. Keep only a
        # numeric HTTP status from the exception chain, never its message/body.
        errors = [arg for arg in record.args if isinstance(arg, BaseException)]
        if record.exc_info:
            errors.append(record.exc_info[1])
        status = None
        for error in errors:
            for _ in range(5):
                if error is None:
                    break
                code = getattr(error, "status_code", getattr(error, "status", None))
                if type(code) is int and 100 <= code <= 599:
                    status = code
                error = error.__cause__ or error.__context__
        safe = (
            record.name.startswith("callaid")
            and isinstance(record.msg, str)
            and record.msg in _SAFE_EVENTS
            and not record.args
        )
        record.msg = record.msg if safe else "runtime_event_content_omitted"
        record.args = ()
        record.exc_info = None
        record.exc_text = None
        record.stack_info = None
        for key in list(record.__dict__):
            if key not in _STANDARD_FIELDS:
                del record.__dict__[key]
        if status is not None:
            record.http_status = status
        return True


def install_content_free_logging() -> None:
    # Run in the job process before admission/model setup. The SDK has already
    # installed stdout handlers by this point; repeat calls are harmless.
    for handler in logging.getLogger().handlers:
        if not any(isinstance(item, ContentFreeLogs) for item in handler.filters):
            handler.addFilter(ContentFreeLogs())
