"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";

const outcome = z
  .object({
    status: z.string().max(30),
    publication: z
      .enum(["pending", "published", "withheld", "failed", "unavailable"])
      .optional(),
    recordAvailable: z.boolean().optional(),
    caseId: z.uuid().optional(),
    caseStatus: z.enum(["completed", "incomplete"]).optional(),
  })
  .strict();
export function SessionResult({ onSaved }: { onSaved: () => void }) {
  const [result, setResult] = useState<z.infer<typeof outcome> | null>(null);
  const [attempt, setAttempt] = useState(0),
    [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let count = 0;
    const deadline = Date.now() + 45000;
    setResult(null);
    setTimedOut(false);
    const poll = async () => {
      count++;
      try {
        const response = await fetch("/api/sessions/status", {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(6000),
          ]),
        });
        if (!response.ok) throw new Error("unavailable");
        const data = outcome.parse(await response.json());
        if (controller.signal.aborted) return;
        setResult(data);
        if (
          data.publication === "published" &&
          data.recordAvailable &&
          data.caseId
        ) {
          onSaved();
          return;
        }
        if (
          data.publication === "withheld" ||
          data.publication === "failed" ||
          data.publication === "unavailable" ||
          data.status === "unavailable"
        )
          return;
      } catch {
        if (controller.signal.aborted) return;
      }
      if (count >= 30 || Date.now() >= deadline) {
        setTimedOut(true);
        return;
      }
      timer = setTimeout(() => void poll(), 2000);
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [attempt, onSaved]);
  const saved =
    result?.publication === "published" &&
    result.recordAvailable &&
    result.caseId;
  const terminal =
    saved ||
    result?.publication === "withheld" ||
    result?.publication === "failed" ||
    result?.publication === "unavailable" ||
    result?.status === "unavailable" ||
    timedOut;
  return (
    <section
      className="info-box session-result"
      aria-label="Generated record result"
    >
      <p role="status">
        {saved
          ? `Demonstration report saved — ${result.caseStatus}.`
          : result?.publication === "withheld"
            ? "This case was withheld from publication. No public record was created."
            : result?.publication === "failed"
              ? "The report could not be saved. No generated-record link is available."
              : timedOut
                ? "We could not confirm saving in time. Check again before starting another session."
                : terminal
                  ? "A saved report is unavailable for this session."
                  : "Preparing report… Checking publication and saving."}
      </p>
      {saved ? (
        <Link className="button primary" href={`/records/${result.caseId}`}>
          View Generated Record
        </Link>
      ) : terminal && result?.publication !== "withheld" ? (
        <button
          className="button secondary"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Check report again
        </button>
      ) : null}
    </section>
  );
}
