# Repository showcase delivery

November 9, 2026. This work prepares Call AId for GitHub review while the owner reports nearly exhausted included LiveKit Inference credits. It changes presentation and documentation, preserving the voice workflow, strict schemas, simulated rules, persistence, database grants and existing cloud configuration.

## Interface cleanup

- Consistent **Call AId** branding and **Records Console** navigation.
- Landing link now describes both saved records and examples; the start area explicitly says fictional information only and Not for medical use.
- The voice page explains dependency on capacity/credits and offers synthetic examples without microphone access. Existing unavailable, permission, capacity and usage messages remain recoverable.
- Example links jump directly to the labelled example section. The console's published heading has clearer spacing, and example headings are semantic.
- Added a keyboard skip link, narrow-screen tag wrapping, safe generic error/retry and not-found views, and a `/demo` loading message that makes clear the microphone is off.
- Kept a genuine HTTP 404 for unknown records. A broad loading boundary initially changed this to a streamed 200; browser tests caught it, and scoping loading to `/demo` fixed it before delivery.
- Successful published recommendations already used accurate saved wording. No agent instructions, SBAR structure, screening, limits or database behavior were changed.
- No unnecessary application console output was found. Deliberate synthetic diagnostic/test harnesses remain documented; ignored local tools, env files and artifacts remain excluded.

## Screenshots

Six optimized PNGs total **456,265 bytes**:

| Image | Evidence |
| --- | --- |
| `home.png` | Fresh actual landing page |
| `voice-session.png` | Genuine archival connected browser session, synthetic input; not current availability |
| `intake.png` | Crop of genuine Milestone 2 structured intake output; explicitly historical and not a saved-record claim |
| `records.png` | Fresh actual console reading hosted synthetic demonstration records |
| `sbar-report.png` | Fresh actual detail of the previously verified hosted saved case |
| `mobile.png` | Fresh 390-pixel responsive view of that saved report |

Fresh captures use the local production build with new voice sessions disabled. Desktop viewport: 1280 × 1000. Historical files retain their original dimensions. Four older, unreferenced screenshot variants were replaced by this six-file set. No connected state was mocked, no pixel content was fabricated and no new inference call was made. See [capture provenance](SCREENSHOTS.md).

## Documentation

- Rewrote [README](../README.md) in the requested 15-part showcase structure: motivation, solution, end-to-end journey, captioned screenshots, features, stack, Mermaid architecture, schema-derived JSON excerpt, folders, local setup, deployment, actual status, future research and challenge origin.
- Moved detailed configuration, testing, limits and operational procedures into [Development and operations](DEVELOPMENT.md).
- Distinguished the verified historical hosted workflow from current credit-related unavailability. The latest local polish has not been deployed to production.
- Recorded the approved generic LiveKit documentation feedback submission in [Milestone 4](../MILESTONE_4_REPORT.md). It contained no credentials, transcripts or project identifiers and consumed no inference credits.

## Validation

| Check executed locally | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript | Passed, including final production-build type validation |
| Web/API/SQL tests | **59 passed** |
| Next.js production build | Passed after scoped loading fix |
| Python Ruff lint/format | Passed |
| Python workflow/rules/SBAR/publication/persistence/privacy tests | **68 passed** |
| Final desktop/mobile Playwright suite | **16 passed**, including unknown-record 404, synthetic examples, microphone denial and unavailable/capacity/usage messages |
| Fresh screenshot page checks | HTTP 200, no horizontal overflow or page errors; no configured credential values/private session fields in rendered HTML |
| README JSON | Every displayed field matches the actual published fixture; explicitly labelled excerpt, not a complete validation payload |
| Documentation/asset links | 47 relative paths checked with no missing targets; 13 public documentation URLs returned HTTP 200; six screenshot references present |
| Git and browser-bundle secret checks | 112 shareable files and 29 browser JS bundles checked; no configured credential/pattern matches, forbidden tracked env/tool paths or historical env/log paths. Git history also had no exact configured-credential match |

Failure browser tests use injected microphone denial and mocked service responses; they do not simulate a real hosted outage. Screenshots use real existing database records, not mocked successful calls.

## Verification boundaries and delivery

The earlier hosted voice → reviewed SBAR → Supabase → report/dashboard test passed with a newly created case and local workers stopped. Later realtime inference returned HTTP 429. The current hosted voice service and exact farewell wording were **not retested** for this task; no further inference credits were spent. Physical microphones, accents/noise and clinical effectiveness remain unverified. This is a research demonstration with no real patients, diagnosis, validated triage or telephone integration.

Production access settings, Vercel's paused state, deployed agent configuration and cloud limits were not changed. No new deployment, migration, database reset, paid subscription or authentication system. Local setup/tests use the existing tools and locked dependencies.

Changes are grouped into interface, screenshot/provenance and README/technical-documentation commits, delivered through normal pushes to [the existing repository](https://github.com/fikunmi-2/call-aid). No history rewrite or force-push. Final delivery includes confirming a clean working tree.
