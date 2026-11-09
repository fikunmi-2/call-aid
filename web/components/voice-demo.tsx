"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  type LocalAudioTrack,
  ParticipantKind,
  type RemoteParticipant,
} from "livekit-client";
import {
  RoomContext,
  RoomAudioRenderer,
  StartAudio,
  useVoiceAssistant,
  useLocalParticipant,
  useTrackVolume,
  useMediaDeviceSelect,
} from "@livekit/components-react";
import { Mic, MicOff, PhoneOff, AudioLines, ArrowRight } from "lucide-react";
import { IntakePreview } from "./intake-preview";
import { SessionResult } from "./session-result";
import { parseIntakeReport, type IntakeReport } from "@/lib/intake-report";
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
  const [report, setReport] = useState<IntakeReport | null>(null);
  const latestReport = useRef<IntakeReport | null>(null);
  const [reportError, setReportError] = useState("");
  const clearDraft = useCallback(() => setReport(null), []);
  const busy = useRef(false),
    active = useRef(false);
  const end = async () => {
    // Browser tokens remain unable to publish arbitrary room data. The trusted
    // end endpoint and participant disconnect trigger agent finalization.
    active.current = false;
    setDeadline(null);
    await room.disconnect();
    setPhase("ended");
    setMessage("Voice session ended. Your report status appears below.");
    void fetch("/api/sessions/end", { method: "POST" });
  };
  useEffect(() => {
    const received = (
      data: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (
        topic !== "callaid.sbar.v1" ||
        participant?.kind !== ParticipantKind.AGENT
      )
        return;
      const result = parseIntakeReport(data);
      if (result) {
        setReport(result);
        latestReport.current = result;
        setReportError("");
      } else
        setReportError(
          "The intake report could not be validated and is not displayed.",
        );
    };
    room.on(RoomEvent.DataReceived, received);
    const disconnected = () => {
      if (active.current) {
        active.current = false;
        setDeadline(null);
        setPhase("ended");
        setMessage(
          latestReport.current
            ? "Voice session ended. Your report status appears below."
            : "The session disconnected. You can restart or explore an example report.",
        );
        void fetch("/api/sessions/end", { method: "POST" });
      }
    };
    room.on(RoomEvent.Disconnected, disconnected);
    return () => {
      room.off(RoomEvent.DataReceived, received);
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
    setReport(null);
    latestReport.current = null;
    setReportError("");
    setPhase("connecting");
    setMessage("Checking your microphone…");
    let microphone: LocalAudioTrack | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Microphone access needs localhost or an HTTPS browser.",
        );
      // Capture once, then publish this exact track. Do not stop and reacquire it.
      microphone = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
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
      await room.localParticipant.publishTrack(microphone, {
        source: Track.Source.Microphone,
      });
      microphone = undefined; // The room now owns the track and stops it on disconnect.
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
      microphone?.stop();
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
        {phase === "connected" && <MicrophoneCheck />}
        <StartAudio label="Enable assistant audio" />
        <RoomAudioRenderer />
        <div className="voice-panel-note">
          A generalized SBAR draft is prepared during the conversation. At the
          end, validated reports are saved for public review. Only generalized
          categories are published; the result below confirms whether saving
          succeeded.
        </div>
      </section>
      {phase === "ended" && <SessionResult onSaved={clearDraft} />}
      {reportError && <p role="alert">{reportError}</p>}
      {report && <IntakePreview report={report} />}
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
export function MicrophoneCheck() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [error, setError] = useState("");
  const track = localParticipant.getTrackPublication(
    Track.Source.Microphone,
  )?.audioTrack;
  const volume = useTrackVolume(track);
  // The hook memoizes its device observer by callback identity. An inline callback
  // would recreate the subscription on every meter update and cause a render loop.
  const handleDeviceError = useCallback(
    () =>
      setError(
        "Unable to switch microphones. Check browser permissions and try again.",
      ),
    [],
  );
  const { devices, activeDeviceId, setActiveMediaDevice } =
    useMediaDeviceSelect({
      kind: "audioinput",
      requestPermissions: false,
      onError: handleDeviceError,
    });
  return (
    <div className="microphone-check">
      <label htmlFor="voice-microphone">Microphone</label>
      <select
        id="voice-microphone"
        value={activeDeviceId}
        onChange={(event) => {
          setError("");
          void setActiveMediaDevice(event.target.value).catch(() =>
            setError(
              "Unable to switch microphones. Check browser permissions and try again.",
            ),
          );
        }}
      >
        <option value="default">
          {devices.find((device) => device.deviceId === "default")?.label ||
            "System default microphone"}
        </option>
        {devices
          .filter((device) => device.deviceId && device.deviceId !== "default")
          .map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Microphone ${index + 1}`}
            </option>
          ))}
      </select>
      <label htmlFor="voice-microphone-level">
        {isMicrophoneEnabled ? "Microphone input level" : "Microphone is muted"}
      </label>
      <meter
        id="voice-microphone-level"
        min={0}
        max={1}
        value={isMicrophoneEnabled ? Math.min(1, volume) : 0}
      />
      <p>
        Speak and check that the level moves. If it stays flat, choose another
        microphone.
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
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
