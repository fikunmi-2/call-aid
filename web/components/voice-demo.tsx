"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Room, RoomEvent } from "livekit-client";
import {
  RoomContext,
  RoomAudioRenderer,
  StartAudio,
  useVoiceAssistant,
  useLocalParticipant,
} from "@livekit/components-react";
import { Mic, MicOff, PhoneOff, AudioLines, ArrowRight } from "lucide-react";
type Connection = {
  serverUrl: string;
  participantToken: string;
  expiresAt: string;
  maxCallSeconds: number;
};
export function VoiceDemo() {
  const [room] = useState(
    () => new Room({ adaptiveStream: true, dynacast: true }),
  );
  const [phase, setPhase] = useState<
    "ready" | "connecting" | "connected" | "ended"
  >("ready");
  const [message, setMessage] = useState(
    "Your microphone stays off until you start.",
  );
  const [deadline, setDeadline] = useState<number | null>(null);
  const busy = useRef(false),
    active = useRef(false);
  const end = async () => {
    active.current = false;
    setDeadline(null);
    await room.disconnect();
    setPhase("ended");
    setMessage(
      "Session ended. New report generation is coming in the next milestones.",
    );
    void fetch("/api/sessions/end", { method: "POST" });
  };
  useEffect(() => {
    const disconnected = () => {
      if (active.current) {
        active.current = false;
        setDeadline(null);
        setPhase("ended");
        setMessage(
          "The session disconnected. You can restart or explore an example report.",
        );
        void fetch("/api/sessions/end", { method: "POST" });
      }
    };
    room.on(RoomEvent.Disconnected, disconnected);
    return () => {
      room.off(RoomEvent.Disconnected, disconnected);
      void room.disconnect();
    };
  }, [room]);
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => {
      if (Date.now() >= deadline) {
        active.current = false;
        setDeadline(null);
        void room.disconnect();
        setPhase("ended");
        setMessage("The demonstration time limit has been reached.");
        void fetch("/api/sessions/end", { method: "POST" });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline, room]);
  async function start() {
    if (busy.current) return;
    busy.current = true;
    setPhase("connecting");
    setMessage("Checking your microphone…");
    let stream: MediaStream | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Microphone access needs localhost or an HTTPS browser.",
        );
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      stream.getTracks().forEach((t) => t.stop());
      setMessage(
        "Connecting to the voice assistant. A cold start can take a few moments.",
      );
      const response = await fetch("/api/sessions", {
        method: "POST",
        signal: AbortSignal.timeout(25000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Voice is temporarily unavailable.");
      const connection = data as Connection;
      setDeadline(Date.parse(connection.expiresAt));
      active.current = true;
      await room.connect(connection.serverUrl, connection.participantToken);
      await room.localParticipant.setMicrophoneEnabled(true);
      setPhase("connected");
      setMessage("Connected. Waiting for the assistant…");
    } catch (e) {
      active.current = false;
      await room.disconnect();
      void fetch("/api/sessions/end", { method: "POST" });
      setPhase("ready");
      setDeadline(null);
      setMessage(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow it in your browser, then try again."
          : e instanceof Error
            ? e.message
            : "Unable to start voice. Please try again.",
      );
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      busy.current = false;
    }
  }
  return (
    <RoomContext.Provider value={room}>
      <section className="voice-panel">
        <div className={`voice-orb ${phase === "connected" ? "is-live" : ""}`}>
          <AudioLines size={46} strokeWidth={1.3} />
        </div>
        <span className="eyebrow">
          {phase === "connected"
            ? "LIVE VOICE CONNECTION"
            : "A CONVERSATION AT YOUR PACE"}
        </span>
        <div role="status" aria-live="polite" className="voice-status">
          {phase === "connected" ? <AgentStatus /> : message}
        </div>
        {phase === "connected" ? (
          <div className="voice-controls">
            <MicToggle />
            <button onClick={() => void end()} className="button end">
              <PhoneOff size={18} /> End session
            </button>
          </div>
        ) : (
          <button
            className="button primary"
            disabled={phase === "connecting"}
            onClick={() => void start()}
          >
            <Mic size={18} />
            {phase === "connecting" ? "Connecting…" : "Start Voice Session"}
          </button>
        )}
        <StartAudio label="Enable assistant audio" />
        <RoomAudioRenderer />
        <div className="voice-panel-note">
          Milestone 1: voice conversation only. New SBAR generation and saving
          are not enabled yet.
        </div>
      </section>
      <Link href="/records" className="text-link examples-link">
        Voice unavailable? Explore synthetic examples <ArrowRight size={16} />
      </Link>
    </RoomContext.Provider>
  );
}
function AgentStatus() {
  const { state } = useVoiceAssistant();
  const labels: Record<string, string> = {
    disconnected: "Waiting for the assistant…",
    connecting: "The assistant is connecting…",
    initializing: "Preparing the voice model…",
    listening: "Listening. Take your time.",
    thinking: "Thinking…",
    speaking: "The assistant is speaking.",
  };
  return <>{labels[state] || "Connected."}</>;
}
function MicToggle() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  return (
    <button
      className="button secondary"
      aria-pressed={!isMicrophoneEnabled}
      onClick={() =>
        void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
      }
    >
      {isMicrophoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}{" "}
      {isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
    </button>
  );
}
