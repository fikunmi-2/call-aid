# Call AId

**Not for medical use.** Call AId is a public browser-based research prototype exploring AI-powered symptom intake for rural Saskatchewan. Use fictional information only; it is not a healthcare service.

The approved architecture uses Next.js, React, TypeScript and Tailwind for the public web app; LiveKit Cloud and a Python LiveKit Agents worker for voice; Pydantic for validation; and Supabase PostgreSQL for trusted persistence. The web app targets Vercel. No user authentication or mandatory scenario selection is planned.

Public routes: `/`, `/demo`, `/records` and `/records/[id]`. Published records will use generated case labels, generalized information and approved SBAR templates. Never publish real identifiers, precise locations or raw transcripts.

Implementation milestones:

1. Public frontend and working LiveKit voice conversation.
2. Structured intake, simulated screening rules and SBAR generation.
3. Supabase persistence and a public records console.
4. Deployment, testing and documentation.

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for architecture, safety boundaries, proposed schema and acceptance checks. Implement and test one milestone at a time, then stop for review.
