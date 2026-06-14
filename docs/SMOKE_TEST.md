# Production Smoke Test Checklist

## Purpose and scope
Use this checklist to manually validate the production VPM enquiry and staff review workflow after a deployment. This is a documentation-only runbook for confirming existing behaviour with synthetic data and safe operations.

## Mandatory safety guardrails
- Use only synthetic demo data. Do not enter, paste, upload, screenshot, or reference real client personal information.
- Do not trigger any real client communication. Communication checks must stop at draft, preview, sandbox, or explicit no-send verification.
- Do not send real emails, SMS messages, WhatsApp messages, portal invitations, booking links, or other outbound notifications.
- Do not generate, export, download, or send PDFs during this smoke test unless a separate release owner explicitly authorises that action for a non-client test record.
- Do not expose C.L.E.A.R content, internal review notes, legal references, or staff-only artefacts to a client-facing surface.
- Do not change application code, Prisma schema, auth/RBAC configuration, production environment variables, or business logic as part of this checklist.
- Stop immediately and escalate if the environment, recipient, or delivery mode is ambiguous.

## Synthetic test registration data
Use a clearly fake profile such as the following. Add a date/time suffix if the system requires unique values.

- **Name:** Alex Demo
- **Email:** `alex.demo+smoke@vpm-test.local`
- **Phone:** `0400 000 000`
- **Country of citizenship:** India
- **Current location:** Australia
- **Age band:** 29 years
- **Occupation:** Software Engineer
- **English:** Superior
- **Skilled employment:** 6+ years overseas and 2+ years Australian
- **Education:** Bachelor degree equivalent
- **Partner status:** Single
- **Priority indicators:** Time-sensitive visa timeline, high readiness, and intent to provide complete documents

## Pre-flight checks
- [ ] Confirm the deployment URL and release identifier being tested.
- [ ] Confirm the staff test account and role to be used for the run.
- [ ] Confirm outbound communication is disabled, sandboxed, intercepted, or otherwise safe for smoke testing.
- [ ] Confirm no real client record will be used for the run.
- [ ] Confirm screenshots or notes do not include real client PII.

## Smoke test flows

### 1) Public home
- [ ] Open the public home page.
- [ ] Confirm the page loads without a server error, broken layout, or obvious missing assets.
- [ ] Confirm primary navigation and call-to-action links are visible.
- [ ] Confirm public content does not show staff-only data, Lead Rating, C.L.E.A.R, internal notes, audit data, or private review status.

### 2) Registration form
- [ ] Open the public registration/enquiry form from the public home page or expected direct URL.
- [ ] Confirm required fields, validation messages, and consent/acknowledgement copy appear as expected.
- [ ] Confirm the form does not ask for unnecessary sensitive information for this smoke test.
- [ ] Confirm no staff-only fields are visible on the public form.

### 3) Test registration submission
- [ ] Submit the form using the synthetic test registration data above.
- [ ] Confirm the submission succeeds and displays the expected confirmation state.
- [ ] Record only the synthetic submission identifier or timestamp needed to locate the test record.
- [ ] Confirm no real client communication is sent as a result of submitting the test registration.

### 4) Staff login
- [ ] Open the staff login page.
- [ ] Sign in with an approved staff smoke-test account.
- [ ] Confirm successful login redirects to an authorised staff area.
- [ ] Confirm failed or unauthorised access attempts show secure, non-revealing error behaviour.

### 5) Staff dashboard
- [ ] Open the staff dashboard.
- [ ] Confirm the dashboard loads without errors.
- [ ] Confirm the synthetic test registration can be located by safe identifiers such as demo name, demo email, timestamp, or status.
- [ ] Confirm dashboard summaries do not expose unrelated real client PII in screenshots or copied notes.

### 6) Review queue
- [ ] Open the review queue or equivalent intake/enquiry list.
- [ ] Confirm the synthetic registration appears with the expected status, created timestamp, and basic metadata.
- [ ] Confirm queue filters, sorting, or search can locate the synthetic record.
- [ ] Confirm no action in this step sends communication to the test registrant or any real client.

### 7) Client Review Workspace
- [ ] Open the synthetic record in the Client Review Workspace.
- [ ] Confirm core intake details, review sections, document/review placeholders, and timeline data load correctly.
- [ ] Confirm staff-only sections are not described as client-visible.
- [ ] Confirm any missing-data states are clear and do not break the workspace.

### 8) Lead Rating
- [ ] Review or generate the Lead Rating only for the synthetic test record.
- [ ] Confirm the rating, reason, and confidence/context display in the expected staff-only location.
- [ ] Confirm Lead Rating is not visible on public pages or client-facing registration screens.
- [ ] Confirm any confirmation or override action is deliberate, role-gated, and audit-friendly.

### 9) C.L.E.A.R
- [ ] Open the C.L.E.A.R area for the synthetic record if the role is authorised.
- [ ] Confirm C.L.E.A.R content is labelled internal, preliminary, staff-reviewed, and not a guaranteed visa outcome.
- [ ] Confirm draft generation, review, prepare, or approve controls are role-gated as expected.
- [ ] Do not expose, export, download, email, or otherwise send C.L.E.A.R content to a client during this smoke test.

### 10) Communications
- [ ] Open the communications area for the synthetic record.
- [ ] Confirm existing communication history, draft controls, templates, or placeholders load as expected.
- [ ] If a draft is created, use synthetic content only and leave it unsent unless the environment has a verified sandbox/no-delivery mode.
- [ ] Confirm no client communication is triggered by this smoke test.
- [ ] Confirm any attempted safe-mode communication is recorded as sandboxed, intercepted, or not delivered externally.

### 11) Staff Tasks
- [ ] Open the Staff Tasks area for the synthetic record.
- [ ] Create or review a task using synthetic smoke-test wording only, if task creation is part of the deployed workflow.
- [ ] Confirm assignment, due date, start, completion, or status transitions behave as expected.
- [ ] Confirm task activity is linked to the synthetic record and does not notify real clients.

### 12) Audit Trail
- [ ] Open the Audit Trail or audit log for the synthetic record.
- [ ] Confirm key smoke-test actions are recorded, including registration creation, staff access/review actions, Lead Rating activity, C.L.E.A.R workflow activity where applicable, communications draft/no-send checks, and task transitions.
- [ ] Confirm audit entries include actor, timestamp, action type, entity reference, and relevant before/after context where expected.
- [ ] Confirm audit output does not require exposing real client PII to validate this smoke test.

## Completion criteria
- [ ] Public home, registration form, test registration, staff login, dashboard, review queue, Client Review Workspace, Lead Rating, C.L.E.A.R, Communications, Staff Tasks, and Audit Trail checks were completed.
- [ ] Only synthetic demo data was used.
- [ ] No real client PII was used, copied, exported, or captured.
- [ ] No real client communication was triggered.
- [ ] No C.L.E.A.R content was exposed to a client-facing surface.
- [ ] Any defects, unexpected behaviour, or ambiguous safety signals were documented with synthetic-only evidence.

## Issue capture template
For each issue found, record:

- **Flow / step:**
- **Synthetic record identifier:**
- **Observed behaviour:**
- **Expected behaviour:**
- **Severity:** Low / Medium / High
- **Evidence:** Synthetic-only screenshot, log reference, or timestamp
- **Owner / follow-up:**

## Run sign-off
- **Run date:**
- **Deployment URL / release:**
- **Reviewer(s):**
- **Overall confidence:** High / Medium / Low
- **Go / no-go recommendation:**
- **Top risks before wider use:**
  1.
  2.
  3.
