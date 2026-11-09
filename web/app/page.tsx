import Link from "next/link";
import {
  ArrowRight,
  Mic,
  FileText,
  ShieldCheck,
  AudioLines,
  MapPin,
} from "lucide-react";
export default function Home() {
  return (
    <div className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span /> VOICE INTAKE, REIMAGINED
          </p>
          <h1>
            Every story starts
            <br />
            with a <em>conversation.</em>
          </h1>
          <p className="hero-description">
            Exploring how AI can listen, organize, and bring clarity to symptom
            intake in rural Saskatchewan.
          </p>
          <div className="actions">
            <Link className="button primary" href="/demo">
              <Mic size={18} /> Start Voice Session <ArrowRight size={18} />
            </Link>
            <Link className="text-link" href="/records">
              Explore example records <ArrowUpRightIcon />
            </Link>
          </div>
          <p className="small muted hero-note">
            No account. No forms. Just your browser and microphone.
          </p>
        </div>
        <div className="conversation-card">
          <div className="card-top">
            <span className="eyebrow">A CLEARER PICTURE</span>
            <span className="pill">Illustrative preview</span>
          </div>
          <div className="orb">
            <AudioLines size={52} strokeWidth={1.2} />
          </div>
          <div className="wave" aria-hidden="true">
            {Array.from({ length: 37 }, (_, i) => (
              <span
                key={i}
                style={{ height: `${8 + Math.sin(i * 1.8) ** 2 * 36}px` }}
              />
            ))}
          </div>
          <h2>
            Room to speak.
            <br />
            Structure to understand.
          </h2>
          <div className="example-bubble">
            “For my fictional example, I&apos;ve had a cough for a few days.”
          </div>
          <div className="capture">
            <FileText size={18} />
            <div>
              <strong>From conversation to clarity</strong>
              <span>Structured SBAR demonstration reports</span>
            </div>
            <span className="capture-dot" />
          </div>
        </div>
      </section>
      <div className="context-strip">
        <MapPin size={17} />
        <span>Rural Saskatchewan</span>
        <span className="context-separator">·</span>
        <span>Browser-based voice</span>
        <span className="context-separator">·</span>
        <span>Synthetic demonstrations only</span>
      </div>
      <section className="how">
        <div>
          <p className="eyebrow">A SIMPLE IDEA</p>
          <h2>
            Less form-filling.
            <br />
            More understanding.
          </h2>
        </div>
        <div className="steps">
          {[
            {
              n: "01",
              icon: Mic,
              title: "Speak naturally",
              text: "Describe a made-up symptom scenario in your own words. No personal information needed.",
            },
            {
              n: "02",
              icon: AudioLines,
              title: "Keep the conversation going",
              text: "Describe a made-up concern, answer relevant questions, and review the reported details in a spoken recap.",
            },
            {
              n: "03",
              icon: FileText,
              title: "See the bigger picture",
              text: "Open your saved demonstration report after the call, or explore the separately labeled synthetic examples.",
            },
          ].map((s) => (
            <article key={s.n}>
              <span className="step-num">{s.n}</span>
              <s.icon size={21} />
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>
      <aside className="safety">
        <ShieldCheck size={26} />
        <div>
          <h3>A research space. Not a healthcare service.</h3>
          <p>
            Not for medical use. Use only fictional symptoms and context. Do not
            share real personal or medical information. Call AId does not
            diagnose, prescribe, or provide medical advice.
          </p>
        </div>
        <Link href="/demo" className="text-link">
          Try the voice demo <ArrowRight size={16} />
        </Link>
      </aside>
    </div>
  );
}
function ArrowUpRightIcon() {
  return <span aria-hidden="true">↗</span>;
}
