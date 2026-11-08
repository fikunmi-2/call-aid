from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from config import Lease, Settings, room_options


def test_deadline_never_extends_expired_call():
    now = datetime.now(UTC)
    lease = Lease(
        identity="visitor", expires_at=now - timedelta(seconds=1), call_seconds=180
    )
    assert lease.remaining(now) == 0


def test_untrusted_lease_fields_and_unbounded_calls_are_rejected():
    with pytest.raises(ValidationError):
        Lease(identity="visitor", expires_at=datetime.now(UTC), call_seconds=10000)
    with pytest.raises(ValidationError):
        Lease(
            identity="visitor",
            expires_at=datetime.now(UTC),
            call_seconds=180,
            raw_transcript="untrusted",
        )


def test_room_disables_text_video_and_deletes_on_close():
    opts = room_options("expected-visitor")
    assert opts.participant_identity == "expected-visitor"
    assert opts.text_input is False
    assert opts.text_output is False
    assert opts.video_input is False
    assert opts.delete_room_on_close is True


def test_settings_require_storage_and_redact_secret():
    settings = Settings(
        _env_file=None,
        supabase_url="https://example.invalid",
        supabase_secret_key="synthetic-test-secret",
    )
    assert "synthetic-test-secret" not in repr(settings)
