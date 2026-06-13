import React from 'react';
import { requirePermission } from '@/server/auth/requirePermission';
import { PERMISSIONS } from '@/server/auth/permissions';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LeadRating, Prisma, RiskResolutionStatus } from '@prisma/client';

import { db } from '@/server/db';
import { displayRegistrationReference } from '@/server/registrationReferences';
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
import { LeadRatingActionForm } from './LeadRatingActionForm';
import { LeadRatingSubmitButton } from './LeadRatingSubmitButton';

export const dynamic = "force-dynamic";

type IntakePayload = Prisma.JsonObject & Record<string, string | number | boolean | undefined | null>;

const displayDate = (dateTime: Date) =>
  new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Australia/Perth' }).format(dateTime);

const boolText = (value: boolean | undefined) => (value === undefined ? 'Not provided' : value ? 'Yes' : 'No');

const safeText = (value: string | number | undefined | null) => {
  if (value === undefined || value === null) return 'Not provided';
  if (typeof value === 'string' && !value.trim()) return 'Not provided';
  return String(value);
};


const humanizeValue = (value: string | undefined | null) => {
  if (!value) return 'Not provided';
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
  const label = words.join(' ');
  return label ? label[0].toUpperCase() + label.slice(1) : 'Not provided';
};

const reviewStatusLabel = (status: string | undefined | null) => {
  const labels: Record<string, string> = {
    submitted: 'Registration submitted',
    intake_triage_in_progress: 'Intake triage in progress',
    awaiting_client_documents: 'Awaiting information internally',
    risk_review_in_progress: 'Risk review in progress',
    ready_for_client_summary: 'Progressing to consultation',
  };
  return status ? labels[status] ?? humanizeValue(status) : 'Not provided';
};

const stageLabel = (stage: string | undefined | null) => {
  const labels: Record<string, string> = {
    registration_submitted: 'Registration submitted',
    intake_triage: 'Intake triage',
    lead_rating_confirmed: 'Lead rating confirmed',
    document_completeness_check: 'Document completeness check',
    risk_assessment: 'Risk assessment',
    client_summary_ready: 'Client summary ready',
    clear_preparation: 'CLEAR preparation',
    senior_review: 'Senior review',
    consultation_invite: 'Consultation invite',
    consultation_completed: 'Consultation completed',
    csa_issued: 'CSA issued',
    deposit_paid: 'Deposit paid',
    client_onboarded: 'Client onboarded',
  };
  return stage ? labels[stage] ?? humanizeValue(stage) : 'Registration submitted';
};

const auditEventLabel = (eventType: string) => humanizeValue(eventType);

const ratingFromValue = (value: unknown): LeadRating | null => {
  if (value === 'cold' || value === 'warm' || value === 'hot' || value === 'escalate') return value;
  if (value && typeof value === 'object' && 'rating' in value) {
    const rating = (value as { rating?: LeadRating | null }).rating;
    return rating ?? null;
  }
  return null;
};

const metadataBadges = (metadata: unknown) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  return Object.entries(metadata as Record<string, unknown>)
    .filter(([, value]) => value === true)
    .map(([key]) => humanizeValue(key));
};

const clientNameFromPayload = (payload: IntakePayload) => {
  const fullName = [payload.firstName, payload.lastName]
    .map((part) => typeof part === 'string' ? part.trim() : '')
    .filter(Boolean)
    .join(' ');
  return fullName || safeText(payload.fullName as string | undefined);
};

const occupationFromPayload = (payload: IntakePayload) => {
  const occupation = payload.currentOccupation || payload.migrationOccupation || payload.occupation || payload.intendedPathway || payload.mainGoal;
  return safeText(occupation as string | undefined);
};

const WORKFLOW_STAGES = [
  { key: 'registration_submitted', label: 'Registration submitted' },
  { key: 'intake_triage', label: 'Intake triage' },
  { key: 'lead_rating_confirmed', label: 'Lead rating confirmed' },
  { key: 'clear_preparation', label: 'CLEAR preparation' },
  { key: 'senior_review', label: 'Senior review' },
  { key: 'consultation_invite', label: 'Consultation invite' },
  { key: 'consultation_completed', label: 'Consultation completed' },
  { key: 'csa_issued', label: 'CSA issued' },
  { key: 'deposit_paid', label: 'Deposit paid' },
  { key: 'client_onboarded', label: 'Client onboarded' },
] as const;

const stageRankForSubmission = (submission: {
  status?: string | null;
  leadRating?: LeadRating | null;
  currentReviewState?: { currentStage?: string | null } | null;
  clearReports: Array<{ status: string }>;
  consultationBookings: Array<{ status: string; csaIssued?: boolean | null; depositPaid?: boolean | null }>;
}) => {
  const stage = submission.currentReviewState?.currentStage;
  const consultationBookings = submission.consultationBookings ?? [];
  const clearReports = submission.clearReports ?? [];
  if (consultationBookings.some((booking) => booking.depositPaid)) return 8;
  if (consultationBookings.some((booking) => booking.csaIssued)) return 7;
  if (consultationBookings.some((booking) => booking.status === 'completed')) return 6;
  if (consultationBookings.length > 0) return 5;
  if (stage === 'client_summary_ready' || submission.status === 'ready_for_client_summary') return 5;
  if (clearReports.some((report) => report.status === 'approved_for_consultation')) return 4;
  if (clearReports.length > 0) return 3;
  if (submission.leadRating) return 2;
  if (stage === 'intake_triage' || submission.status === 'intake_triage_in_progress') return 1;
  return 0;
};

const indicativePointsRange = (points: number | undefined | null) => {
  if (typeof points !== 'number') return 'Not available';
  if (points >= 85) return '85+ high preliminary range';
  if (points >= 75) return '75–84 strong preliminary range';
  if (points >= 65) return '65–74 threshold preliminary range';
  return 'Below 65 preliminary range';
};

const pointsBreakdownItems = (breakdown: unknown) => {
  if (!breakdown || typeof breakdown !== 'object' || Array.isArray(breakdown)) return [];
  return Object.entries(breakdown as Record<string, unknown>)
    .filter(([, value]) => typeof value === 'number' || typeof value === 'string')
    .map(([key, value]) => `${humanizeValue(key)}: ${value}`)
    .slice(0, 6);
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

const isRawPreviewValue = (value: unknown) => Boolean(value && typeof value === 'object');

const BackToTopLink = () => <p className="review-back-to-top"><a href="#client-review-top">↑ Back to top</a></p>;

const PresetReasonOptions = ({ options }: { options: string[] }) => (
  <select name="presetReason" defaultValue="" aria-label="Preset reason">
    <option value="">Preset reason (optional)</option>
    {options.map((option) => <option key={option} value={option}>{option}</option>)}
  </select>
);

const renderClearPreviewValue = (value: unknown) => {
  if (isRawPreviewValue(value)) {
    return (
      <details className="technical-details">
        <summary>Technical details</summary>
        <pre>{previewValue(value)}</pre>
      </details>
    );
  }

  return <pre>{previewValue(value)}</pre>;
};

const renderClearPreviewSection = (title: string, value: unknown) => {
  if (title === 'VPM / C.L.E.A.R header') {
    return (
      <section className="section review-section" key={title}>
        <h6>{title}</h6>
        <div className="clear-pack-header">
          <img src="/brand/vpm-logo-light.png" alt="Visa Pass Migration" className="clear-pack-header__logo" />
        </div>
        {renderClearPreviewValue(value)}
      </section>
    );
  }

  return (
    <section className="section review-section" key={title}>
      <h6>{title}</h6>
      {renderClearPreviewValue(value)}
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
  const clientName = clientNameFromPayload(payload);
  const occupation = occupationFromPayload(payload);
  const workflowStageIndex = stageRankForSubmission(submission);
  const currentWorkflowStage = WORKFLOW_STAGES[workflowStageIndex];
  const activeRiskFlagCount = submission.riskFlags.length;
  const riskLabel = activeRiskFlagCount === 0 ? 'No active flags' : `${activeRiskFlagCount} active ${activeRiskFlagCount === 1 ? 'flag' : 'flags'}`;
  const missingItems = latestPoints?.missingItems ?? [];
  const latestStaffAction = submission.auditEvents.find((event) => event.eventSource === 'staff_review_action' || event.relatedEntityType === 'staff_review');
  const pointsBreakdown = pointsBreakdownItems(latestPoints?.pointsBreakdown);
  const hasSkilledOccupation = occupation !== 'Not provided';
  const hasKeyInformation = clientName !== 'Not provided' && (payload.email || payload.phone) && hasSkilledOccupation;
  const submittedDisplayDate = submission.submittedAt ?? submission.createdAt ?? new Date(0);
  const registrationReference = displayRegistrationReference(submission);
  const isFallbackRegistrationReference = !submission.registrationReference;

  return (
    <>
      <section id="client-review-top" className="hero client-review-hero">
        <div>
          <p className="eyebrow">Internal staff workspace</p>
          <h1>Client Review Workspace</h1>
          <p className="registration-reference-label">Registration Reference</p>
          <p className="registration-reference-value">{registrationReference}</p>
          {isFallbackRegistrationReference ? <p className="client-review-hero__secondary">Fallback reference shown for an older registration without a persisted reference.</p> : null}
          <h2>{clientName}{occupation !== 'Not provided' ? ` — ${occupation}` : ''}</h2>
          <details className="technical-details client-review-technical-details">
            <summary>Technical details</summary>
            <dl>
              <div><dt>Full submission UUID</dt><dd><input aria-label="Full submission UUID" readOnly value={submission.id} /></dd></div>
              <div><dt>Reference source</dt><dd>{isFallbackRegistrationReference ? 'Fallback derived from date and UUID suffix' : 'Persisted registration reference'}</dd></div>
            </dl>
          </details>
          <p>Submitted: {displayDate(submittedDisplayDate)}</p>
          <p><Link href="/dashboard">← Back to dashboard</Link></p>
        </div>
        <dl className="client-review-snapshot" aria-label="Client review snapshot">
          <div><dt>Status</dt><dd>{reviewStatusLabel(submission.status)}</dd></div>
          <div><dt>Lead rating</dt><dd><span className={`pill ${leadRatingPillClass(submission.leadRating)}`}>{leadRatingLabel(submission.leadRating)}</span></dd></div>
          <div><dt>Points</dt><dd>{latestPoints ? latestPoints.totalPoints : 'Not available'}</dd></div>
          <div><dt>Risk</dt><dd><span className={`pill ${activeRiskFlagCount === 0 ? 'pill--ok' : 'pill--danger'}`}>{riskLabel}</span></dd></div>
        </dl>
      </section>
      <section className="section review-section workflow-snapshot" aria-labelledby="workflow-stage-snapshot-heading">
        <div className="section-heading-row">
          <div>
            <h3 id="workflow-stage-snapshot-heading">Workflow Stage Snapshot</h3>
            <p>Internal production-line view only. Future stages are shown for staff planning and are not client outcomes.</p>
          </div>
          <span className="pill pill--placeholder">Current stage: {currentWorkflowStage.label}</span>
        </div>
        <ol className="workflow-stage-list">
          {WORKFLOW_STAGES.map((stage, index) => {
            const state = index < workflowStageIndex ? 'complete' : index === workflowStageIndex ? 'current' : 'upcoming';
            return <li key={stage.key} className={`workflow-stage workflow-stage--${state}`}>
              <span className="workflow-stage__number">{index + 1}</span>
              <span className="workflow-stage__label">{stage.label}</span>
              <span className="workflow-stage__state">{state === 'complete' ? 'Complete internally' : state === 'current' ? 'Current stage' : 'Upcoming / not started'}</span>
            </li>;
          })}
        </ol>
      </section>
      <section className="section review-section case-quality-snapshot" aria-labelledby="case-quality-snapshot-heading">
        <h3 id="case-quality-snapshot-heading">Case Quality Snapshot</h3>
        <div className="quality-grid">
          <article className="quality-card quality-card--positive">
            <h4>Strong indicators</h4>
            <ul>
              {latestPoints && latestPoints.totalPoints >= 75 ? <li>High preliminary points</li> : <li>Preliminary points available for review</li>}
              {activeRiskFlagCount === 0 ? <li>No active risk flags</li> : null}
              {hasSkilledOccupation ? <li>Skilled occupation declared</li> : null}
              {hasKeyInformation ? <li>Key information provided</li> : null}
            </ul>
          </article>
          <article className="quality-card quality-card--warning">
            <h4>Watch points</h4>
            <ul>
              <li>Confirm evidence before advice</li>
              <li>Confirm English / skills assessment if applicable</li>
              <li>Confirm age and time sensitivity if relevant</li>
              {activeRiskFlagCount > 0 ? <li>Active risk flag requires staff review</li> : null}
            </ul>
          </article>
          <article className="quality-card quality-card--missing">
            <h4>Missing information</h4>
            {missingItems.length ? <ul>{missingItems.map((item) => <li key={item}>{humanizeValue(item)}</li>)}</ul> : <p>No missing points items recorded in latest snapshot.</p>}
          </article>
          <article className="quality-card quality-card--action">
            <h4>Recommended next staff action</h4>
            <p>{activeRiskFlagCount > 0 ? 'Resolve or escalate active risk flags before progressing.' : submission.leadRating ? 'Prepare the next internal review step and confirm evidence before any client discussion.' : 'Generate or confirm the internal lead rating before CLEAR preparation.'}</p>
          </article>
        </div>
      </section>
      <section id="review-workspace-tabs" className="section review-section review-tab-anchor">
        <nav aria-label="Intake review tabs" className="review-tab-list">
          {[
            ['overview', 'Overview'],
            ['intake-details', 'Intake Details'],
            ['documents', 'Documents'],
            ['lead-rating', 'Lead Rating'],
            ['clear', 'C.L.E.A.R'],
            ['communications', 'Communications'],
            ['consultation', 'Consultation'],
            ['staff-tasks', 'Staff Tasks'],
            ['audit-trail', 'Audit Trail'],
          ].map(([tab, label]) => <Link key={tab} className={`review-tab ${activeTab === tab ? 'review-tab--active' : ''}`} href={`/dashboard/intakes/${submission.id}?tab=${tab}#review-workspace-tabs`} scroll={false}>{label}</Link>)}
        </nav>
      </section>
      {(activeTab === 'overview' || activeTab === 'lead-rating') && canViewLeadRating ? <section className="section review-section">
        <div className="section-heading-row">
          <div>
            <h3>Lead Quality Rating</h3>
            <p><strong>Internal use only:</strong> Lead ratings are staff triage classifications and must not be communicated to clients as assessment outcomes.</p>
          </div>
          <span className={`pill lead-rating-feature ${leadRatingPillClass(submission.leadRating)}`}>Confirmed: {leadRatingLabel(submission.leadRating)}</span>
        </div>
        {renderRows([
          ['System-suggested rating', leadRatingLabel(submission.leadRatingSuggested)],
          ['Confirmed rating', leadRatingLabel(submission.leadRating)],
          ['Confirmed by', submission.leadRatingConfirmedBy],
          ['Confirmed timestamp', submission.leadRatingConfirmedAt ? displayDate(submission.leadRatingConfirmedAt) : 'Not provided'],
          ['Rating reason', submission.leadRatingReason],
          ['Suggested timestamp', submission.leadRatingSuggestedAt ? displayDate(submission.leadRatingSuggestedAt) : 'Not provided'],
        ])}
        <details className="history-details">
          <summary>Lead rating history — {leadRatingHistory.length} {leadRatingHistory.length === 1 ? 'event' : 'events'} <span>Show history</span></summary>
          {leadRatingHistory.length === 0 ? <p>No lead rating history recorded yet.</p> : <div className="communication-timeline" aria-label="Lead rating history">
            {leadRatingHistory.map((event) => {
              const badges = metadataBadges(event.metadata);
              return <article key={event.id} className="communication-card">
                <header className="communication-card__header">
                  <h5>{auditEventLabel(String(event.eventType))}</h5>
                  <span className="pill pill--placeholder">{displayDate(event.eventAt)}</span>
                </header>
                <dl className="communication-card__meta">
                  <div><dt>Timestamp</dt><dd>{displayDate(event.eventAt)}</dd></div>
                  <div><dt>Actor name</dt><dd>{event.actorName || 'Unknown'}</dd></div>
                  <div><dt>Actor role</dt><dd>{humanizeValue(event.actorRole || 'unknown')}</dd></div>
                  <div><dt>From rating</dt><dd>{leadRatingLabel(ratingFromValue(event.fromValue))}</dd></div>
                  <div><dt>To rating</dt><dd>{leadRatingLabel(ratingFromValue(event.toValue))}</dd></div>
                  <div><dt>Internal note/reason</dt><dd>{event.internalNote || event.reason || 'Not provided'}</dd></div>
                </dl>
                {badges.length ? <div className="metadata-badge-row" aria-label="Lead rating metadata badges">{badges.map((badge) => <span key={badge} className="pill pill--placeholder">{badge}</span>)}</div> : null}
              </article>;
            })}
          </div>}
        </details>
        <LeadRatingActionForm action={runLeadRatingAction}>
          <input type="hidden" name="submissionId" value={submission.id} />
          <label><strong>Internal file note / reason for rating decision</strong></label>
          <p className="form-helper">This note is internal only and is used for audit history. It is not sent to the client.</p>
          <PresetReasonOptions options={['System suggestion reviewed', 'Confirmed after evidence check', 'Manual rating change after senior review']} />
          <textarea name="reason" rows={3} placeholder="Optional detail for audit history" />
          <label><strong>Confirmed rating (for confirm/change)</strong></label>
          <select name="rating" defaultValue={submission.leadRatingSuggested ?? submission.leadRating ?? 'warm'}>
            <option value="hot">Hot</option><option value="warm">Warm</option><option value="cold">Cold</option><option value="escalate">Escalate</option>
          </select>
          <p className="form-helper">Generate Suggested Rating creates or updates a system suggestion only. Confirm Suggested Rating confirms the current suggested internal rating. Change Confirmed Rating manually changes the confirmed internal rating.</p>
          <div className="button-row action-button-row">
            {canSuggestLeadRating ? <LeadRatingSubmitButton className="button-secondary button-small" actionValue="suggest" pendingLabel="Updating rating…">Generate Suggested Rating</LeadRatingSubmitButton> : null}
            {canConfirmLeadRating ? <LeadRatingSubmitButton className="button-primary button-small" actionValue="confirm" pendingLabel="Updating rating…">Confirm Suggested Rating</LeadRatingSubmitButton> : null}
            {canChangeLeadRating ? <LeadRatingSubmitButton className="button-secondary button-small" actionValue="change" pendingLabel="Updating rating…">Change Confirmed Rating</LeadRatingSubmitButton> : null}
          </div>
        </LeadRatingActionForm>
      </section> : null}
      {activeTab === 'overview' ? <section className="section dashboard-note" role="note" aria-label="Internal intake review note">
        <strong>Important:</strong> Internal review page only. No client outcome should be released without authorised human review.
        <p>These actions update internal workflow only. No client outcome is released from this page.</p>
      </section> : null}
      {activeTab === 'overview' ? <section className="section review-section">
        <h3>Internal Review Actions</h3>
        <p><strong>Internal workflow only:</strong> Internal review actions update internal workflow status only. They do not send client communications, consultation invitations, or migration advice.</p>
        {latestStaffAction ? <div className="status-feedback" role="status">
          <strong>Status updated: {reviewStatusLabel(submission.status)}.</strong>
          <span> Internal review state updated successfully. Latest action: {auditEventLabel(String(latestStaffAction.eventType))} at {displayDate(latestStaffAction.eventAt)}.</span>
        </div> : null}
        <form action={runInternalReviewAction} className="intake-form">
          <input type="hidden" name="submissionId" value={submission.id} />
          <label htmlFor="internal-note"><strong>Internal note</strong></label>
          <PresetReasonOptions options={['Routine workflow update', 'Client information follow-up', 'Risk review escalation', 'Consultation readiness check']} />
          <textarea id="internal-note" name="internalNote" rows={4} placeholder="Optional detail for audit history" />
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
        {submission.clearReports.length === 0 ? <div className="status-feedback status-feedback--info">CLEAR preparation will be available after internal review is confirmed. No CLEAR is generated or sent automatically from this page.</div> : null}
        <ul>
          <li>Unresolved high/critical risk may require Australia review.</li>
          <li>Escalate rating may require Australia review.</li>
          <li>Stale/unapproved reference data blocks normal approval.</li>
          <li>Unsafe wording blocks approval.</li>
          <li>Boss override requires mandatory reason.</li>
        </ul>
        {canGenerateClearReport ? <form action={runGenerateClearReportDraftAction} className="intake-form">
          <input type="hidden" name="submissionId" value={submission.id} />
          <label><strong>Internal note/reason</strong></label>
          <PresetReasonOptions options={['Draft prepared for internal review', 'Reference data check completed', 'Requires senior review']} />
          <textarea name="internalReason" rows={3} placeholder="Optional detail for audit history" />
          <label><strong>Override note (optional for non-hot/non-escalate)</strong></label>
          <textarea name="overrideNote" rows={2} />
          <button type="submit">Generate C.L.E.A.R Draft</button>
        </form> : <p>Draft generation is not available for your role.</p>}
        <BackToTopLink />
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
                <label><strong>Internal note/reason</strong></label>
                <PresetReasonOptions options={['Routine CLEAR workflow update', 'Approved for consultation readiness', 'Australia review requested', 'Australia review completed', 'Boss override recorded']} />
                <textarea name="internalReason" rows={3} placeholder="Optional detail for audit history" />
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
        <BackToTopLink />
      </section> : null}

      {activeTab === 'communications' ? <section className="section review-section">
        <h3>Staff-Controlled Client Communications</h3>
        <p><strong>Warning:</strong> Client communication records are internal until released through an authorised staff action.</p>
        <form action={runClientCommunicationAction} className="intake-form">
          <input type="hidden" name="submissionId" value={submission.id} />
                    <label htmlFor="communication-reason"><strong>Internal reason/note</strong></label>
          <PresetReasonOptions options={['Routine client information follow-up', 'Consultation invitation prepared', 'Hold notice prepared for review']} />
          <textarea id="communication-reason" name="internalReason" rows={3} placeholder="Optional detail for audit history" />
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
                    <label><strong>Internal note/reason</strong></label>
          <PresetReasonOptions options={['Booking record created by staff', 'Consultation time confirmed', 'Imported from booking reference']} />
          <textarea name="internalReason" rows={3} placeholder="Optional detail for audit history" />
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
                <form action={runConsultationBookingAction} className="inline-release-form consultation-action-form">
                  <input type="hidden" name="submissionId" value={submission.id} />
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <PresetReasonOptions options={['Status updated after staff check', 'Client confirmed booking change', 'Post-consultation admin update']} />
                  <input name="internalReason" placeholder="Optional internal note" />
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
                                    <label><strong>Internal note/reason</strong></label>
                  <PresetReasonOptions options={['Outcome recorded after consultation', 'CSA discussion documented', 'Follow-up required']} />
                  <textarea name="internalReason" rows={2} placeholder="Optional detail for audit history" />
                  <button type="submit">Record Consultation Outcome</button>
                </form>
              </article>
            ))}
          </div>
        )}
        <BackToTopLink />
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

      {activeTab === 'overview' ? <section className="section review-section"><h3>Latest Points Snapshot</h3>{latestPoints ? <div className="points-snapshot-grid">
        <article className="points-total-card"><p>Total preliminary points</p><strong>{latestPoints.totalPoints}</strong><span>{indicativePointsRange(latestPoints.totalPoints)}</span></article>
        <article><h4>Key points contributors / breakdown</h4>{pointsBreakdown.length ? <ul className="review-list">{pointsBreakdown.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No points breakdown recorded.</p>}</article>
        <article><h4>Missing items</h4>{latestPoints.missingItems.length ? <ul className="review-list">{latestPoints.missingItems.map((item) => <li key={item}>{humanizeValue(item)}</li>)}</ul> : <p>None recorded in latest snapshot.</p>}</article>
        <article className="dashboard-note"><strong>Preliminary only:</strong> {latestPoints.preliminaryLabel || 'Points are preliminary and subject to human review.'}<details><summary>Technical details</summary>{renderRows([['Generated at', displayDate(latestPoints.generatedAt)], ['Calculator version', latestPoints.calculatorVersion], ['Generated by system', humanizeValue(String(latestPoints.generatedBy))]])}</details></article>
      </div> : <p>No points snapshot available yet.</p>}</section> : null}

      {activeTab === 'overview' ? <section className="section review-section"><h3>Active risk flags</h3>{submission.riskFlags.length === 0 ? <p>No active risk flags.</p> : (
        <ul className="review-list">{submission.riskFlags.map((flag) => <li key={flag.id}><strong>{flag.riskCode}</strong> ({flag.severity}) — {flag.resolutionStatus}</li>)}</ul>
      )}</section> : null}

      {activeTab === 'documents' ? <section className="section review-section"><h3>Document review (staff-controlled)</h3>{submission.documents.length === 0 ? <p>No document metadata available.</p> : (
        <div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Type</th><th>Filename</th><th>Size (bytes)</th><th>Verification status</th><th>Required/optional</th><th>Waived</th><th>Waiver reason</th><th>Verification notes</th><th>Uploaded date</th><th>Reviewed by</th><th>Actions</th></tr></thead><tbody>{submission.documents.map((doc) => {
          const required = doc.documentType !== 'otherSupportingDocs';
          return <tr key={doc.id}><td>{doc.documentType}</td><td>{doc.originalFilename}</td><td>{doc.fileSizeBytes}</td><td>{doc.verificationStatus}</td><td>{required ? 'Required' : 'Optional'}</td><td>{doc.waived ? 'Yes' : 'No'}</td><td>{doc.waivedReason || 'Not waived'}</td><td>{doc.verificationNotesInternal || 'Not provided'}</td><td>{displayDate(doc.uploadedAt)}</td><td>{doc.verifiedBy || doc.waivedBy || 'Not provided'}</td><td><form action={runDocumentReviewAction} className="intake-form"><input type="hidden" name="submissionId" value={submission.id} /><input type="hidden" name="documentId" value={doc.id} /><input type="hidden" name="isRequired" value={required ? 'true' : 'false'} /><input name="internalReason" required placeholder="Internal note/reason" /><input name="waiverReason" placeholder="Waiver reason (required for required docs)" /><div className="button-row"><button type="submit" name="action" value="accept">Mark accepted</button><button type="submit" name="action" value="reject">Mark rejected</button><button type="submit" name="action" value="needs_reupload">Mark needs re-upload</button><button type="submit" name="action" value="waive">Waive requirement</button></div></form></td></tr>;
        })}</tbody></table></div>
      )}</section> : null}

      {activeTab === 'overview' ? <section className="section review-section"><h3>Current Review State</h3>{submission.currentReviewState ? <div className="review-state-card-grid">
        <article><p>Current stage</p><strong>{stageLabel(submission.currentReviewState.currentStage)}</strong></article>
        <article><p>Last decision</p><strong>{humanizeValue(submission.currentReviewState.lastDecision)}</strong></article>
        <article><p>Mandatory stages complete</p><strong>{boolText(submission.currentReviewState.mandatoryStagesComplete)}</strong></article>
        <article><p>Senior sign-off status</p><strong>{submission.currentReviewState.seniorSignOffAt ? 'Signed off' : 'Not signed off'}</strong><span>{submission.currentReviewState.seniorSignOffBy || 'No senior reviewer recorded'}</span></article>
        <article><p>Last updated</p><strong>{displayDate(submission.currentReviewState.updatedAt)}</strong></article>
      </div> : <p>No review state available yet.</p>}</section> : null}
      {activeTab === 'staff-tasks' ? <section className="section review-section"><h3>Staff task list</h3><p>No active staff tasks are currently displayed for this submission.</p><div className="status-feedback status-feedback--info"><strong>Task field guide:</strong> Task type is the category of work, priority is the urgency/importance, and status is the lifecycle stage.</div><form className="intake-form"><h4>Create task</h4><input name="title" placeholder="Task title" /><textarea name="description" placeholder="Task description" /><input name="assignee" placeholder="Assignee" /><input name="dueDate" type="date" /><select name="taskType" aria-describedby="task-type-helper"><option>Task type</option><option>Document follow-up</option><option>Risk review</option><option>Consultation preparation</option></select><p id="task-type-helper" className="form-helper">Task type = category of work.</p><select name="priority" aria-describedby="task-priority-helper"><option>Priority</option><option>Low</option><option>Normal</option><option>High</option><option>Urgent</option></select><p id="task-priority-helper" className="form-helper">Priority = urgency/importance.</p><select name="status" aria-describedby="task-status-helper"><option>Status</option><option>Not started</option><option>In progress</option><option>Blocked</option><option>Complete</option></select><p id="task-status-helper" className="form-helper">Status = lifecycle stage.</p><div className="button-row"><button type="button">Create task</button><button type="button">Start task</button><button type="button">Complete task</button><button type="button">Cancel task</button><button type="button">Assign task</button><button type="button">Reassign task</button></div></form><BackToTopLink /></section> : null}

      {activeTab === 'audit-trail' ? <section className="section review-section"><h3>Audit timeline</h3>{submission.auditEvents.length === 0 ? <p>No audit events available.</p> : (
        <ul className="review-list">{submission.auditEvents.map((event) => <li key={event.id}><strong>{auditEventLabel(String(event.eventType))}</strong> at {displayDate(event.eventAt)} — <span>Actor: {event.actorName || event.actorId || 'Unknown'} ({humanizeValue(event.actorRole || 'unknown')})</span>{event.internalNote || event.reason ? ` — Note: ${event.internalNote || event.reason}` : ''}</li>)}</ul>
      )}<BackToTopLink /></section> : null}
    </>
  );
}
