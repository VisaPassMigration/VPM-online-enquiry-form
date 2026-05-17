# VPM Intake Platform — V1 Data Dictionary + State Machine Spec

## Document Control
- **Version:** v1.0 (draft)
- **Audience:** VPM staff, product, engineering, compliance
- **Status:** Draft for internal review
- **Scope:** Intake capture, document metadata, review workflow, risk model, points snapshot, backend stack recommendation, and API contract draft

---

## Guardrails (Mandatory)
1. **Human review is mandatory before any client outcome is sent.**
2. **No automated client outcome release is allowed.**
3. **Points outputs are preliminary only** and must be marked as unverified until staff review.
4. Client-facing wording must avoid claims that imply guaranteed outcome.

---

## 1) Intake Submission Fields

> Data type key: `string`, `enum`, `date`, `integer`, `boolean`, `array<string>`, `object`, `nullable<T>`.

| Field Name | Data Type | Required | Section | Client-Facing Label | Internal Notes | Conditional Dependency |
|---|---|---|---|---|---|---|
| fullName | string | Required | Client details | Full name | Primary identity field. | None |
| dateOfBirth | date | Required | Client details | Date of birth | ISO date preferred. | None |
| nationality | string | Required | Client details | Nationality | Normalize to country list later. | None |
| residenceCountry | string | Required | Client details | Country of residence | Current living country. | None |
| address | string | Required | Client details | Residential address | Free text in V1. | None |
| email | string | Required | Client details | Email | Must pass email format validation. | None |
| phone | string | Required | Client details | Phone | Include country code where possible. | None |
| contactMethod | enum(Email\|Phone\|WhatsApp) | Required | Client details | Preferred contact method | Channel preference only. | None |
| interestedCountry | enum(Australia\|New Zealand\|Both) | Required | Migration goal | Interested country | Intake targeting selector. | None |
| mainGoal | enum(Permanent residency\|Employer sponsorship\|Study pathway\|Visitor visa\|Partner/family visa\|Not sure) | Required | Migration goal | Main goal | Guidance intent, not decisioning. | None |
| timeframe | string | Required | Migration goal | Preferred timeframe | Free text in V1. | None |
| maritalStatus | enum(Single\|Married\|De facto\|Separated\|Divorced\|Widowed) | Optional | Family / partner | Marital status | Affects partner detail requirement. | Partner fields required if Married/De facto |
| dependants | integer (stored as string in V1 UI) | Optional | Family / partner | Number of dependants | Normalize to integer in backend. | None |
| migrateWithFamily | enum(Yes\|No) | Optional | Family / partner | Migrate with family | Affects partner detail requirement. | Partner fields required if Yes |
| partnerFullName | string | Conditionally required | Family / partner | Partner full name | Required for shared-case context. | Required if `maritalStatus` is Married/De facto OR `migrateWithFamily=Yes` |
| partnerNationality | string | Conditionally required | Family / partner | Partner nationality | Optional in other cases. | Same condition as `partnerFullName` |
| highestQualification | string | Optional | Education | Highest qualification | General education descriptor. | None |
| fieldOfStudy | string | Optional | Education | Field of study | Useful for occupation matching. | None |
| institution | string | Optional | Education | Institution | Awarding institution. | None |
| studyCountry | string | Optional | Education | Study country | Optional in V1. | None |
| completionYear | string | Optional | Education | Completion year | Convert to year type later. | None |
| currentOccupation | string | Required | Employment | Current occupation | Required for intake completeness. | None |
| migrationOccupation | string | Optional | Employment | Nominated migration occupation | Client-stated target occupation. | None |
| workExperienceYears | string | Optional | Employment | Years of experience | Convert to numeric band in V2. | None |
| currentEmployer | string | Optional | Employment | Current employer | Optional context. | None |
| dutiesSummary | string | Optional | Employment | Duties summary | Free text for reviewer context. | None |
| englishTestCompleted | enum(Yes\|No) | Optional | English | English test completed | Controls test detail fields. | If Yes, test detail fields required |
| englishTestType | string | Conditionally required | English | Test type | Example: IELTS/PTE/OET etc. | Required if `englishTestCompleted=Yes` |
| englishTestDate | date | Optional | English | Test date | Optional in V1; useful for recency. | None |
| englishScoreSummary | string | Conditionally required | English | Score summary | Free text in V1. | Required if `englishTestCompleted=Yes` |
| previousRefusal | enum(Yes\|No) | Optional | Risk screening | Previous visa refusal | Risk disclosure field. | If Yes, refusalDetails required |
| refusalDetails | string | Conditionally required | Risk screening | Refusal details | Staff-only sensitivity handling needed. | Required if `previousRefusal=Yes` |
| previousCancellation | enum(Yes\|No) | Optional | Risk screening | Previous visa cancellation | Risk disclosure field. | If Yes, cancellationOverstayDetails required |
| overstayRemoval | enum(Yes\|No) | Optional | Risk screening | Overstay/removal history | Risk disclosure field. | If Yes, cancellationOverstayDetails required |
| cancellationOverstayDetails | string | Conditionally required | Risk screening | Cancellation/overstay/removal details | Captures timeline + context. | Required if `previousCancellation=Yes` OR `overstayRemoval=Yes` |
| criminalHistory | enum(Yes\|No) | Optional | Risk screening | Criminal history | Risk disclosure field. | If Yes, criminalDetails required |
| criminalDetails | string | Conditionally required | Risk screening | Criminal history details | Restricted access recommended. | Required if `criminalHistory=Yes` |
| healthCondition | enum(Yes\|No) | Optional | Risk screening | Serious health condition | Risk disclosure field. | If Yes, healthDetails required |
| healthDetails | string | Conditionally required | Risk screening | Health details | Restricted access recommended. | Required if `healthCondition=Yes` |
| ageBracket | enum(18-24\|25-32\|33-39\|40-44\|45+) | Optional | Preliminary points | Age bracket | Preliminary points input. | None |
| englishLevel | enum(Competent\|Proficient\|Superior) | Optional | Preliminary points | English level | Preliminary points input. | None |
| overseasSkilledEmploymentYears | enum(0-2\|3-4\|5-7\|8+) | Optional | Preliminary points | Overseas skilled employment years | Preliminary points input. | None |
| australianSkilledEmploymentYears | enum(0\|1-2\|3-4\|5-7\|8+) | Optional | Preliminary points | Australian skilled employment years | Preliminary points input. | None |
| highestQualificationLevel | enum(Doctorate\|Bachelor/Masters\|Diploma/Trade\|No recognised qualification) | Optional | Preliminary points | Highest qualification level | Preliminary points input. | None |
| australianStudyRequirementCompleted | enum(Yes\|No) | Optional | Preliminary points | Australian study requirement completed | Preliminary points input. | None |
| regionalStudyCompleted | enum(Yes\|No) | Optional | Preliminary points | Regional study completed | Preliminary points input. | None |
| specialistEducationalQualification | enum(Yes\|No) | Optional | Preliminary points | Specialist educational qualification | Preliminary points input. | None |
| professionalYearCompleted | enum(Yes\|No) | Optional | Preliminary points | Professional year completed | Preliminary points input. | None |
| naatiCredential | enum(Yes\|No) | Optional | Preliminary points | NAATI / community language credential | Preliminary points input. | None |
| partnerPointsCategory | enum(Not applicable\|Single or partner is AU citizen/PR\|Partner has competent English only\|Partner has skills + competent English) | Optional | Preliminary points | Partner points category | Preliminary points input. | None |
| nominationType | enum(None\|State nomination (190)\|Regional nomination (491)) | Optional | Preliminary points | State / regional nomination | Preliminary points input. | None |

---

## 2) Document Metadata Fields

### 2.1 Document Types (V1)

| Document Type | Required by Default | Conditionally Required | Allowed File Types | Max File Size (Placeholder) | Verification Status Values |
|---|---|---|---|---|---|
| passportBioPage | Yes | No | .pdf,.jpg,.jpeg,.png | `MAX_DOC_SIZE_MB` (suggest 10) | `not_uploaded`, `uploaded_unchecked`, `under_review`, `verified`, `rejected`, `needs_reupload` |
| resume | Yes | No | .pdf,.doc,.docx | `MAX_DOC_SIZE_MB` | Same as above |
| qualificationsDoc | Yes | No | .pdf,.jpg,.jpeg,.png,.doc,.docx | `MAX_DOC_SIZE_MB` | Same as above |
| transcripts | Yes | No | .pdf,.jpg,.jpeg,.png,.doc,.docx | `MAX_DOC_SIZE_MB` | Same as above |
| englishResultDoc | No | Yes (if englishTestCompleted=Yes) | .pdf,.jpg,.jpeg,.png,.doc,.docx | `MAX_DOC_SIZE_MB` | Same as above |
| skillsAssessmentDoc | No | Yes (if client states available / pathway needs evidence) | .pdf,.jpg,.jpeg,.png,.doc,.docx | `MAX_DOC_SIZE_MB` | Same as above |
| refusalDocs | No | Yes (if refusal/cancellation declared) | .pdf,.jpg,.jpeg,.png,.doc,.docx | `MAX_DOC_SIZE_MB` | Same as above |
| otherSupportingDocs | No | No | .pdf,.jpg,.jpeg,.png,.doc,.docx | `MAX_DOC_SIZE_MB` | Same as above |

### 2.2 Shared Document Metadata Schema (Draft)
- `documentId: string (uuid)`
- `submissionId: string (uuid)`
- `documentType: enum`
- `originalFilename: string`
- `mimeType: string`
- `fileSizeBytes: integer`
- `storageKey: string`
- `uploadedAt: datetime`
- `uploadedBy: enum(client|staff)`
- `verificationStatus: enum`
- `verificationNotesInternal: nullable<string>`
- `rejectionReasonClientSafe: nullable<string>`
- `verifiedBy: nullable<string>`
- `verifiedAt: nullable<datetime>`

---

## 3) Staff Review Model

### 3.1 Review Stages
1. `intake_triage`
2. `document_completeness_check`
3. `risk_assessment`
4. `preliminary_points_review`
5. `senior_consultant_check` (required before outcome release)
6. `client_summary_ready`

### 3.2 Decision Values (Internal)
- `insufficient_information`
- `needs_more_documents`
- `needs_risk_clarification`
- `ready_for_consultant_summary`
- `manual_hold`

### 3.3 Reviewer Notes Rules
- Internal reviewer notes are **required** for every non-pass-through decision.
- Minimum note requirements:
  - rationale for decision,
  - missing evidence list (if any),
  - next action owner and due date.

### 3.4 Client-Safe Summary Rules
- Must avoid legal or guaranteed-outcome language.
- Must not expose sensitive internal risk scoring logic.
- Must describe missing items as action requests.
- Must clearly state: “Any points shown are preliminary and subject to full human review.”

### 3.5 Human Outcome Release Rules
- Only `senior_consultant` or `authorized_reviewer` role can release outcome summaries.
- Release action blocked unless:
  - all mandatory review stages are complete,
  - all mandatory documents are verified or explicitly waived with reason,
  - risk review has documented resolution,
  - release checklist is signed.

---

## 4) Workflow State Machine

### 4.1 Allowed Statuses
- `draft`
- `submitted`
- `intake_triage_in_progress`
- `awaiting_client_documents`
- `document_review_in_progress`
- `risk_review_in_progress`
- `preliminary_points_review_in_progress`
- `senior_review_in_progress`
- `ready_for_client_summary`
- `client_summary_sent`
- `on_hold`
- `closed`

### 4.2 Transition Matrix

| From Status | To Status | Who Can Trigger | Client Communication Allowed | Human Review Required Before Transition |
|---|---|---|---|---|
| draft | submitted | client | No | No |
| submitted | intake_triage_in_progress | staff_reviewer | No | Yes (triage assignment) |
| intake_triage_in_progress | awaiting_client_documents | staff_reviewer | Yes (request-only) | Yes |
| intake_triage_in_progress | document_review_in_progress | staff_reviewer | No | Yes |
| awaiting_client_documents | document_review_in_progress | staff_reviewer | No | Yes (check new uploads) |
| document_review_in_progress | risk_review_in_progress | staff_reviewer | No | Yes |
| risk_review_in_progress | preliminary_points_review_in_progress | staff_reviewer | No | Yes |
| preliminary_points_review_in_progress | senior_review_in_progress | staff_reviewer | No | Yes |
| senior_review_in_progress | ready_for_client_summary | senior_consultant | No | Yes (senior sign-off mandatory) |
| ready_for_client_summary | client_summary_sent | senior_consultant / authorized_reviewer | Yes | **Yes (mandatory final human release)** |
| *any in-progress status* | on_hold | staff_reviewer / senior_consultant | Optional (status update only) | Yes |
| on_hold | prior active status | senior_consultant | Optional | Yes |
| client_summary_sent | closed | staff_reviewer / senior_consultant | Optional | Yes |

### 4.3 State Machine Constraints
- No direct transition from `submitted` to `client_summary_sent`.
- No client outcome message can be sent before `ready_for_client_summary`.
- `client_summary_sent` must include release actor, timestamp, and immutable audit entry.

---

## 5) Risk Flag Model

### 5.1 Declared Risk Disclosures (Client-Provided)
- `previousRefusal`
- `previousCancellation`
- `overstayRemoval`
- `criminalHistory`
- `healthCondition`

### 5.2 Computed Risk Flags (System/Review)
- `declared_refusal_history`
- `declared_cancellation_history`
- `declared_overstay_or_removal`
- `declared_criminal_history`
- `declared_health_complexity`
- `preliminary_points_below_internal_reference` (preliminary guidance only)
- `incomplete_critical_documents`

### 5.3 Severity Values
- `low`
- `medium`
- `high`
- `critical`

### 5.4 Risk Resolution Fields
- `riskFlagId`
- `submissionId`
- `riskCode`
- `severity`
- `detectedAt`
- `detectedBy` (system/staff)
- `resolutionStatus` (`open`, `under_review`, `resolved`, `accepted_with_controls`)
- `resolutionSummaryInternal` (required when resolved)
- `clientSafeDisclosure` (optional)
- `resolvedBy`
- `resolvedAt`

---

## 6) Points Snapshot Model (Preliminary)

> All points are **preliminary** and must never be sent as a final outcome statement.

- `snapshotId: string (uuid)`
- `submissionId: string (uuid)`
- `calculatorVersion: string` (e.g., `v1.0.0`)
- `inputPayload: jsonb` (frozen copy of points-related inputs)
- `totalPoints: integer`
- `pointsBreakdown: jsonb` (factor-by-factor values)
- `missingItems: array<string>`
- `generatedAt: datetime`
- `generatedBy: enum(system|staff)`
- `preliminaryLabel: string` (fixed text: “Preliminary only; subject to human review.”)

---

## 7) Backend Stack Recommendation (V1)

### 7.1 Core Stack
- **Next.js Route Handlers** for server-side endpoints under `/api/*`.
- **PostgreSQL** as source-of-truth datastore.
- **Prisma** ORM for schema + migrations.
- **Zod** for request/response validation and type-safe parsing.
- **Audit logging** for every status transition and outcome-release action.

### 7.2 Suggested Module Boundaries
- `intake-submissions`
- `documents`
- `reviews`
- `risk`
- `points-snapshots`
- `workflow`
- `audit-log`

### 7.3 Audit Logging Minimum Events
- submission created/updated/submitted
- document uploaded/verified/rejected
- status transition executed (from/to/actor/reason)
- risk flag created/resolved
- points snapshot generated/re-generated
- client summary released

---

## 8) API Contract Draft (V1)

| Endpoint Name | Method | Purpose | Request Body Summary | Response Body Summary | Auth Requirement (Placeholder) |
|---|---|---|---|---|---|
| `/api/intake/submissions` | POST | Create draft submission | Core intake fields (partial allowed) | `submissionId`, saved draft payload, status | Client session / token TBD |
| `/api/intake/submissions/{id}` | PATCH | Update draft or in-review record (role-limited) | Partial field updates + optimistic lock version | Updated record + validation warnings | Client (own draft) or Staff role TBD |
| `/api/intake/submissions/{id}/submit` | POST | Mark draft as submitted | Optional declaration/consent metadata | New status + transition audit id | Client auth TBD |
| `/api/intake/submissions/{id}/documents` | POST | Upload document metadata + file handle reference | `documentType`, file info, storage reference | Document metadata record + verification status | Client or Staff auth TBD |
| `/api/intake/submissions/{id}/reviews/decision` | POST | Record stage decision | stage, decision value, internal notes, next action | Decision record + resulting status | Staff role required |
| `/api/intake/submissions/{id}/risk-flags` | GET | List declared and computed risk flags | N/A | Risk flags with severity + resolution states | Staff role required |
| `/api/intake/submissions/{id}/points-snapshot` | POST | Generate/re-generate preliminary points snapshot | points input payload or source reference | snapshot object with total + breakdown + missing items | Staff role required (or system service) |
| `/api/intake/submissions/{id}/workflow/transition` | POST | Perform controlled state transition | target status, reason, optional client message template id | transition result + current status | Staff role required |
| `/api/intake/submissions/{id}/client-summary/release` | POST | Release human-reviewed client-safe summary | approved summary text + checklist confirmation | release receipt + timestamp + actor | Senior reviewer role required |
| `/api/intake/submissions/{id}` | GET | Retrieve full submission view | N/A | intake data + docs + review + risk + points + workflow timeline | Role-based access TBD |

---

## Open Decisions Requiring VPM Confirmation
1. Final list of mandatory fields at submission time vs allowed-in-draft fields.
2. Exact allowed document MIME types and max upload size policy.
3. Staff role matrix (who can move which states in production).
4. Definition of internal reference threshold logic for preliminary points risk flagging.
5. Whether New Zealand-specific pathways need separate field groups in V1.
6. Retention policy and privacy constraints for sensitive disclosures and documents.
7. Client summary template governance and legal review process.

---

## Implementation Note
This document is a specification only and does not change application behavior by itself.
