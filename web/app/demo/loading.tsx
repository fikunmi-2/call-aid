export default function LoadingDemo() {
  return (
    <div
      className="shell page"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="eyebrow">Call AId</p>
      <h1>Getting things ready.</h1>
      <p className="lede">
        Loading the voice interface. Your microphone is still off.
      </p>
    </div>
  );
}
