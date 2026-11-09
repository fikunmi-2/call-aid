# Milestone 2 — structured intake and temporary SBAR

Implemented locally on 2026-11-08. Stop for review before milestone 3. No SBAR records are saved to Supabase or added to the public dashboard.

## Working behavior

- The opening gives the research disclaimer once. Ordinary symptom descriptions continue naturally. The model interprets answers and phrases one relevant follow-up; Python owns validated updates, question selection, limits, recap and completion.
- Conditional probes cover breathing with cough/chest/breathing concerns, onset pattern with headache, vomiting with abdominal discomfort, sleep changes with tiredness, and activity impact with back discomfort/injury. Other concerns use general intake. Volunteered answers skip answered questions. This is bounded demonstration coverage, not comprehensive screening.
- Pydantic models distinguish reported, unknown and declined values. Corrections replace affected fields; conflicting breathing/vomiting answers require clarification. Repeated unclear answers become unknown. Silence never becomes agreement or a symptom denial.
- Versioned `demo-rules-1.0` reports simulated markers for breathing difficulty, sudden headache onset, severe symptoms/major impact, worsening, and incomplete/unreviewed intake. It produces no clinical urgency, diagnosis, treatment or safety clearance.
- Approved templates generate SBAR from generalized categories. No unrestricted narratives, names, exact locations, source quotations or transcript fields enter reports. Case labels are generated. No location is collected or inferred in this milestone.
- The recap invites correction. Completion requires a later caller confirmation after uninterrupted recap playback. Corrections invalidate review; unknown required information still yields an incomplete report even if reviewed. Early endings preserve safe partial state.
- `/demo` validates agent-sent JSON before showing formatted SBAR and expandable JSON. The preview stays in React memory only; refresh/new session clears it. End Session requests a partial preview before disconnecting. No save claim is made.

## Verification

| Check | Result |
| --- | --- |
| Python pytest | **37 passed**: five presenting complaints, simulated markers, unknown/declined inputs, corrections, contradictions, early ending, budgets, grounding rejection, privacy/templates and SDK message/playout wiring |
| Web Vitest | **33 passed**, including admission/security/microphone regressions, Python-generated fixtures, rendering and rejection of invalid narratives/flags/status, extra fields and oversized packets |
| Playwright | **12 passed**, desktop/mobile public navigation, offline examples, microphone denial, unavailable voice and unknown records |
| Ruff check/format | Passed |
| Web ESLint, TypeScript, production build | Passed |
| Whitespace/credential exclusion | `git diff --check` passed; both `.env.local` files remain ignored |

Separate credentialed checks used LiveKit Agents **1.8.10**, Inference **`google/gemini-3.8-live`** and voice **`Puck`**. These are probabilistic checks consuming real credits:

1. **Official audio debugger:** a volunteered headache history populated eight appropriate fields. The model skipped answered questions, recapped accurately, changed onset from yesterday to today when corrected, and accepted subsequent confirmation. Closing explicitly said the temporary summary had not been saved.
2. **Actual Chromium → Next.js admission → LiveKit audio → local Python worker → validated report packet → browser preview: passed.** Synthetic speech supplied the headache history, corrected onset and confirmed the recap. Final browser JSON was `completed`, `reviewed: true`, onset `today`, no missing required fields, `record_saved: false` and `publication: not_published`. No page errors occurred. This is real service integration, but does not satisfy milestone 3's saved-record test.
3. **Second complaint via audio debugger:** a brief mild cough description led to one breathing question without refusal or repeated disclaimer. The next answer was recorded, a requested cough explanation used the approved catalog, then intake continued with one duration question. A medicine request produced a scope boundary without recommending medication. A subsequent request to end produced an explicit incomplete, unsaved closing.

The first two browser attempts failed: native audio transcription split an answer into adjacent fragments, and validation checked only the last fragment. The adapter now groups bounded, unconsumed caller fragments without borrowing previously applied answers. A regression test covers this. Repeated grounding failures fall back to clarification rather than an unbounded tool-retry loop.

## Limitations

- Audio interpretation and category mapping remain probabilistic. Quote matching establishes a source relationship, not semantic truth. Caller review reduces risk but guarantees neither accuracy nor fictional input. The prototype cannot reliably distinguish fictional from real medical information.
- Generalized categories intentionally omit nuance, exact timing and identifying context. Unsupported concerns can map to “another concern.” Unknown facts stay unknown; no extra model call fills gaps.
- The first headache run appended an unnecessary disclaimer. Instructions were tightened; later ordinary cough intake did not repeat it. An actual treatment request still caused some duplicated scope wording. Spoken output remains model-dependent.
- Scripted SDK tests cover interrupted recap delivery. The real browser check covered correction/confirmation, not exhaustive live barge-in, accents, noise or mobile hardware audio.
- Abrupt network/worker failure can prevent delivery of the final partial report. The last preview may remain an incomplete snapshot. There is deliberately no durable recovery/retry queue in this milestone.
- Worker/model cold start emitted SDK lazy-import and chat-history-order warnings; they did not prevent the successful voice test. Startup optimization, broad simulations and hosted deployment remain deferred.
- No application persistence stores audio, transcripts or SBAR content. Current utterances/evidence and SDK context exist transiently in worker memory; cloud processing still occurs. Keep recording/transcript exports/DEBUG logging disabled for public visitors. Publication is disabled entirely; absence of detected identifiers would not prove safe publication. Combination/privacy gating is required before milestone 3 exposes new cases publicly.
- Public records remain curated synthetic examples. No database migrations, new dependencies or infrastructure were added. No Vercel/hosted-agent deployment or exhaustive model safety simulation was performed here.

## Running and configuration

Existing env files and the applied milestone 1 Supabase admission migration are sufficient. **No new credentials or migrations are required.** Run Next.js and the named Python worker in separate terminals as described in the README. Keep `APP_ORIGIN` equal to the browser URL, currently `http://localhost:3001`. Restart Python after edits when using `--no-reload`.

Existing configurable application admission/call/idle limits and local-only `DEV_UNLIMITED_SESSIONS` behavior remain unchanged. External LiveKit credits/quotas still apply. The workflow moves to review by 16 accepted turns; the adapter caps total tool invocations at 40, with bounded grounding retries. There is no automatic top-up.

Canonical contracts live in `agent/src/intake_schema.py`. Regenerate with `uv run python export_contract.py` from `agent/`. Generated JSON Schema documents structural constraints; Pydantic/Zod additionally enforce templates and consistency. Shared synthetic fixtures test the contract in both languages. The README includes the synthetic-only `debug_intake.py` harness; debugger history must contain made-up information only and is separate from the public request path.

The small education catalog uses local intake definitions and general information from [MedlinePlus: Cough](https://medlineplus.gov/cough.html) and [AHRQ: SBAR](https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/sbar.html), without individual treatment guidance.

Next, only after approval: milestone 3 persistence, safe publication and the public call-to-saved-report workflow.
