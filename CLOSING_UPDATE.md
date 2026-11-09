# Save-confirmed conversational closing

Updated 2026-11-09. Intake questions, correction/review guards, simulated rules, SBAR fields and public-record policy remain unchanged.

## Behavior

After the caller confirms the delivered recap (or asks to end), the existing intake tool awaits a trusted persistence callback. It returns only actual persistence facts and the validated, generalized concern. The model then phrases a short closing: symptom-specific empathy, a warm wish, the actual result, and a friendly explicit goodbye. There is no fixed closing script and no repeated fiction/prototype disclaimer, diagnosis, reassurance, treatment advice, nurse review or promised clinical follow-up.

- Confirmed published record: saved successfully, available in the Records Console.
- Saving failed/unconfirmed: no success claim; explain that saving could not be completed/confirmed and invite another try.
- Publication withheld: no claim of saving or availability in the public console.
- Incomplete saved record: never describe the intake as complete.

The goodbye finishes playing before normal room shutdown. Browser End Session, network loss or the hard deadline can cut off spoken output; the existing receipt-bound status endpoint remains authoritative afterward.

## Implementation

`agent/src/closing.py` builds trusted closing facts and wording guidance. `intake_agent.py` waits for the actual `FinalizationResult`, sends the confirmed saved JSON to the browser, then lets the model close naturally. `agent.py` connects that callback to `Finalizer`. A saved public projection is preserved through later cleanup rather than being overwritten by an unsaved draft.

Previously saving happened only after deleting the room, making spoken success impossible. Migration **004** adds a service-only save wrapper that keeps capacity reserved during the farewell; `finish_demo_session` releases it using the actual saved status after room shutdown. It does not change admission limits, usage accounting, table structure or public SBAR structure. The old post-disconnect save path remains the fallback. The owner approved migration 004 after reviewing the dry run, and it was applied successfully.

Draft recommendation text now says “intake recap,” removing the old “temporary recap” wording. Published recommendations retain the correct saved wording; no existing published record needed rewriting. Frontend validation and synthetic fixtures use the matching wording.

## Verification

- **57 Python tests passed**, including blocked-until-backend-result behavior, saved/failed/withheld outcomes, mismatched case rejection, unconfirmed/interrupted review protection, playback-before-shutdown, and preserving confirmed saved JSON through cleanup.
- **55 web/database tests passed**, including unchanged admission tests, denied anonymous RPC access, idempotency and a new SQL test showing that a published record still holds capacity until audio shutdown. A retry cannot reopen a finished session.
- Ruff, TypeScript, lint and the production build passed. An unsupported test-query typing option discovered during type checking was removed without changing the assertion's matching behavior. Hosted read-only checks confirmed anonymous execution of the new save operation is denied, service-role execution is allowed, and there are no pending migrations.
- Official LiveKit audio debugger, synthetic/mock failure: the model acknowledged back discomfort, wished the caller well, explained saving could not be completed, invited another try and said “Take care.” It did not claim success.
- Official audio debugger, synthetic/mock withholding: the model acknowledged the cough, wished the caller well and said the report was not available in the public console. It did not claim a saved public record.
- **Real Supabase confirmation plus real-model spoken success passed.** A known validated synthetic case (`b24de479-0742-4b02-8aa5-6ff8457b6eb6`) was replayed at the recap-review stage. After a new spoken confirmation, the actual service-only save operation returned its existing published record idempotently; the agent then said:

> I'm sorry to hear you've been dealing with that headache. I hope you start feeling better very soon. Your information has been successfully saved and is now available in the Records Console. Take care, and goodbye.

This last test used the actual database result, not a success flag or mocked save. It deliberately reused the existing synthetic case rather than creating another record. The negative model probes used explicitly mocked backends. Browser synthetic-speech attempts had recognition/turn-timing failures; they were not reported as successful new full-intake voice tests, and intake validation was not relaxed to make them pass. The earlier full Milestone 3 acceptance test remains documented separately.

Production audio/transcript recording remains disabled. Debugger transcripts and any local audio test artifacts contain synthetic material only and are excluded from Git. The production model and dependencies are unchanged; no new application environment variables are required. Live-model wording can still vary, and physical disconnection can prevent delivery of a farewell.
