import React from 'react';
import { requirePermission } from '@/server/auth/requirePermission';
import { PERMISSIONS } from '@/server/auth/permissions';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LeadRating, Prisma, RiskResolutionStatus } from '@prisma/client';

import { db } from '@/server/db';
import {

  runClearWorkflowAction,
  runClientCommunicationAction,
  runConsultationBookingAction,
  runDocumentReviewAction,
  runGenerateClearReportDraftAction,
  runInternalReviewAction,
  runLeadRatingAction,
  runReleaseConsultationInvitationAction,
  runReleaseRequestMoreInformationAction,
  updateClearReportNotesAction,
} from './actions';

export const dynamic = "force-dynamic";

type IntakePayload = Prisma.JsonObject & Record<string, string | number | boolean | undefined | null>;

const displayDate = (dateTime: Date) =>
  new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(dateTime);

const boolText = (value: boolean | undefined) => (value === undefined ? 'Not provided' : value ? 'Yes' : 'No');

const safeText = (value: string | number | undefined | null) => {
  if (value === undefined || value === null) return 'Not provided';
  if (typeof value === 'string' && !value.trim()) return 'Not provided';
  return String(value);
};

const COMM_STATUS_META: Record<string, { label: string; helper: string; pillClass: string }> = {
  drafted_internal: {
    label: 'Drafted',
    helper: 'Prepared internally, not sent.',
    pillClass: 'pill--placeholder',
  },
  pending_staff_release: {
    label: 'Pending release',
    helper: 'Staff has requested release/checks.',
    pillClass: 'pill--warning',
  },
  released: {
    label: 'Released',
    helper: 'Sent or officially released.',
    pillClass: 'pill--ok',
  },
  blocked: {
    label: 'Blocked',
    helper: 'System prevented release due to guardrails.',
    pillClass: 'pill--warning',
  },
  failed: {
    label: 'Failed',
    helper: 'Release/send was attempted but did not complete.',
    pillClass: 'pill--danger',
  },
};

const communicationTypeLabel = (type: string) => type.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
const leadRatingLabel = (rating: LeadRating | null) => rating ? rating[0].toUpperCase() + rating.slice(1) : 'Not rated';
const leadRatingPillClass = (rating: LeadRating | null) =>
  rating === 'hot' ? 'pill--danger'
    : rating === 'warm' ? 'pill--warning'
      : rating === 'cold' ? 'pill--placeholder'
        : rating === 'escalate' ? 'pill--danger'
          : 'pill--placeholder';
const LEAD_RATING_HISTORY_EVENT_TYPES = new Set([
  'lead_rating_suggested',
  'lead_rating_confirmed',
  'lead_rating_changed',
]);

const renderRows = (pairs: Array<[string, string | number | undefined | null]>) => (
  <dl className="review-grid">
    {pairs.map(([label, value]) => (
      <div key={label} className="review-grid-row">
        <dt>{label}</dt>
        <dd>{safeText(value)}</dd>
      </div>
    ))}
  </dl>
);

const previewValue = (value: unknown) => {
  if (value === undefined || value === null) return 'Not provided';
  if (typeof value === 'string') return value.trim() ? value : 'Not provided';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return 'Not provided';
  }
};

const renderClearPreviewSection = (title: string, value: unknown) => {
  if (title === 'VPM / C.L.E.A.R header') {
    return (
      <section className="section review-section" key={title}>
        <h6>{title}</h6>
        <div className="clear-pack-header">
          <img src="/brand/vpm-logo-light.png" alt="Visa Pass Migration" className="clear-pack-header__logo" />
        </div>
        <pre>{previewValue(value)}</pre>
      </section>
    );
  }

  return (
    <section className="section review-section" key={title}>
      <h6>{title}</h6>
      <pre>{previewValue(value)}</pre>
    </section>
  );
};

const INTAKE_TABS = ['overview', 'intake-details', 'documents', 'lead-rating', 'clear', 'communications', 'consultation', 'staff-tasks', 'audit-trail'] as const;
type IntakeTab = typeof INTAKE_TABS[number];

function resolveTab(tabValue: string | undefined): IntakeTab {
  if (!tabValue) return 'overview';
  return (INTAKE_TABS as readonly string[]).includes(tabValue) ? (tabValue as IntakeTab) : 'overview';
}

export default async function IntakeReviewPage({ params, searchParams }: { params: Promise<{ submissionId: string }>; searchParams?: Promise<{ tab?: string }> }) {
  await requirePermission(PERMISSIONS.VIEW_INTAKE_DETAILS);
  let canViewLeadRating = true;
  let canSuggestLeadRating = true;
  let canConfirmLeadRating = true;
  let canChangeLeadRating = true;
  let canGenerateClearReport = true;
  let canViewClear = true;
  let canMutateClear = true;
  let canEditClear = true;
  try { await requirePermission(PERMISSIONS.VIEW_LEAD_RATING); } catch { canViewLeadRating = false; }
  try { await requirePermission(PERMISSIONS.SUGGEST_LEAD_RATING); } catch { canSuggestLeadRating = false; }
  try { await requirePermission(PERMISSIONS.CONFIRM_LEAD_RATING); } catch { canConfirmLeadRating = false; }
  try { await requirePermission(PERMISSIONS.CHANGE_CONFIRMED_LEAD_RATING); } catch { canChangeLeadRating = false; }
  try { await requirePermission(PERMISSIONS.GENERATE_CLEAR_REPORT); } catch { canGenerateClearReport = false; }
  try { await requirePermission(PERMISSIONS.VIEW_CLEAR_REPORT); } catch { canViewClear = false; }
  try { await requirePermission(PERMISSIONS.PREPARE_CLEAR_REPORT); } catch { canMutateClear = false; }
  try { await requirePermission(PERMISSIONS.EDIT_CLEAR_REPORT); } catch { canEditClear = false; }
  const { submissionId } = await params;
  const submission = await db.intakeSubmission.findUnique({
    where: { id: submissionId },
    include: {
      pointsSnapshots: { orderBy: { generatedAt: 'desc' }, take: 1 },
      riskFlags: { where: { resolutionStatus: { in: [RiskResolutionStatus.open, RiskResolutionStatus.under_review] } }, orderBy: { detectedAt: 'desc' } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      currentReviewState: true,
      auditEvents: { orderBy: { eventAt: 'desc' }, take: 30 },
      clientCommunications: { orderBy: { createdAt: 'desc' } },
      consultationBookings: { orderBy: { createdAt: 'desc' } },
      clearReports: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!submission) notFound();

  const payload = (submission.payload && typeof submission.payload === 'object' && !Array.isArray(submission.payload)
    ? submission.payload
    : {}) as IntakePayload;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const activeTab = resolveTab(resolvedSearchParams?.tab);
  const latestPoints = submission.pointsSnapshots[0];
  const leadRatingHistory = submission.auditEvents.filter((event) => LEAD_RATING_HISTORY_EVENT_TYPES.has(String(event.eventType)));

  return (
    <>
      <section className="hero">
        <h1>Intake Review</h1>
        <p>Submission ID: {submission.id}</p>
        <p><Link href="/dashboard">← Back to dashboard</Link></p>
      </section>
      <section className="section review-section">
        <nav aria-label="Intake review tabs" className="button-row">
          <Link href={`/dashboard/intakes/${submission.id}?tab=overview`}>Overview</Link>
          <Link href={`/dashboard/intakes/${submission.id}?tab=intake-details`}>Intake Details</Link>
          <Link href={`/dashboard/intakes/${submission.id}?tab=documents`}>Documents</Link>
          <Link href={`/dashboard/intakes/${submission.id}?tab=lead-rating`}>Lead Rating</Link>
          <Link href={`/dashboard/intakes/${submission.id}?tab=clear`}>C.L.E.A.R</Link>
          <Link href={`/dashboard/intakes/${submission.id}?tab=communications`}>Communications</Link>
          <Link href={`/dashboard/intakes/${submission.id}?tab=consultation`}>Consultation</Link>
          <Link href={`/dashboard/intakes/${submission.id}?tab=staff-tasks`}>Staff Tasks</Link>
          <Link href={`/dashboard/intakes/${submission.id}?tab=audit-trail`}>Audit Trail</Link>
        </nav>
      </section>
      {activeTab === 'overview' && canViewLeadRating ? <section className="section review-section">
        <h3>Lead Quality Rating</h3>
        <p><strong>Internal only:</strong> Lead Quality Rating is an internal triage tool only. It is not a client outcome and must not be communicated as an assessment result.</p>
        <p>Lead rating history is shown for internal accountability and triage review. It must not be shared with clients as an assessment outcome.</p>
        {renderRows([
          ['System-suggested rating', leadRatingLabel(submission.leadRatingSuggested)],
          ['Suggested timestamp', submission.leadRatingSuggestedAt ? displayDate(submission.leadRatingSuggestedAt) : 'Not provided'],
          ['Confirmed rating', leadRatingLabel(submission.leadRating)],
          ['Confirmed timestamp', submission.leadRatingConfirmedAt ? displayDate(submission.leadRatingConfirmedAt) : 'Not provided'],
          ['Confirmed by', submission.leadRatingConfirmedBy],
          ['Lead rating reason', submission.leadRatingReason],
        ])}
        <p><span className={`pill ${leadRatingPillClass(submission.leadRating)}`}>{leadRatingLabel(submission.leadRating)}</span></p>
        <h4>Lead rating history</h4>
        {leadRatingHistory.length === 0 ? <p>No lead rating history recorded yet.</p> : <div className="communication-timeline" aria-label="Lead rating history">
          {leadRatingHistory.map((event) => (
            <article key={event.id} className="communication-card">
              <header className="communication-card__header">
                <h5>{event.eventType}</h5>
                <span className="pill pill--placeholder">{displayDate(event.eventAt)}</span>
              </header>
              <dl className="communication-card__meta">
                <div><dt>Actor name</dt><dd>{event.actorName || 'Unknown'}</dd></div>
                <div><dt>Actor role</dt><dd>{event.actorRole || 'Unknown'}</dd></div>
                <div><dt>From rating</dt><dd>{leadRatingLabel((event.fromValue as { rating?: LeadRating } | null)?.rating ?? null)}</dd></div>
                <div><dt>To rating</dt><dd>{leadRatingLabel((event.toValue as { rating?: LeadRating } | null)?.rating ?? null)}</dd></div>
                <div><dt>Internal note/reason</dt><dd>{event.internalNote || event.reason || 'Not provided'}</dd></div>
                <div><dt>Metadata</dt><dd>{event.metadata ? JSON.stringify(event.metadata) : 'Not provided'}</dd></div>
              </dl>
            </article>
          ))}
        </div>}
        <form action={runLeadRatingAction} className="intake-form">
          <input type="hidden" name="submissionId" value={submission.id} />
          <label><strong>Internal reason/note (required for confirm/change)</strong></label>
          <textarea name="reason" rows={3} />
          <label><strong>Confirmed rating (for confirm/change)</strong></label>
          <select name="rating" defaultValue={submission.leadRatingSuggested ?? submission.leadRating ?? 'warm'}>
            <option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option><option value="escalate">Escalate</option>
          </select>
          <div className="button-row">
            {canSuggestLeadRating ? <button type="submit" name="action" value="suggest">Generate Suggested Rating</button> : null}
            {canConfirmLeadRating ? <button type="submit" name="action" value="confirm">Confirm Suggested Rating</button> : null}
            {canChangeLeadRating ? <button type="submit" name="action" value="change">Change Confirmed Rating</button> : null}
          </div>
        </form>
      </section> : null}
      {activeTab === 'overview' ? <section className="section dashboard-note" role="note" aria-label="Internal intake review note">
        <strong>Important:</strong> Internal review page only. No client outcome should be released without authorised human review.
        <p>These actions update internal workflow only. No client outcome is released from this page.</p>
      </section> : null}
      {activeTab === 'overview' ? <section className="section review-section">
        <h3>Internal review actions</h3>
        <p>This action only marks the matter internally as ready for consultation invitation review. It does not send a consultation invitation or confirm any outcome.</p>
        <form action={runInternalReviewAction} className="intake-form">
          <input type="hidden" name="submissionId" value={submission.id} />
          <label htmlFor="internal-note"><strong>Internal note (required)</strong></label>
          <textarea id="internal-note" name="internalNote" required rows={4} />
          <div className="button-row">
            <button type="submit" name="action" value="mark_under_review">Mark Under Review</button>
            <button type="submit" name="action" value="request_more_information">Request More Information</button>
            <button type="submit" name="action" value="escalate_risk_review">Escalate for Risk Review</button>
            <button type="submit" name="action" value="add_internal_note">Add Internal Note</button>
            <button type="submit" name="action" value="mark_consultation_ready_internal">Mark Consultation-Ready Internally</button>
          </div>
        </form>
      </section> : null}

      {activeTab === 'clear' ? <section className="section review-section">
        <h3>C.L.E.A.R</h3>
        <p><strong>Warning:</strong> C.L.E.A.R is an internal staff-reviewed preliminary strategy report. It must not be shared with clients until reviewed and approved through the authorised workflow.</p>
        <p><strong>Internal only:</strong> C.L.E.A.R workflow actions are internal governance steps only. Approval for consultation does not confirm any visa outcome and does not send the report to the client.</p>
        <ul>
          <li>Unresolved high/critical risk may require Australia review.</li>
          <li>Escalate rating may require Australia review.</li>
          <li>Stale/unapproved reference data blocks normal approval.</li>
          <li>Unsafe wording blocks approval.</li>
          <li>Boss override requires mandatory reason.</li>
        </ul>
        {canGenerateClearReport ? <form action={runGenerateClearReportDraftAction} className="intake-form">
          <input type="hidden" name="submissionId" value={submission.id} />
          <label><strong>Internal note/reason (required)</strong></label>
          <textarea name="internalReason" required rows={3} />
          <label><strong>Override note (optional for non-hot/non-escalate)</strong></label>
          <textarea name="overrideNote" rows={2} />
          <button type="submit">Generate C.L.E.A.R Draft</button>
        </form> : <p>Draft generation is not available for your role.</p>}
      </section> : null}
      {activeTab === 'clear' && canViewClear ? <section className="section review-section">
        <h3>C.L.E.A.R reports</h3>
        {submission.clearReports.length === 0 ? <p>No C.L.E.A.R reports generated yet.</p> : <div className="communication-timeline" aria-label="C.L.E.A.R reports timeline">
          {submission.clearReports.map((report) => {
            const snapshot = (report.generatedSnapshotJson && typeof report.generatedSnapshotJson === 'object' && !Array.isArray(report.generatedSnapshotJson))
              ? report.generatedSnapshotJson as Record<string, any>
              : {};
            const referenceDatasetVersion = snapshot.referenceDataset?.datasetVersion;
            const datasetWarning = typeof snapshot.warning === 'string' ? snapshot.warning : (typeof snapshot.referenceDataset?.warning === 'string' ? snapshot.referenceDataset.warning : null);
            const hasRiskFlags = Array.isArray(snapshot.riskDisclosuresReviewNotes) && snapshot.riskDisclosuresReviewNotes.length > 0;
            const hasMissingDocuments = Boolean(snapshot.documentCompleteness?.missingDocuments?.length);
            const hasLegalGuidance = Boolean(snapshot.legalReferenceGuidance);
            const consultationApproved = report.status === 'approved_for_consultation';
            return <article key={report.id} className="communication-card">
              <header className="communication-card__header">
                <h4>{report.id}</h4>
                <span className="pill pill--placeholder">{report.status}</span>
              </header>
              <dl className="communication-card__meta">
                <div><dt>Report status</dt><dd>{report.status}</dd></div>
                <div><dt>Report version</dt><dd>{report.reportVersion}</dd></div>
                <div><dt>Created date</dt><dd>{displayDate(report.createdAt)}</dd></div>
                <div><dt>Updated date</dt><dd>{displayDate(report.updatedAt)}</dd></div>
                <div><dt>Prepared by</dt><dd>{report.preparedByStaffUserId || 'Not provided'}</dd></div>
                <div><dt>Prepared at</dt><dd>{report.preparedAt ? displayDate(report.preparedAt) : 'Not provided'}</dd></div>
                <div><dt>Reviewed at</dt><dd>{report.reviewedAt ? displayDate(report.reviewedAt) : 'Not provided'}</dd></div>
                <div><dt>Approved by</dt><dd>{report.approvedByStaffUserId || 'Not provided'}</dd></div>
                <div><dt>Approved at</dt><dd>{report.approvedAt ? displayDate(report.approvedAt) : 'Not provided'}</dd></div>
                <div><dt>Approval scope</dt><dd>{report.approvalScope || 'Not provided'}</dd></div>
                <div><dt>Requires Australia review</dt><dd>{boolText(report.requiresAustraliaReview)}</dd></div>
                <div><dt>Australia review reason</dt><dd>{report.australiaReviewReason || 'Not provided'}</dd></div>
                <div><dt>Australia reviewed by</dt><dd>{report.australiaReviewedByStaffUserId || 'Not provided'}</dd></div>
                <div><dt>Australia reviewed at</dt><dd>{report.australiaReviewedAt ? displayDate(report.australiaReviewedAt) : 'Not provided'}</dd></div>
                <div><dt>Escalation reason</dt><dd>{report.escalationReason || 'Not provided'}</dd></div>
                <div><dt>Review notes</dt><dd>{report.reviewNotes || 'Not provided'}</dd></div>
                <div><dt>Reviewed by staff user ID</dt><dd>{report.reviewedByStaffUserId || 'Not provided'}</dd></div>
                <div><dt>Shared date</dt><dd>{report.sharedAt ? displayDate(report.sharedAt) : 'Not provided'}</dd></div>
                <div><dt>Reference dataset version</dt><dd>{referenceDatasetVersion || 'Not provided'}</dd></div>
              </dl>
              {datasetWarning ? <p><strong>Reference dataset warning:</strong> {datasetWarning}</p> : null}
              <section className="section review-section">
                <h5>Consultation Pack</h5>
                <p><strong>Internal only warning:</strong> This Consultation Pack is an internal staff tool for structured discussion. It does not confirm any visa outcome and must not be treated as legal advice.</p>
                <dl className="review-grid">
                  <div className="review-grid-row"><dt>Report status marker</dt><dd><span className="pill pill--placeholder">{report.status}</span></dd></div>
                  <div className="review-grid-row"><dt>Approved for consultation marker</dt><dd>{boolText(consultationApproved)}</dd></div>
                  <div className="review-grid-row"><dt>Requires Australia review marker</dt><dd>{boolText(report.requiresAustraliaReview)}</dd></div>
                  <div className="review-grid-row"><dt>Reference dataset warning marker</dt><dd>{boolText(Boolean(datasetWarning))}</dd></div>
                  <div className="review-grid-row"><dt>Legal reference guidance marker</dt><dd>{boolText(hasLegalGuidance)}</dd></div>
                  <div className="review-grid-row"><dt>Risk flags marker</dt><dd>{boolText(hasRiskFlags)}</dd></div>
                  <div className="review-grid-row"><dt>Missing documents marker</dt><dd>{boolText(hasMissingDocuments)}</dd></div>
                </dl>
                {[
                  ['VPM / C.L.E.A.R header', { reportTitle: 'C.L.E.A.R', provider: 'Visa Pass Migration', reportVersion: report.reportVersion }],
                  ['Client snapshot', snapshot.clientSnapshot],
                  ['Consultation readiness status', { reportStatus: report.status, approvedForConsultation: consultationApproved, requiresAustraliaReview: report.requiresAustraliaReview }],
                  ['Lead rating summary', snapshot.leadRating],
                  ['Key strengths / positive pathway indicators', snapshot.ageProfileSummary],
                  ['Key concerns / risk items', snapshot.riskDisclosuresReviewNotes],
                  ['Qualification summary', snapshot.qualificationSummary],
                  ['Work experience summary', snapshot.workExperienceSummary],
                  ['English summary', snapshot.englishSummary],
                  ['Potential occupation alignment', snapshot.potentialOccupationAlignment],
                  ['Possible assessing body / skills assessment pathway', snapshot.possibleSkillsAssessmentBodyPathway],
                  ['Preliminary points position', snapshot.preliminaryPointsSnapshot],
                  ['Points improvement opportunities', snapshot.pointsImprovementStrategy],
                  ['GSM pathway overview: SC189 / SC190 / SC491', snapshot.gsmOverviewSc189Sc190Sc491],
                  ['Document completeness / missing documents', snapshot.documentCompleteness],
                  ['Internal legal reference guidance summary', snapshot.legalReferenceGuidance],
                  ['Consultation talking points', snapshot.consultationTalkingPoints],
                  ['Recommended next steps', snapshot.recommendedNextSteps],
                  ['CSA discussion prompt', 'If the client understands the strategy and wishes to proceed, discuss the Client Service Agreement pathway and next onboarding steps.'],
                  ['Estimated forward cost categories', snapshot.estimatedForwardCostCategories],
                  ['Reference dataset version', snapshot.referenceDataset],
                  ['Legal/reference warning', { referenceDatasetWarning: datasetWarning ?? 'Not provided', legalGuidancePresent: hasLegalGuidance ? 'Yes' : 'No' }],
                  ['Disclaimer', snapshot.disclaimer],
                ].map(([title, value]) => renderClearPreviewSection(title, value))}
              </section>
              {canMutateClear ? <form action={runClearWorkflowAction} className="intake-form">
                <input type="hidden" name="submissionId" value={submission.id} />
                <input type="hidden" name="clearReportId" value={report.id} />
                <label><strong>Internal note/reason (required)</strong></label>
                <textarea name="internalReason" required rows={3} />
                <p>Approval for consultation use is an internal readiness step only. It does not send the report to the client and does not confirm any visa outcome.</p>
                <div className="button-row">
                  <button type="submit" name="action" value="mark_prepared">Mark Prepared</button>
                  <button type="submit" name="action" value="approve_for_consultation">Approve for Consultation Use (Internal)</button>
                  <button type="submit" name="action" value="request_au_review">Request Australia Review</button>
                  <button type="submit" name="action" value="complete_au_review">Complete Australia Review</button>
                  <button type="submit" name="action" value="boss_override_approve">Boss Override Approval (Internal)</button>
                </div>
              </form> : <p>Read-only mode: you can view C.L.E.A.R details but cannot run workflow actions.</p>}
              <h5>Internal C.L.E.A.R editable report preview</h5>
              <p><strong>Safe language reminder:</strong> C.L.E.A.R preview language must remain preliminary, indicative, and subject to review. Do not use it as a visa outcome or guarantee.</p>
              <section className="section review-section">
                <h6>C.L.E.A.R cover/header</h6>
                <dl className="review-grid">
                  <div className="review-grid-row"><dt>C.L.E.A.R title</dt><dd>C.L.E.A.R</dd></div>
                  <div className="review-grid-row"><dt>Client Eligibility Assessment Report</dt><dd>Client Eligibility Assessment Report</dd></div>
                  <div className="review-grid-row"><dt>Visa Pass Migration</dt><dd>Visa Pass Migration</dd></div>
                  <div className="review-grid-row"><dt>Report version</dt><dd>{report.reportVersion}</dd></div>
                  <div className="review-grid-row"><dt>Internal status badge</dt><dd><span className="pill pill--placeholder">{report.status}</span></dd></div>
                </dl>
              </section>
              {[
                ['Client snapshot', snapshot.clientSnapshot],
                ['Age/profile summary', snapshot.ageProfileSummary],
                ['Qualification summary', snapshot.qualificationSummary],
                ['Work experience summary', snapshot.workExperienceSummary],
                ['English summary', snapshot.englishSummary],
                ['Potential occupation alignment', snapshot.potentialOccupationAlignment],
                ['Possible skills assessment body/pathway', snapshot.possibleSkillsAssessmentBodyPathway],
                ['Preliminary points snapshot', snapshot.preliminaryPointsSnapshot],
                ['Points improvement strategy', snapshot.pointsImprovementStrategy],
                ['GSM overview: SC189 / SC190 / SC491', snapshot.gsmOverviewSc189Sc190Sc491],
                ['Document completeness', snapshot.documentCompleteness],
                ['Risk disclosures/review notes', snapshot.riskDisclosuresReviewNotes],
                ['Consultation talking points', snapshot.consultationTalkingPoints],
                ['Recommended next steps', snapshot.recommendedNextSteps],
                ['Estimated forward cost categories', snapshot.estimatedForwardCostCategories],
                ['Reference dataset version/source notes', snapshot.referenceDataset],
                ['Legal Reference Guidance (Internal only)', snapshot.legalReferenceGuidance],
                ['Disclaimer', snapshot.disclaimer],
              ].map(([title, value]) => renderClearPreviewSection(title, value))}
              {snapshot.legalReferenceGuidance ? <section className="section review-section">
                <h6>Internal Legal Reference Guidance (Approved sources only)</h6>
                <p><strong>Internal only:</strong> Staff must verify source and approval metadata before any client discussion.</p>
                <p><strong>Warning:</strong> This content is internal guidance only and subject to authorised review based on information provided.</p>
              </section> : null}
              <section className="section review-section">
                <h6>Internal editable fields</h6>
                {renderRows([
                  ['Staff notes', report.staffNotes || 'Not provided'],
                  ['Client-facing notes', report.clientFacingNotes || 'Not provided'],
                ])}
                {canEditClear ? <form action={updateClearReportNotesAction} className="intake-form">
                  <input type="hidden" name="submissionId" value={submission.id} />
                  <input type="hidden" name="clearReportId" value={report.id} />
                  <label><strong>Staff notes</strong></label>
                  <textarea name="staffNotes" defaultValue={report.staffNotes || ''} rows={3} />
                  <label><strong>Client-facing notes</strong></label>
                  <textarea name="clientFacingNotes" defaultValue={report.clientFacingNotes || ''} rows={3} />
                  <label><strong>Internal reason/note (required)</strong></label>
                  <textarea name="internalReason" required rows={3} />
                  <button type="submit">Update C.L.E.A.R Notes</button>
                </form> : <p>Read-only mode: you can view C.L.E.A.R notes but cannot edit them.</p>}
              </section>
            </article>;
          })}
        </div>}
      </section> : null}

      {activeTab === 'communications' ? <section className="section review-section">
        <h3>Staff-Controlled Client Communications</h3>
        <p><strong>Warning:</strong> Client communication records are internal until released through an authorised staff action.</p>
        <form action={runClientCommunicationAction} className="intake-form">
          <input type="hidden" name="submissionId" value={submission.id} />
                    <label htmlFor="communication-reason"><strong>Internal reason/note (required)</strong></label>
          <textarea id="communication-reason" name="internalReason" required rows={4} />
          <div className="button-row">
            <button type="submit" name="communicationType" value="request_more_information">Prepare Request More Information</button>
            <button type="submit" name="communicationType" value="consultation_invitation">Prepare Consultation Invitation</button>
            <button type="submit" name="communicationType" value="not_progressing_hold">Prepare Not Progressing / Hold</button>
          </div>
        </form>
      </section> : null}

      {activeTab === 'communications' ? <section className="section review-section"><h3>Communication records</h3>{submission.clientCommunications.length === 0 ? <p>No communication records available.</p> : (
        <>
          <div className="communication-status-guide" role="note" aria-label="Communication status guide">
            <p><strong>Drafted</strong> = prepared internally, not sent.</p>
            <p><strong>Pending release</strong> = staff has requested release/checks.</p>
            <p><strong>Released</strong> = sent or officially released.</p>
            <p><strong>Blocked</strong> = system prevented release due to guardrails.</p>
            <p><strong>Failed</strong> = release/send was attempted but did not complete.</p>
          </div>
          <p className="communication-note">Communication history is used for audit, staff accountability, and follow-up tracking.</p>
          <div className="communication-timeline" aria-label="Client communication timeline">
            {submission.clientCommunications.map((comm) => {
              const statusMeta = COMM_STATUS_META[comm.status] ?? {
                label: comm.status,
                helper: 'Status detail unavailable.',
                pillClass: 'pill--placeholder',
              };
              const isFailed = comm.status === 'failed';

              return <article key={comm.id} className={`communication-card ${isFailed ? 'communication-card--failed' : ''}`}>
                <header className="communication-card__header">
                  <div>
                    <p className="communication-card__type">{communicationTypeLabel(comm.type)}</p>
                    <h4>{comm.subject}</h4>
                  </div>
                  <span className={`pill ${statusMeta.pillClass}`}>{statusMeta.label}</span>
                </header>
                <p className="communication-card__helper">{statusMeta.helper}</p>
                <dl className="communication-card__meta">
                  <div><dt>Body preview</dt><dd>{comm.bodyText}</dd></div>
                  <div><dt>Internal reason</dt><dd>{comm.internalReason}</dd></div>
                  <div><dt>Created date</dt><dd>{displayDate(comm.createdAt)}</dd></div>
                  <div><dt>Released date</dt><dd>{comm.releasedAt ? displayDate(comm.releasedAt) : 'Not released'}</dd></div>
                  <div><dt>Released by</dt><dd>{comm.releasedBy || 'Not available'}</dd></div>
                  <div><dt>Provider</dt><dd>{comm.provider || 'Not available'}</dd></div>
                  <div><dt>Provider message ID</dt><dd>{comm.providerMessageId || 'Not available'}</dd></div>
                  {isFailed && <div><dt>Failure reason</dt><dd className="communication-card__failure">{comm.failureReason || 'Not available'}</dd></div>}
                </dl>
                <div className="communication-card__actions">
                  {comm.type === 'request_more_information' && comm.status !== 'released' ? <form action={runReleaseRequestMoreInformationAction} className="inline-release-form"><input type="hidden" name="submissionId" value={submission.id} /><input type="hidden" name="communicationId" value={comm.id} /><input name="internalReason" required placeholder="Internal reason/checklist" /><button type="submit">Release Request Email</button></form> : null}
                  {comm.type === 'consultation_invitation' && comm.status !== 'released' ? <form action={runReleaseConsultationInvitationAction} className="inline-release-form"><input type="hidden" name="submissionId" value={submission.id} /><input type="hidden" name="communicationId" value={comm.id} /><input name="internalReason" required placeholder="Internal reason" /><button type="submit">Release Consultation Invite</button></form> : null}
                  {comm.type !== 'request_more_information' && comm.type !== 'consultation_invitation' ? <span>—</span> : null}
                </div>
              </article>;
            })}
          </div>
        </>
      )}</section> : null}
      {activeTab === 'consultation' ? <section className="section review-section">
        <h3>Consultation Booking Management</h3>
        <p>Consultation booking records are for internal operations and KPI tracking. Client outcomes and calendar events are not created from this section.</p>
        <form action={runConsultationBookingAction} className="intake-form">
          <input type="hidden" name="submissionId" value={submission.id} />
          <input type="hidden" name="action" value="create_booking" />
          <h4>Create consultation booking record</h4>
          <label><strong>Client name (required)</strong></label>
          <input name="clientName" required />
          <label><strong>Client email (required)</strong></label>
          <input name="clientEmail" type="email" required />
          <label><strong>Assigned senior staff ID</strong></label>
          <input name="assignedSeniorStaffId" />
          <label><strong>Assigned senior staff name</strong></label>
          <input name="assignedSeniorStaffName" />
          <label><strong>Booking date/time</strong></label>
          <input name="bookingDateTime" type="datetime-local" />
          <label><strong>Timezone</strong></label>
          <input name="bookingTimezone" placeholder="Australia/Sydney" />
          <label><strong>Source</strong></label>
          <select name="bookingSource" defaultValue="manual_staff_entry">
            <option value="manual_staff_entry">Manual staff entry</option>
            <option value="internal_booking_link">Internal booking link</option>
            <option value="calendly">Calendly</option>
            <option value="google_calendar">Google Calendar reference</option>
            <option value="other">Other</option>
          </select>
                    <label><strong>Internal note/reason (required)</strong></label>
          <textarea name="internalReason" required rows={3} />
          <div className="button-row"><button type="submit">Create Booking Record</button></div>
        </form>
        {submission.consultationBookings.length === 0 ? <p>No consultation booking records available.</p> : (
          <div className="communication-timeline" aria-label="Consultation booking records">
            {submission.consultationBookings.map((booking) => (
              <article key={booking.id} className="communication-card">
                <header className="communication-card__header">
                  <div>
                    <p className="communication-card__type">Booking record</p>
                    <h4>{booking.clientName}</h4>
                  </div>
                  <span className="pill pill--placeholder">{booking.status}</span>
                </header>
                <dl className="communication-card__meta">
                  <div><dt>Assigned senior staff</dt><dd>{booking.assignedSeniorStaffName || booking.assignedSeniorStaffId || 'Not assigned'}</dd></div>
                  <div><dt>Booking date/time</dt><dd>{booking.bookingDateTime ? displayDate(booking.bookingDateTime) : 'Not set'}</dd></div>
                  <div><dt>Timezone</dt><dd>{booking.bookingTimezone || 'Not set'}</dd></div>
                  <div><dt>Source</dt><dd>{booking.bookingSource}</dd></div>
                  <div><dt>Consultation outcome</dt><dd>{booking.consultationOutcome || 'Not recorded'}</dd></div>
                  <div><dt>CSA recommended</dt><dd>{booking.csaRecommended === null ? 'Not recorded' : boolText(booking.csaRecommended ?? undefined)}</dd></div>
                  <div><dt>CSA issued</dt><dd>{boolText(booking.csaIssued)}</dd></div>
                  <div><dt>Deposit paid</dt><dd>{boolText(booking.depositPaid)}</dd></div>
                  <div><dt>Internal notes</dt><dd>{booking.notesInternal || 'Not recorded'}</dd></div>
                  <div><dt>Created</dt><dd>{displayDate(booking.createdAt)}</dd></div>
                  <div><dt>Updated</dt><dd>{displayDate(booking.updatedAt)}</dd></div>
                </dl>
                <form action={runConsultationBookingAction} className="inline-release-form">
                  <input type="hidden" name="submissionId" value={submission.id} />
                  <input type="hidden" name="bookingId" value={booking.id} />
                                    <input name="internalReason" required placeholder="Internal note/reason" />
                  <button type="submit" name="action" value="mark_booked">Mark Booked</button>
                  <button type="submit" name="action" value="mark_completed">Mark Completed</button>
                  <button type="submit" name="action" value="mark_no_show">Mark No-Show</button>
                  <button type="submit" name="action" value="mark_cancelled">Mark Cancelled</button>
                  <button type="submit" name="action" value="mark_rescheduled">Mark Rescheduled</button>
                  <button type="submit" name="action" value="mark_csa_issued">Mark CSA Issued</button>
                  <button type="submit" name="action" value="mark_deposit_paid">Mark Deposit Paid</button>
                </form>
                <form action={runConsultationBookingAction} className="intake-form">
                  <input type="hidden" name="submissionId" value={submission.id} />
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <input type="hidden" name="action" value="record_outcome" />
                  <label><strong>Consultation outcome</strong></label>
                  <textarea name="consultationOutcome" required rows={3} />
                  <label><strong>CSA recommended</strong></label>
                  <select name="csaRecommended" defaultValue="false">
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                                    <label><strong>Internal note/reason (required)</strong></label>
                  <textarea name="internalReason" required rows={2} />
                  <button type="submit">Record Consultation Outcome</button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section> : null}

      {activeTab === 'intake-details' ? <section className="section review-section"><h3>Client details</h3>{renderRows([
        ['First name', payload.firstName as string], ['Last name', payload.lastName as string], ['Date of birth', payload.dateOfBirth as string],
        ['Nationality', payload.nationality as string], ['Country of residence', payload.countryOfResidence as string], ['Address', payload.address as string],
      ])}</section> : null}
      {activeTab === 'intake-details' ? <section className="section review-section"><h3>Contact details</h3>{renderRows([
        ['Email', payload.email as string], ['Phone', payload.phone as string], ['Preferred contact method', payload.contactMethod as string],
      ])}</section> : null}
      {activeTab === 'intake-details' ? <section className="section review-section"><h3>Migration goal</h3>{renderRows([
        ['Interested country', payload.interestedCountry as string], ['Main goal', payload.mainGoal as string], ['Timeframe', payload.timeframe as string],
      ])}</section> : null}
      {activeTab === 'intake-details' ? <section className="section review-section"><h3>Family / partner details</h3>{renderRows([
        ['Marital status', payload.maritalStatus as string], ['Dependants', payload.dependants as string], ['Migrate with family', payload.migrateWithFamily as string], ['Partner name', payload.partnerName as string], ['Partner nationality', payload.partnerNationality as string],
        ['Partner English competency', payload.partnerEnglishCompetency as string], ['Partner skills assessment', payload.partnerSkillsAssessment as string],
      ])}</section> : null}
      {activeTab === 'intake-details' ? <section className="section review-section"><h3>Education</h3>{renderRows([
        ['Highest qualification', payload.highestQualification as string], ['Field of study', payload.fieldOfStudy as string], ['Institution', payload.institution as string], ['Study country', payload.studyCountry as string], ['Completion year', payload.completionYear as string],
      ])}</section> : null}
      {activeTab === 'intake-details' ? <section className="section review-section"><h3>Employment</h3>{renderRows([
        ['Current occupation', payload.currentOccupation as string], ['Migration occupation', payload.migrationOccupation as string], ['Work experience years', payload.workExperienceYears as string],
        ['Current employer', payload.currentEmployer as string], ['Duties summary', payload.dutiesSummary as string],
      ])}</section> : null}
      {activeTab === 'intake-details' ? <section className="section review-section"><h3>English details</h3>{renderRows([
        ['English test taken', boolText(payload.englishTestTaken as boolean | undefined)], ['English test type', payload.englishTestType as string], ['English overall band', payload.englishOverallBand as number | undefined], ['English test date', payload.englishTestDate as string], ['English score summary', payload.englishScoreSummary as string],
      ])}</section> : null}
      {activeTab === 'intake-details' ? <section className="section review-section"><h3>Risk disclosures and risk details</h3>{renderRows([
        ['Previous visa refusal', boolText(payload.previousVisaRefusal as boolean | undefined)], ['Cancellation/overstay/removal', boolText(payload.cancellationOverstayOrRemoval as boolean | undefined)], ['Criminal history', boolText(payload.criminalHistory as boolean | undefined)], ['Health condition', boolText(payload.healthCondition as boolean | undefined)],
        ['Refusal details', payload.refusalDetails as string], ['Cancellation/overstay details', payload.cancellationOverstayDetails as string], ['Criminal details', payload.criminalDetails as string], ['Health details', payload.healthDetails as string], ['General risk details', payload.riskDetails as string],
      ])}</section> : null}

      {activeTab === 'overview' ? <section className="section review-section"><h3>Latest points snapshot</h3>{latestPoints ? renderRows([
        ['Generated at', displayDate(latestPoints.generatedAt)], ['Total points', latestPoints.totalPoints], ['Calculator version', latestPoints.calculatorVersion], ['Generated by', latestPoints.generatedBy],
        ['Missing items', latestPoints.missingItems.length ? latestPoints.missingItems.join(', ') : 'None'], ['Preliminary label', latestPoints.preliminaryLabel],
      ]) : <p>No points snapshot available yet.</p>}</section> : null}

      {activeTab === 'overview' ? <section className="section review-section"><h3>Active risk flags</h3>{submission.riskFlags.length === 0 ? <p>No active risk flags.</p> : (
        <ul className="review-list">{submission.riskFlags.map((flag) => <li key={flag.id}><strong>{flag.riskCode}</strong> ({flag.severity}) — {flag.resolutionStatus}</li>)}</ul>
      )}</section> : null}

      {activeTab === 'documents' ? <section className="section review-section"><h3>Document review (staff-controlled)</h3>{submission.documents.length === 0 ? <p>No document metadata available.</p> : (
        <div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Type</th><th>Filename</th><th>Size (bytes)</th><th>Verification status</th><th>Required/optional</th><th>Waived</th><th>Waiver reason</th><th>Verification notes</th><th>Uploaded date</th><th>Reviewed by</th><th>Actions</th></tr></thead><tbody>{submission.documents.map((doc) => {
          const required = doc.documentType !== 'otherSupportingDocs';
          return <tr key={doc.id}><td>{doc.documentType}</td><td>{doc.originalFilename}</td><td>{doc.fileSizeBytes}</td><td>{doc.verificationStatus}</td><td>{required ? 'Required' : 'Optional'}</td><td>{doc.waived ? 'Yes' : 'No'}</td><td>{doc.waivedReason || 'Not waived'}</td><td>{doc.verificationNotesInternal || 'Not provided'}</td><td>{displayDate(doc.uploadedAt)}</td><td>{doc.verifiedBy || doc.waivedBy || 'Not provided'}</td><td><form action={runDocumentReviewAction} className="intake-form"><input type="hidden" name="submissionId" value={submission.id} /><input type="hidden" name="documentId" value={doc.id} /><input type="hidden" name="isRequired" value={required ? 'true' : 'false'} /><input name="internalReason" required placeholder="Internal note/reason" /><input name="waiverReason" placeholder="Waiver reason (required for required docs)" /><div className="button-row"><button type="submit" name="action" value="accept">Mark accepted</button><button type="submit" name="action" value="reject">Mark rejected</button><button type="submit" name="action" value="needs_reupload">Mark needs re-upload</button><button type="submit" name="action" value="waive">Waive requirement</button></div></form></td></tr>;
        })}</tbody></table></div>
      )}</section> : null}

      {activeTab === 'overview' ? <section className="section review-section"><h3>Current review state</h3>{submission.currentReviewState ? renderRows([
        ['Current stage', submission.currentReviewState.currentStage], ['Last decision', submission.currentReviewState.lastDecision], ['Mandatory stages complete', boolText(submission.currentReviewState.mandatoryStagesComplete)], ['Release checklist signed', boolText(submission.currentReviewState.releaseChecklistSigned)],
        ['Senior sign-off by', submission.currentReviewState.seniorSignOffBy], ['Senior sign-off at', submission.currentReviewState.seniorSignOffAt ? displayDate(submission.currentReviewState.seniorSignOffAt) : 'Not provided'], ['Updated at', displayDate(submission.currentReviewState.updatedAt)],
      ]) : <p>No review state available yet.</p>}</section> : null}
      {activeTab === 'staff-tasks' ? <section className="section review-section"><h3>Staff task list</h3><p>No active staff tasks are currently displayed for this submission.</p><form className="intake-form"><h4>Create task</h4><input name="title" placeholder="Task title" /><textarea name="description" placeholder="Task description" /><input name="assignee" placeholder="Assignee" /><input name="dueDate" type="date" /><select name="taskType"><option>Task type</option></select><select name="priority"><option>Priority</option></select><select name="status"><option>Status</option></select><div className="button-row"><button type="button">Create task</button><button type="button">Start task</button><button type="button">Complete task</button><button type="button">Cancel task</button><button type="button">Assign task</button><button type="button">Reassign task</button></div></form></section> : null}

      {activeTab === 'audit-trail' ? <section className="section review-section"><h3>Audit timeline</h3>{submission.auditEvents.length === 0 ? <p>No audit events available.</p> : (
        <ul className="review-list">{submission.auditEvents.map((event) => <li key={event.id}><strong>{event.eventType}</strong> at {displayDate(event.eventAt)}{event.reason ? ` — ${event.reason}` : ''}</li>)}</ul>
      )}</section> : null}
    </>
  );
}
