import { LeadRating, Prisma, RiskSeverity } from '@prisma/client';

import { recordAuditEvent } from './audit';
import { db } from './db';
import { PERMISSIONS, ROLES, type RoleKey, hasPermission } from './auth/permissions';

type ActorContext = {
  actorId: string;
  actorName: string;
  actorRole: RoleKey;
  actorStaffUserId: string;
  actorRoles: RoleKey[];
};

type GenerateClearReportDraftInput = {
  submissionId: string;
  actor: ActorContext;
  staffNotes?: string;
  overrideNote?: string;
};

type GenerateClearReportDraftResult =
  | { blocked: true; reason: string; requiresOverrideNote?: boolean }
  | { blocked: false; warning?: string; clearReportId: string };

const ALLOWED_LEAD_RATINGS = new Set<LeadRating>(['hot', 'escalate']);
const UNSAFE_WORDING_PATTERN = /\b(eligible|guaranteed|qualified|suitable|strong candidate)\b/i;

function normalize(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function assertPermission(actor: ActorContext, permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]): void {
  if (!hasPermission(actor.actorRoles, permission)) throw new Error(`Missing permission: ${permission}.`);
}

function canOverrideGate(actor: ActorContext): boolean {
  const isBossOrSenior = actor.actorRole === ROLES.BOSS_ADMIN || actor.actorRole === ROLES.SENIOR_STAFF;
  return isBossOrSenior && hasPermission(actor.actorRoles, PERMISSIONS.GENERATE_CLEAR_REPORT);
}

function summarizeDocuments(documents: Array<{ id: string; documentType: string; verificationStatus: string; waived: boolean }>) {
  return { total: documents.length, byStatus: documents.reduce<Record<string, number>>((a, d) => ((a[d.verificationStatus] = (a[d.verificationStatus] ?? 0) + 1), a), {}), waivedCount: documents.filter((d) => d.waived).length, records: documents };
}

export async function markClearReportPrepared(input: { clearReportId: string; actor: ActorContext; note: string }) {
  assertPermission(input.actor, PERMISSIONS.PREPARE_CLEAR_REPORT);
  const report = await db.clearReport.update({ where: { id: input.clearReportId }, data: { status: 'prepared', preparedByStaffUserId: input.actor.actorStaffUserId, preparedAt: new Date(), reviewNotes: normalize(input.note) } });
  await recordAuditEvent({ submissionId: report.submissionId, eventType: 'clear_report_prepared', actorId: input.actor.actorId, actorName: input.actor.actorName, actorRole: input.actor.actorRole, actorStaffUserId: input.actor.actorStaffUserId, relatedEntityType: 'clear_report', relatedEntityId: report.id, internalNote: normalize(input.note) });
  return report;
}

export async function requestAustraliaClearReview(input: { clearReportId: string; actor: ActorContext; reason: string }) {
  assertPermission(input.actor, PERMISSIONS.REQUEST_AUSTRALIA_CLEAR_REVIEW);
  const reason = normalize(input.reason);
  if (!reason) throw new Error('Australia review reason is required.');
  const report = await db.clearReport.update({ where: { id: input.clearReportId }, data: { requiresAustraliaReview: true, australiaReviewReason: reason, escalationReason: reason, status: 'reviewed' } });
  await recordAuditEvent({ submissionId: report.submissionId, eventType: 'clear_report_australia_review_requested', actorId: input.actor.actorId, actorName: input.actor.actorName, actorRole: input.actor.actorRole, actorStaffUserId: input.actor.actorStaffUserId, relatedEntityType: 'clear_report', relatedEntityId: report.id, reason });
  return report;
}

export async function completeAustraliaClearReview(input: { clearReportId: string; actor: ActorContext; reviewNotes: string }) {
  assertPermission(input.actor, PERMISSIONS.COMPLETE_AUSTRALIA_CLEAR_REVIEW);
  const reviewNotes = normalize(input.reviewNotes);
  if (!reviewNotes) throw new Error('Australia review notes are required.');
  const report = await db.clearReport.update({ where: { id: input.clearReportId }, data: { australiaReviewedByStaffUserId: input.actor.actorStaffUserId, australiaReviewedAt: new Date(), reviewNotes, reviewedAt: new Date(), requiresAustraliaReview: false } });
  await recordAuditEvent({ submissionId: report.submissionId, eventType: 'clear_report_australia_review_completed', actorId: input.actor.actorId, actorName: input.actor.actorName, actorRole: input.actor.actorRole, actorStaffUserId: input.actor.actorStaffUserId, relatedEntityType: 'clear_report', relatedEntityId: report.id, internalNote: reviewNotes });
  return report;
}

export async function overrideApproveClearReport(input: { clearReportId: string; actor: ActorContext; overrideReason: string }) {
  assertPermission(input.actor, PERMISSIONS.OVERRIDE_CLEAR_REPORT_APPROVAL);
  const overrideReason = normalize(input.overrideReason);
  if (!overrideReason) throw new Error('Override reason is required.');
  const report = await db.clearReport.update({ where: { id: input.clearReportId }, data: { status: 'approved_for_consultation', approvedByStaffUserId: input.actor.actorStaffUserId, approvedAt: new Date(), approvalScope: 'boss_override', escalationReason: overrideReason } });
  await recordAuditEvent({ submissionId: report.submissionId, eventType: 'clear_report_override_approved', actorId: input.actor.actorId, actorName: input.actor.actorName, actorRole: input.actor.actorRole, actorStaffUserId: input.actor.actorStaffUserId, relatedEntityType: 'clear_report', relatedEntityId: report.id, reason: overrideReason });
  return report;
}

export async function approveClearReportForConsultation(input: { clearReportId: string; actor: ActorContext; approvalNote: string }) {
  assertPermission(input.actor, PERMISSIONS.APPROVE_STANDARD_CLEAR_REPORT);
  const approvalNote = normalize(input.approvalNote);
  if (!approvalNote) throw new Error('Approval note is required.');

  const report = await db.clearReport.findUniqueOrThrow({ where: { id: input.clearReportId }, include: { submission: { include: { riskFlags: { where: { resolutionStatus: { in: ['open', 'under_review'] }, severity: { in: ['high', 'critical'] } } } } } } });
  const dataset = await db.migrationReferenceDataset.findFirst({ orderBy: [{ approvedAt: 'desc' }, { updatedAt: 'desc' }] });
  const snapshot = report.generatedSnapshotJson as Record<string, any>;
  const text = JSON.stringify(snapshot).toLowerCase();
  const gateReasons: string[] = [];

  if (!report.submissionId) gateReasons.push('missing_submission_link');
  if (report.submission.leadRating !== 'hot' && report.submission.leadRating !== 'escalate') gateReasons.push('lead_rating_not_hot_or_escalate');
  if (report.submission.leadRating === 'escalate' && report.australiaReviewedAt === null) gateReasons.push('escalate_requires_australia_review_or_override');
  if (report.submission.riskFlags.length > 0 && !report.australiaReviewedAt) gateReasons.push('unresolved_high_or_critical_risk');
  if (!dataset || dataset.status !== 'approved' || dataset.approvedAt === null) gateReasons.push('reference_dataset_not_approved');
  if (dataset?.status === 'stale') gateReasons.push('reference_dataset_stale');
  if (UNSAFE_WORDING_PATTERN.test(text)) gateReasons.push('unsafe_wording_detected');

  await recordAuditEvent({ submissionId: report.submissionId, eventType: 'clear_report_approval_requested', actorId: input.actor.actorId, actorName: input.actor.actorName, actorRole: input.actor.actorRole, actorStaffUserId: input.actor.actorStaffUserId, relatedEntityType: 'clear_report', relatedEntityId: report.id, internalNote: approvalNote });

  if (gateReasons.length > 0) {
    await recordAuditEvent({ submissionId: report.submissionId, eventType: 'clear_report_approval_blocked', actorId: input.actor.actorId, actorName: input.actor.actorName, actorRole: input.actor.actorRole, actorStaffUserId: input.actor.actorStaffUserId, relatedEntityType: 'clear_report', relatedEntityId: report.id, reason: gateReasons.join(', ') });
    return { approved: false as const, reasons: gateReasons };
  }

  const updated = await db.clearReport.update({ where: { id: report.id }, data: { status: 'approved_for_consultation', approvedByStaffUserId: input.actor.actorStaffUserId, approvedAt: new Date(), reviewedAt: new Date(), approvalScope: report.submission.leadRating === 'hot' ? 'standard_hot' : 'post_australia_review', reviewNotes: approvalNote } });
  await recordAuditEvent({ submissionId: report.submissionId, eventType: 'clear_report_approved', actorId: input.actor.actorId, actorName: input.actor.actorName, actorRole: input.actor.actorRole, actorStaffUserId: input.actor.actorStaffUserId, relatedEntityType: 'clear_report', relatedEntityId: report.id, internalNote: approvalNote });
  return { approved: true as const, clearReport: updated };
}

export async function generateClearReportDraft(input: GenerateClearReportDraftInput): Promise<GenerateClearReportDraftResult> { /* existing impl unchanged below */
  assertPermission(input.actor, PERMISSIONS.GENERATE_CLEAR_REPORT);
  const submission = await db.intakeSubmission.findUniqueOrThrow({ where: { id: input.submissionId }, include: { pointsSnapshots: { orderBy: { generatedAt: 'desc' }, take: 1 }, riskFlags: { where: { resolutionStatus: 'open' }, orderBy: { detectedAt: 'desc' } }, documents: { orderBy: { uploadedAt: 'desc' } }, consultationBookings: { orderBy: { createdAt: 'desc' }, take: 1 } } });
  const leadRating = submission.leadRating; const leadRatingSuggested = submission.leadRatingSuggested;
  const gatePass = ALLOWED_LEAD_RATINGS.has(leadRating as LeadRating) || ALLOWED_LEAD_RATINGS.has(leadRatingSuggested as LeadRating);
  if (!gatePass) { if (!canOverrideGate(input.actor)) return { blocked: true, reason: 'C.L.E.A.R draft is blocked: lead rating must be hot/escalate or be generated by authorized override staff.' }; if (!normalize(input.overrideNote)) return { blocked: true, reason: 'C.L.E.A.R draft override note is required for non-hot/non-escalate submissions.', requiresOverrideNote: true }; }
  const approvedDataset = await db.migrationReferenceDataset.findFirst({ where: { status: 'approved' }, include: { costReferences: { orderBy: [{ category: 'asc' }, { label: 'asc' }] } }, orderBy: [{ approvedAt: 'desc' }, { updatedAt: 'desc' }] });
  const datasetWarning = approvedDataset ? undefined : 'No approved migration reference dataset found. Snapshot placeholders are generated and require staff review before any downstream use.';
  const latestPointsSnapshot = submission.pointsSnapshots[0] ?? null; const payload = (submission.payload ?? {}) as Record<string, unknown>; const consultationBooking = submission.consultationBookings[0] ?? null;
  const generatedSnapshotJson: Prisma.InputJsonObject = { clientSnapshot: { submissionId: submission.id, status: submission.status, createdAt: submission.createdAt.toISOString(), submittedAt: submission.submittedAt?.toISOString() ?? null, payload }, ageProfileSummary: { age: payload.age ?? null, countryOfResidence: payload.countryOfResidence ?? null, nationality: payload.nationality ?? null, summaryLabel: 'Preliminary profile summary based on information provided; subject to review.' }, qualificationSummary: { highestQualification: payload.highestQualification ?? null, educationField: payload.educationField ?? null, note: 'Indicative qualification summary, subject to document verification and review.' }, workExperienceSummary: { years: payload.workExperienceYears ?? null, occupation: payload.occupation ?? null, note: 'Potential experience indicators based on information provided; subject to review.' }, englishSummary: { testType: payload.englishTestType ?? null, score: payload.englishScore ?? null, level: payload.englishLevel ?? null, note: 'Preliminary English summary and pathway indicators, subject to review.' }, potentialOccupationAlignment: { placeholder: 'Potential occupation alignment to be reviewed by migration staff against current references.' }, possibleSkillsAssessmentBodyPathway: { placeholder: 'Possible skills assessment body/pathway indicators to be completed during staff review.' }, preliminaryPointsSnapshot: latestPointsSnapshot, pointsImprovementStrategy: { placeholder: 'Indicative points improvement strategy to be prepared after human review.' }, gsmOverviewSc189Sc190Sc491: { placeholder: 'Preliminary GSM overview for SC189/190/491 pathway indicators, subject to review.' }, documentCompleteness: summarizeDocuments(submission.documents.map((document) => ({ id: document.id, documentType: document.documentType, verificationStatus: document.verificationStatus, waived: document.waived }))), riskDisclosuresReviewNotes: submission.riskFlags.map((flag) => ({ riskCode: flag.riskCode, severity: flag.severity, resolutionStatus: flag.resolutionStatus, clientSafeDisclosure: flag.clientSafeDisclosure, resolutionSummaryInternal: flag.resolutionSummaryInternal })), consultationTalkingPoints: { placeholder: 'Consultation talking points to be prepared by staff reviewer.', consultationBooking }, recommendedNextSteps: { placeholder: 'Recommended next steps are preliminary and subject to review.' }, estimatedForwardCostCategories: approvedDataset?.costReferences ?? [], leadRating: { leadRating, leadRatingSuggested, leadRatingReason: submission.leadRatingReason }, referenceDataset: { datasetVersion: approvedDataset?.datasetVersion ?? null, reviewedAt: approvedDataset?.reviewedAt?.toISOString() ?? null, approvedAt: approvedDataset?.approvedAt?.toISOString() ?? null }, disclaimer: 'Internal C.L.E.A.R draft only. Preliminary and indicative summary based on information provided, subject to staff review and updated evidence.' };
  const created = await db.clearReport.create({ data: { submissionId: submission.id, consultationBookingId: consultationBooking?.id ?? null, status: 'draft', reportVersion: 'clear-v1', generatedSnapshotJson, preparedByStaffUserId: input.actor.actorStaffUserId, staffNotes: normalize(input.staffNotes) ?? normalize(input.overrideNote), clientFacingNotes: '' } });
  await recordAuditEvent({ submissionId: submission.id, eventType: 'clear_report_generated', actorId: input.actor.actorId, actorName: input.actor.actorName, actorRole: input.actor.actorRole, actorStaffUserId: input.actor.actorStaffUserId, relatedEntityType: 'clear_report', relatedEntityId: created.id, fromValue: null, toValue: { status: created.status, reportVersion: created.reportVersion }, internalNote: normalize(input.overrideNote) ?? 'C.L.E.A.R draft generated for internal review.', metadata: { internalOnly: true, clearReport: true, referenceDatasetVersion: approvedDataset?.datasetVersion ?? null, warning: datasetWarning ?? null } });
  return { blocked: false, warning: datasetWarning, clearReportId: created.id };
}
