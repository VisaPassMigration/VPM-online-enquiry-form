# VPM-OS — working rules

Read this before making any change to this repository.

## What this is

VPM-OS is the internal operating system for **Visa Pass Migration**, an OMARA-registered
Australian migration practice (MARN 2318205). It is used by VPM staff — not by clients,
except for the public registration form.

Staff use it to manage: client registrations, intake review, lead rating, C.L.E.A.R.
preparation, consultation readiness, CSA steps, deposit tracking, and onboarding.

Stack: Next.js / TypeScript / Prisma / PostgreSQL (Neon). Deployed on Vercel.
Repo: `VisaPassMigration/VPM-online-enquiry-form`.

## Who it must serve

Staff are migration professionals, not developers. Several are new to the system.
Every screen should be trainable in minutes, not hours.

The bar: **premium, calm, simple, staff-friendly, easy to train.**

## Product rules

- Plain-English labels. Never expose raw database or enum names in the UI.
- No duplicated wording across a page.
- No developer-default UI.
- Don't overwhelm staff with explanatory text — say it once, briefly.
- Every important staff action needs four states: loading, success, no-change, error.
- Workflow stage cards must show progress visually.
- Staff should not have to scroll excessively to perform key workflow actions.
- Dates shown to staff use `Intl.DateTimeFormat` with `en-AU` and `Australia/Perth`.

## Compliance rules — non-negotiable

- **No client communication is ever triggered automatically.** Every outbound message
  requires an explicit staff release action.
- **C.L.E.A.R. content stays internal** unless explicitly authorised for release.
- **Never state or imply a guaranteed visa outcome**, eligibility result, invitation, or
  approval — anywhere, in any copy, client-facing or internal.
- Points estimates are always labelled preliminary and subject to VPM review.
- Do not claim secure document storage exists. It does not yet.
- Do not invent legislation, policy, case law, or authorities in any copy.

## Locked zones — stop and ask

Do not change any of the following without explicit written approval from Joe in the task
brief. If a task appears to require one, **stop and report rather than proceed**:

- `prisma/schema.prisma` — any model, field, enum, or migration
- Authentication and RBAC — route guards, permissions, role checks, session handling
- Environment variables and secrets
- Anything that could send a client communication
- C.L.E.A.R. exposure and approval-gating rules

## Branch and PR rules

These exist because they were broken before, and it cost weeks.

- **One task, one branch, always cut fresh from `main`.**
- **Never stack a new task onto an existing feature branch.** If the current branch has not
  been merged, do not build on it — branch from `main` instead.
- Keep each PR small enough to review in one sitting. If a task grows past roughly
  10 files, stop and propose splitting it.
- Never mix cosmetic polish with workflow, schema, auth, or client-communication changes
  in the same PR.
- Rebase against `main` before asking for review if the branch is more than a few days old.
- **Never merge.** Merge authority belongs to Joe alone.
- If `git push` or `git fetch` fails, say so plainly and do not report the task as complete.
  A local success that never reached GitHub is a failure.

## Testing

Every change runs, and must pass:

```
npm test
npm run build
```

Report results honestly, including any pre-existing warnings. Do not describe a task as
done if either command failed.

## Known state

- There is **no `StaffTask` model** in the schema and none is planned. Staff tasks are
  surfaced from `StaffReview.nextActionOwner` and `StaffReview.nextActionDueDate`.
  A guard in `src/app/dashboard/page.tsx` protects against the missing delegate — keep it.
- Actor identity fields (`reviewedBy`, `seniorSignOffBy`, `verifiedBy`, `resolvedBy`,
  `releasedBy`) are plain strings, not `StaffUser` relations. Normalising them is planned
  future work — do not attempt it opportunistically.
- `AuditEvent.actorStaffUserId` and `EnquiryCommunication.sentByStaffUserId` are proper
  relations. Follow that pattern for anything new.
- The build reports a pre-existing Next.js `<img>` lint warning in
  `src/app/dashboard/intakes/[submissionId]/page.tsx`. Known, not yours to fix silently.

## Brand

- Deep navy `#0C1420`
- Dark blue `#08324F`
- Cream/gold tint `#FFEFCA` — accents only, used sparingly
- Copper/brown `#733717` — very sparing, warm or warning emphasis only
- White and soft off-white backgrounds

Montserrat preferred for headings. Do not introduce fragile external font loading —
if Google Fonts cannot be fetched at build time, use a robust fallback and say so.

Tagline: *Your Pathway. Your Future.*

The public route stays `/intake`, but public-facing copy always calls it the
**Registration Form**.

## Tone

Australian English. Warm, professional, confident. No jargon, no hype, no filler.
Client-facing copy is plain and reassuring. Internal copy is direct and brief.
