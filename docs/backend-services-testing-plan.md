# Backend Services Testing Plan

## Scope
This plan covers validation, workflow guards, risk flags, points snapshots, and audit payload consistency for backend service modules.

## Planned Tests

1. **Schema validation (`intakeSubmissionSchema`)**
   - Accepts complete core fields.
   - Rejects missing required core fields.
   - Enforces English details when `englishTestTaken=true`.
   - Enforces partner details when `hasPartner=true`.
   - Enforces risk details when any risk condition is true.
   - Validates document metadata object shape and enum values.

2. **Intake validation service**
   - `validateIntakeSubmission` throws for invalid payloads.
   - `safeValidateIntakeSubmission` returns success and structured errors.

3. **Workflow service guards**
   - Allows only safe transitions from current to next status.
   - Rejects disallowed transitions.
   - Requires `namedReviewer` for internal decision/release transitions.
   - Prevents `client_summary_sent` without completed human review.
   - Prevents `client_summary_sent` unless `humanOutcomeReleaseAllowed=true`.

4. **Risk service**
   - Produces expected flags for previous refusal, cancellation/overstay/removal, criminal history, and health condition.
   - Flags missing required documents when required document types are absent.
   - Flags low preliminary points below threshold.

5. **Points snapshot service**
   - Uses `calculateEstimatedSkilledMigrationPoints` as scoring engine.
   - Produces stable payload contract (`totalPoints`, `pointsBreakdown`, `missingItems`, labels).

6. **Audit service**
   - Produces consistent payload shape for all event types.
   - Validates status enums and includes timestamp.
   - Rejects unsupported event types and empty submissionId.

## Execution Commands
- `npm run lint`
- `npm run build`
