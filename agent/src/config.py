from datetime import UTC, datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")
    livekit_agent_name: str = "call-aid"
    supabase_url: str
    supabase_secret_key: SecretStr
    realtime_model: str = "google/gemini-3.8-live"
    realtime_voice: str = "Puck"
    idle_seconds: int = Field(default=45, ge=10, le=120)
    max_user_turns: int = Field(default=20, ge=1, le=50)


class Lease(BaseModel):
    model_config = ConfigDict(extra="forbid")
    identity: str = Field(min_length=1)
    expires_at: AwareDatetime
    call_seconds: int = Field(ge=1, le=600)

    def remaining(self, now: datetime | None = None) -> float:
        return max(0.0, (self.expires_at - (now or datetime.now(UTC))).total_seconds())


def room_options(identity: str):
    from livekit.agents import room_io

    return room_io.RoomOptions(
        participant_identity=identity,
        text_input=False,
        text_output=False,
        video_input=False,
        delete_room_on_close=True,
    )
