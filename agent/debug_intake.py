"""Synthetic-only local debugger entrypoint; no database or saved case content.

Run from agent/: lk agent debugger start --audio debug_intake.py
Then: lk agent debugger say "For this example, I have a headache."
Stop: lk agent debugger stop
Uses real inference credits. Never enter real patient information.
"""

from dotenv import load_dotenv
from livekit.agents import AgentServer, AgentSession, JobContext, cli, inference

from config import Settings
from intake_agent import OPENING, Assistant

load_dotenv(".env.local")
server = AgentServer()


@server.rtc_session()
async def entrypoint(ctx: JobContext):
    settings = Settings()
    session = AgentSession(
        llm=inference.RealtimeModel(
            model=settings.realtime_model,
            voice=settings.realtime_voice,
        )
    )
    assistant = Assistant()
    assistant.bind(session)
    await session.start(agent=assistant, room=ctx.room, record=False)
    await session.generate_reply(instructions=OPENING)


if __name__ == "__main__":
    cli.run_app(server)
