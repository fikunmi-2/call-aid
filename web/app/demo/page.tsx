import { VoiceDemo } from "@/components/voice-demo";
import Link from "next/link";
export default function Demo() {
  return (
    <div className="shell page demo-page">
      <p className="eyebrow">THE VOICE DEMONSTRATION</p>
      <h1>
        A little space
        <br />
        to <em>be heard.</em>
      </h1>
      <p className="lede">
        Speak naturally about a fictional symptom scenario.
        <br />
        No account, form, or scenario selection needed.
      </p>
      <p className="demo-fallback small muted">
        Voice depends on available demo capacity and inference credits. You can{" "}
        <Link className="text-link" href="/records#examples">
          explore synthetic SBAR examples
        </Link>{" "}
        without a microphone at any time.
      </p>
      <VoiceDemo />
      <p className="small muted">
        Not for medical use. Do not share real names, health numbers, precise
        locations, or personal or medical information. This prototype cannot
        provide clinical advice. Audio is processed by LiveKit and its model
        provider.
      </p>
    </div>
  );
}
