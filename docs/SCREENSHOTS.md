# Screenshot provenance

Prepared November 9, 2026. These are actual application captures with synthetic data. No image generation, invented connected state, fabricated conversation or new inference call was used. Files are losslessly PNG-optimized; the complete six-image set is approximately 446 KiB.

| File | Source | Dimensions | What it establishes |
| --- | --- | --- | --- |
| [home.png](screenshots/home.png) | Fresh local production build, `/` | 1280 × 1363 | Landing page, navigation, research notice and explanatory flow |
| [voice-session.png](screenshots/voice-session.png) | Genuine earlier milestone browser voice smoke-test capture, originally `live-voice.png` | 1280 × 720 | An actual connected LiveKit room with assistant-speaking state and mute/end controls; historical UI, not present availability |
| [intake.png](screenshots/intake.png) | Genuine Milestone 2 browser capture, originally `m2-preview.png`; crop x=263, y=1260, width=754, height=730 | 754 × 730 | Structured reported values from a synthetic audio conversation; not a chat transcript or a persisted-record claim |
| [records.png](screenshots/records.png) | Fresh local production build, `/records`, hosted demonstration DB read | 1280 × 1000 | Actual statistics and recent published cases; viewport capture, not the full list |
| [sbar-report.png](screenshots/sbar-report.png) | Fresh local build, existing hosted case `696a540c-beed-4696-a989-de6f2c08b039` | 1280 × 1575 | Completed/reviewed saved report and truthful saved recommendation |
| [mobile.png](screenshots/mobile.png) | Same saved case, 390 × 844 viewport, full-page capture | 390 × 2096 | Mobile layout, not physical device audio behavior |

Fresh desktop captures use a consistent 1280 × 1000 viewport, device scale 1, disabled animations and loaded fonts. Full-page images extend vertically to fit content. Existing archive images retain their original resolution rather than being upscaled or edited to resemble the current UI. Exact timestamps for those earlier captures were not independently recorded; they are identified by milestone and original capture script.

The archive voice smoke test used actual session/token requests and LiveKit, without a mocked connection. The archive intake test supplied synthetic microphone audio to the real agent and captured validated output. Only the structured fields were framed from that older full-page image: its superseded pre-persistence UI copy is outside the crop, and its historical status is explicit in the README. No pixels or reported values were replaced.

Fresh screenshots were captured through Playwright against the local Next.js production server, with `DEMO_ENABLED=false` in the process environment. No hosted deployment/access setting was modified. Supabase access was read-only, through the existing trusted server boundary. The linked case was generated during the earlier verified hosted acceptance, not created for this screenshot task. See [Milestone 4](../MILESTONE_4_REPORT.md).

## Reading these screenshots

- All cases and audio inputs are synthetic. No names, precise locations, contact details, raw transcripts, credentials or private session metadata appear in the screenshots.
- Console totals are a point-in-time snapshot of demonstration records, not patient counts. Examples are separate from database statistics.
- Current screenshots show the polished local source. They are not evidence that these latest UI changes were deployed to production.
- Browser voice is constrained by nearly exhausted included inference credits. Historical connected screenshots do not imply a working public judge URL.
- A screenshot cannot establish conversation quality, backend security or actual save authority on its own. Tests and the independent DB verification provide separate evidence.
- Generated records expire after seven days; the captured report can remain readable here after its live URL expires.

To capture fresh static views, run the local production build with new sessions disabled, visit the listed routes with Playwright, wait for fonts/network idle and use the viewport sizes above. Do not fabricate or mock a successful connection to replace historical voice evidence. Fresh live voice screenshots require available credits and a separately authorized real test.
