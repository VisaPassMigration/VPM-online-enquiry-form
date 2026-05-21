# VPM End-to-End Demo Smoke Test Checklist

## Purpose and scope
Use this checklist to manually validate the current VPM end-to-end workflow using **demo-only data** and **safe test mode**. This checklist is designed to confirm existing behaviour without changing product logic.

### Guardrails (must follow)
- Do **not** change business logic.
- Do **not** add product features.
- Do **not** change intake form behaviour.
- Do **not** send real emails.
- Do **not** generate PDFs.
- Do **not** expose C.L.E.A.R to clients.
- Do **not** use real client personal data.

---

## Demo test data (HOT skilled migration lead)
Use a synthetic profile similar to the following:

- **Lead type:** HOT skilled migration lead
- **Name:** Alex Chen (Demo)
- **Email:** `alex.chen.demo+hot@vpm-test.local`
- **Phone:** `0400 000 123` (dummy)
- **Country of citizenship:** India
- **Current location:** Australia (onshore)
- **Age band:** 29 years
- **Occupation:** Software Engineer (ANZSCO-aligned skilled role)
- **English:** Superior
- **Skilled employment:** 6+ years overseas, 2+ years Australian
- **Education:** Bachelor degree equivalent
- **Partner status:** Single (for simpler points assumptions)
- **Priority indicators:** Time-sensitive visa timeline + high readiness + complete docs intent

> If your environment requires a unique test identifier, append the current date (for example: `alex.chen.demo+hot-2026-05-21@vpm-test.local`).

---

## Environment and safety setup
1. Confirm you are in non-production/demo environment.
   - **Expected result:** Environment banner/config indicates demo or test environment only.
   - **Watch for / UX notes:** Any ambiguous environment label increases risk of accidental real communication.

2. Confirm outbound communication is in safe test mode (mock/sandbox) and does not deliver externally.
   - **Expected result:** Email send actions are intercepted, logged, or routed to sandbox only.
   - **Watch for / UX notes:** Warning labels should be explicit near send controls.

3. Confirm PDF generation path is disabled/not triggered for this smoke test.
   - **Expected result:** No PDF jobs run during this checklist.
   - **Watch for / UX notes:** If UI suggests PDF export, note clarity of “not in demo smoke test” expectation.

---

## Smoke test flows

### 1) Staff authentication / role access
1. Sign in as permitted staff role (e.g., admin/consultant).
   - **Expected result:** Successful login and redirect to authorized landing page.
   - **Watch for / UX notes:** Login error copy should be specific but secure.

2. Verify role-based access boundaries by checking at least one restricted page/action.
   - **Expected result:** Allowed roles can access; disallowed roles see clear deny/guard behavior.
   - **Watch for / UX notes:** Access denied messaging should be understandable and non-technical.

### 2) Enquiries page
1. Open Enquiries list and locate/create demo lead record.
   - **Expected result:** Demo lead appears with correct status/metadata.
   - **Watch for / UX notes:** Table filters/sorting responsiveness and visual clarity.

2. Open enquiry detail.
   - **Expected result:** Core lead summary and timeline are visible and internally consistent.
   - **Watch for / UX notes:** Missing/null state presentation quality.

### 3) FAQ/pre-intake email draft/send flow (safe test mode only)
1. Create FAQ/pre-intake draft from enquiry context.
   - **Expected result:** Draft content pre-fills appropriately for lead stage.
   - **Watch for / UX notes:** Editing controls should preserve formatting predictably.

2. Trigger send in safe test mode only.
   - **Expected result:** Send action records success in app logs/history without real external delivery.
   - **Watch for / UX notes:** “Safe mode” confirmation should be prominent before send confirmation.

### 4) Public intake form completion
1. Open public intake form using test link and submit demo HOT profile.
   - **Expected result:** Submission accepted; validation and required fields behave as currently implemented.
   - **Watch for / UX notes:** Field-level validation messages should be actionable.

2. Verify submission appears in staff-facing system.
   - **Expected result:** Intake links to the correct enquiry/lead context.
   - **Watch for / UX notes:** Duplication/conflict handling clarity.

### 5) Intake dashboard review tabs
1. Open intake dashboard and step through each review tab.
   - **Expected result:** Tab content loads without errors; data mapping looks consistent.
   - **Watch for / UX notes:** Tab labels and review progression cues should be intuitive.

2. Confirm no unintended behaviour changes versus baseline.
   - **Expected result:** Existing tab interactions remain unchanged.
   - **Watch for / UX notes:** Any regressions in load time or visual jitter.

### 6) Document review
1. Review uploaded/demo documents linked to intake.
   - **Expected result:** Document metadata/status is visible; review actions persist correctly.
   - **Watch for / UX notes:** File state indicators (pending/reviewed/approved) should be obvious.

### 7) Lead rating generation/confirmation
1. Trigger lead rating generation for the HOT lead.
   - **Expected result:** Rating is produced according to current rules and appears in lead context.
   - **Watch for / UX notes:** Confidence/reason text readability.

2. Confirm/lock in rating if workflow supports confirmation.
   - **Expected result:** Confirmation status updates and is traceable.
   - **Watch for / UX notes:** Confirmation action should require deliberate intent.

### 8) Staff tasks create/assign/start/complete
1. Create task from lead/intake context.
   - **Expected result:** Task saved with owner, due date, and status.
   - **Watch for / UX notes:** Required fields should be clearly marked.

2. Assign task to staff user, start task, then complete task.
   - **Expected result:** Status transitions are valid and reflected in activity timeline.
   - **Watch for / UX notes:** Transition controls should be easy to find.

### 9) Consultation booking lifecycle
1. Create or propose consultation slot.
   - **Expected result:** Booking record appears in pending/scheduled state.
   - **Watch for / UX notes:** Time zone handling should be explicit.

2. Move through lifecycle state changes (e.g., scheduled → completed/cancelled per test scenario).
   - **Expected result:** State transitions persist and history is auditable.
   - **Watch for / UX notes:** Prevent accidental destructive actions.

### 10) Migration Reference Data approved dataset requirement
1. Verify only approved migration reference dataset is used in relevant review/calculation views.
   - **Expected result:** UI/process indicates approved dataset source; no unapproved dataset surfaces.
   - **Watch for / UX notes:** Provenance/version visibility should be easy to verify.

### 11) Legal Reference approved guidance
1. Validate legal guidance references are drawn from approved legal reference set.
   - **Expected result:** Guidance shown is from approved sources only and appears up to date for environment data.
   - **Watch for / UX notes:** Citation/source context should be discoverable by staff.

### 12) C.L.E.A.R draft generation
1. Generate C.L.E.A.R draft internally from intake/review context.
   - **Expected result:** Draft is created for staff internal workflow only.
   - **Watch for / UX notes:** Any UI hint suggesting client visibility should be flagged.

### 13) C.L.E.A.R notes editing
1. Edit C.L.E.A.R notes using demo content.
   - **Expected result:** Edits save successfully with expected formatting/state.
   - **Watch for / UX notes:** Autosave/manual save feedback clarity.

### 14) C.L.E.A.R prepare/approve workflow
1. Move C.L.E.A.R item through prepare and approve stages with authorized role.
   - **Expected result:** Workflow state changes are role-gated and logged.
   - **Watch for / UX notes:** Approval UX should clearly show who approved and when.

### 15) C.L.E.A.R Consultation Pack view
1. Open Consultation Pack view internally.
   - **Expected result:** Pack is viewable by staff only; no client-facing exposure path is presented.
   - **Watch for / UX notes:** Visibility labels should be explicit (“Internal only”).

2. Do not generate/export PDF in this smoke test.
   - **Expected result:** No PDF generation performed.
   - **Watch for / UX notes:** Export actions should be clearly separated or disabled for demo runbook usage.

### 16) Audit log verification
1. Review audit log entries covering key actions from this checklist.
   - **Expected result:** Authentication, communication attempt (safe mode), intake submission, workflow approvals, and task transitions are all recorded.
   - **Watch for / UX notes:** Audit filters/search should support quick trace of a single demo lead.

2. Validate actor, timestamp, action type, and entity link fields.
   - **Expected result:** Audit details are complete and consistent.
   - **Watch for / UX notes:** Timestamp formatting/time zone clarity.

---

## Completion criteria
- All 16 flows executed with demo data.
- No real emails sent.
- No PDFs generated.
- No client exposure of C.L.E.A.R artifacts.
- Any failed expectation captured with reproduction notes.

---

## UX feedback capture template
For each issue, note:
- **Flow # / Step #**
- **Observed behaviour**
- **Expected behaviour**
- **Severity** (Low/Medium/High)
- **Screenshot / evidence reference**
- **Suggested improvement**

---

## Boss review notes
- **Demo date:**
- **Reviewer(s):**
- **Overall confidence:** (High / Medium / Low)
- **Go/No-go recommendation for demo:**
- **Top 3 risks before live client use:**
  1.
  2.
  3.
- **Follow-up owner(s) and due date(s):**
