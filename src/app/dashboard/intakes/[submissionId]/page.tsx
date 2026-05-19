import React from 'react';
import { requirePermission } from '@/server/auth/requirePermission';
import { PERMISSIONS, resolveActorRole } from '@/server/auth/permissions';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { LeadRating, Prisma, RiskResolutionStatus, RiskSeverity, ReviewDecision, ReviewStage, SubmissionStatus, AuditEventType } from '@prisma/client';

import { db } from '@/server/db';
import { CLIENT_COMMUNICATION_TEMPLATES, createClientCommunicationDraft, releaseConsultationInvitationCommunication, releaseRequestMoreInformationCommunication } from '@/server/clientCommunications';
import {
  createConsultationBooking,
  markConsultationBooked,
  markConsultationCancelled,
  markConsultationCompleted,
  markConsultationNoShow,
  markConsultationRescheduled,
  markCsaIssued,
  markDepositPaid,
  recordConsultationOutcome,
} from '@/server/consultationBookings';
import type { RecordAuditEventInput } from '@/server/audit';
import { changeLeadRating, confirmLeadRating, suggestLeadRating } from '@/server/leadRatings';

type IntakePayload = Prisma.JsonObject & Record<string, string | number | boolean | undefined | null>;

const displayDate = (dateTime: Date) =>
  new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(dateTime);

const boolText = (value: boolean | undefined) => (value === undefined ? 'Not provided' : value ? 'Yes' : 'No');

const safeText = (value: string | number | undefined | null) => {
  if (value === undefined || value === null) return 'Not provided';
  if (typeof value === 'string' && !value.trim()) return 'Not provided';
  return String(value);
};

function normalizeAuditString(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function recordAuditEventInTx(
  tx: Prisma.TransactionClient,
  input: RecordAuditEventInput,
) {
  const submissionId = normalizeAuditString(input.submissionId);
  if (!submissionId) throw new Error('submissionId is required.');

  const eventType = normalizeAuditString(input.eventType);
  if (!eventType) throw new Error('eventType is required.');

  await tx.auditEvent.create({
    data: {
      submissionId,
      eventType: eventType as AuditEventType,
      actorId: normalizeAuditString(input.actorId),
      actorRole: normalizeAuditString(input.actorRole),
      actorName: normalizeAuditString(input.actorName),
      actorStaffUserId: normalizeAuditString(input.actorStaffUserId),
      relatedEntityType: normalizeAuditString(input.relatedEntityType),
      relatedEntityId: normalizeAuditString(input.relatedEntityId),
      fromValue: input.fromValue,
      toValue: input.toValue,
      reason: normalizeAuditString(input.reason),
      internalNote: normalizeAuditString(input.internalNote),
      metadata: input.metadata,
      ipAddress: normalizeAuditString(input.ipAddress),
      userAgent: normalizeAuditString(input.userAgent),
      eventSource: normalizeAuditString(input.eventSource),
    },
  });
}


const hasBlockingConsultationRisk = (severity: RiskSeverity, status: RiskResolutionStatus) => {
  const severe = severity === RiskSeverity.high || severity === RiskSeverity.critical;
  const unresolved = status === RiskResolutionStatus.open || status === RiskResolutionStatus.under_review;
  return severe && unresolved;
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


type StaffActorContext = {
  actorId: string;
  actorName: string;
  actorRole: string;
  actorStaffUserId?: string;
};

async function requireStaffActorContextForClientCommunication(permission: string): Promise<StaffActorContext> {
  const { requireStaffSession } = await import('@/server/auth/requireStaffSession');
  const session = await requireStaffSession();
  await requirePermission(permission as never);

  const actorId = String(session.user.staffUserId ?? '').trim();
  const actorName = session.user.name?.trim() || session.user.email?.trim() || actorId;
  const actorRole = resolveActorRole(session.user.roles ?? []);
  const actorStaffUserId = session.user.staffUserId?.trim() || undefined;

  if (!actorId) throw new Error('Missing authenticated staff actor id');

  return { actorId, actorName, actorRole, actorStaffUserId };
}

export async function runInternalReviewAction(formData: FormData) {
  'use server';
  const { requireStaffSession } = await import('@/server/auth/requireStaffSession');
  const session = await requireStaffSession();
  await requirePermission(PERMISSIONS.PERFORM_INTERNAL_REVIEW_ACTIONS);

  const submissionId = String(formData.get('submissionId') ?? '');
  const action = String(formData.get('action') ?? '');
  const note = String(formData.get('internalNote') ?? '').trim();
  const actorId = String(session.user.staffUserId);
  const actorName = session.user.name?.trim() || session.user.email?.trim() || actorId;
  const actorRole = resolveActorRole(session.user.roles ?? []);
  const actorStaffUserId = session.user.staffUserId;

  if (!submissionId || !action || !note || !actorId) return;

  await db.$transaction(async (tx) => {
    const submission = await tx.intakeSubmission.findUnique({
      where: { id: submissionId },
      include: { currentReviewState: true, riskFlags: true },
    });

    if (!submission) return;

    let nextStatus = submission.status;
    let nextStage = submission.currentReviewState?.currentStage ?? ReviewStage.intake_triage;
    let decision: ReviewDecision = ReviewDecision.manual_hold;
    let auditType: AuditEventType = AuditEventType.submission_updated;

    if (action === 'mark_under_review') {
      nextStatus = SubmissionStatus.intake_triage_in_progress;
      nextStage = ReviewStage.intake_triage;
      auditType = AuditEventType.status_transition_executed;
    } else if (action === 'request_more_information') {
      nextStatus = SubmissionStatus.awaiting_client_documents;
      decision = ReviewDecision.needs_more_documents;
      nextStage = ReviewStage.document_completeness_check;
      auditType = AuditEventType.status_transition_executed;
    } else if (action === 'escalate_risk_review') {
      nextStatus = SubmissionStatus.risk_review_in_progress;
      decision = ReviewDecision.needs_risk_clarification;
      nextStage = ReviewStage.risk_assessment;
      auditType = AuditEventType.status_transition_executed;
      await tx.riskFlag.updateMany({
        where: { submissionId, resolutionStatus: RiskResolutionStatus.open },
        data: { resolutionStatus: RiskResolutionStatus.under_review },
      });
    } else if (action === 'mark_consultation_ready_internal') {
      const hasUnresolvedHighOrCriticalRisk = submission.riskFlags.some((flag) =>
        hasBlockingConsultationRisk(flag.severity, flag.resolutionStatus),
      );

      if (hasUnresolvedHighOrCriticalRisk) {
        await recordAuditEventInTx(tx, {
          submissionId,
          eventType: AuditEventType.consultation_invite_release_blocked_risk,
          actorId,
          actorName,
          actorRole,
          actorStaffUserId,
          relatedEntityType: 'staff_review',
          fromValue: { status: submission.status, stage: submission.currentReviewState?.currentStage },
          toValue: { status: submission.status, stage: submission.currentReviewState?.currentStage },
          reason: 'Risk must be cleared before marking consultation-ready internally.',
          internalNote: note,
          metadata: { action, internalOnly: true, blockedByUnresolvedSevereRisk: true, actorStaffUserId },
          eventSource: 'staff_review_action',
        });
        return;
      }

      nextStatus = SubmissionStatus.ready_for_client_summary;
      decision = submission.currentReviewState?.lastDecision ?? ReviewDecision.manual_hold;
      nextStage = ReviewStage.client_summary_ready;
      auditType = AuditEventType.status_transition_executed;
    } else if (action === 'add_internal_note') {
      decision = submission.currentReviewState?.lastDecision ?? ReviewDecision.manual_hold;
      nextStage = submission.currentReviewState?.currentStage ?? ReviewStage.intake_triage;
    } else {
      return;
    }

    await tx.intakeSubmission.update({
      where: { id: submissionId },
      data: { status: nextStatus },
    });

    await tx.submissionReviewState.upsert({
      where: { submissionId },
      update: { currentStage: nextStage, lastDecision: decision },
      create: { submissionId, currentStage: nextStage, lastDecision: decision },
    });

    const staffReview = await tx.staffReview.create({
      data: {
        submissionId,
        stage: nextStage,
        decision,
        internalNotes: note,
        missingEvidence: [],
        reviewedBy: actorId,
      },
    });

    await recordAuditEventInTx(tx, {
      submissionId,
      eventType: auditType,
      actorId,
      actorName,
      actorRole,
      actorStaffUserId,
      relatedEntityType: 'staff_review',
      relatedEntityId: staffReview.id,
      fromValue: { status: submission.status, stage: submission.currentReviewState?.currentStage },
      toValue: { status: nextStatus, stage: nextStage },
      reason: note,
      internalNote: note,
      metadata: { action, internalOnly: true, requiresHumanReviewBeforeClientCommunication: true, actorStaffUserId },
      eventSource: 'staff_review_action',
    });
  });

  revalidatePath(`/dashboard/intakes/${submissionId}`);
}



export async function runClientCommunicationAction(formData: FormData) {
  'use server';

  const submissionId = String(formData.get('submissionId') ?? '').trim();
  const internalReason = String(formData.get('internalReason') ?? '').trim();
  const communicationType = String(formData.get('communicationType') ?? '').trim() as
    | 'request_more_information'
    | 'consultation_invitation'
    | 'not_progressing_hold';

  if (!submissionId || !internalReason) return;

  const { actorId, actorRole, actorStaffUserId } = await requireStaffActorContextForClientCommunication(PERMISSIONS.PREPARE_CLIENT_COMMUNICATION);

  const template = CLIENT_COMMUNICATION_TEMPLATES[communicationType];
  if (!template) return;

  await createClientCommunicationDraft({
    submissionId,
    communicationType,
    subject: template.subject,
    bodyText: template.bodyText,
    internalReason,
    actorId,
    actorRole,
    actorStaffUserId,
  });

  revalidatePath(`/dashboard/intakes/${submissionId}`);
}


export async function runReleaseRequestMoreInformationAction(formData: FormData) {
  "use server";

  const submissionId = String(formData.get('submissionId') ?? '').trim();
  const communicationId = String(formData.get('communicationId') ?? '').trim();
  const internalReason = String(formData.get('internalReason') ?? '').trim();

  if (!submissionId || !communicationId || !internalReason) return;

  const { actorId, actorRole, actorStaffUserId } = await requireStaffActorContextForClientCommunication(PERMISSIONS.RELEASE_REQUEST_MORE_INFO);

  try {
    await releaseRequestMoreInformationCommunication({
      submissionId,
      communicationId,
      communicationType: 'request_more_information',
      subject: CLIENT_COMMUNICATION_TEMPLATES.request_more_information.subject,
      bodyText: CLIENT_COMMUNICATION_TEMPLATES.request_more_information.bodyText,
      internalReason,
      actorId,
      actorRole,
      actorStaffUserId,
    });
  } catch {
    // Do not fail the full page on release/send failures.
  }

  revalidatePath(`/dashboard/intakes/${submissionId}`);
}

export async function runReleaseConsultationInvitationAction(formData: FormData) {
  'use server';

  const submissionId = String(formData.get('submissionId') ?? '').trim();
  const communicationId = String(formData.get('communicationId') ?? '').trim();
  const internalReason = String(formData.get('internalReason') ?? '').trim();

  if (!submissionId || !communicationId || !internalReason) return;

  const { actorId, actorRole, actorStaffUserId } = await requireStaffActorContextForClientCommunication(PERMISSIONS.RELEASE_CONSULTATION_INVITE);

  try {
    await releaseConsultationInvitationCommunication({
      submissionId,
      communicationId,
      communicationType: 'consultation_invitation',
      subject: CLIENT_COMMUNICATION_TEMPLATES.consultation_invitation.subject,
      bodyText: CLIENT_COMMUNICATION_TEMPLATES.consultation_invitation.bodyText,
      internalReason,
      actorId,
      actorRole,
      actorStaffUserId,
    });
  } catch {
    // Do not fail the full page on release/send failures.
  }

  revalidatePath(`/dashboard/intakes/${submissionId}`);
}

export async function runConsultationBookingAction(formData: FormData) {
  'use server';

  const submissionId = String(formData.get('submissionId') ?? '').trim();
  const action = String(formData.get('action') ?? '').trim();
  const reason = String(formData.get('internalReason') ?? '').trim();
  const bookingId = String(formData.get('bookingId') ?? '').trim();

  if (!submissionId || !action || !reason) return;

  const { requireStaffSession } = await import('@/server/auth/requireStaffSession');
  const session = await requireStaffSession();

  const actorId = String(session.user.staffUserId ?? '').trim();
  const actorName = session.user.name?.trim() || session.user.email?.trim() || actorId;
  const actorRole = resolveActorRole(session.user.roles ?? []);
  const actorStaffUserId = session.user.staffUserId?.trim() || undefined;

  if (!actorId) throw new Error('Missing authenticated staff actor id');

  const permissionByAction: Record<string, string> = {
    create_booking: PERMISSIONS.MANAGE_CONSULTATION_BOOKINGS,
    mark_booked: PERMISSIONS.MANAGE_CONSULTATION_BOOKINGS,
    mark_completed: PERMISSIONS.MANAGE_CONSULTATION_BOOKINGS,
    mark_no_show: PERMISSIONS.MANAGE_CONSULTATION_BOOKINGS,
    mark_cancelled: PERMISSIONS.MANAGE_CONSULTATION_BOOKINGS,
    mark_rescheduled: PERMISSIONS.MANAGE_CONSULTATION_BOOKINGS,
    record_outcome: PERMISSIONS.MANAGE_CONSULTATION_BOOKINGS,
    mark_csa_issued: PERMISSIONS.MARK_CSA_ISSUED,
    mark_deposit_paid: PERMISSIONS.MARK_DEPOSIT_PAID,
  };

  const requiredPermission = permissionByAction[action];
  if (!requiredPermission) return;
  await requirePermission(requiredPermission as never);

  try {
    if (action === 'create_booking') {
      const clientName = String(formData.get('clientName') ?? '').trim();
      const clientEmail = String(formData.get('clientEmail') ?? '').trim();
      const assignedSeniorStaffId = String(formData.get('assignedSeniorStaffId') ?? '').trim();
      const assignedSeniorStaffName = String(formData.get('assignedSeniorStaffName') ?? '').trim();
      const bookingDateTimeRaw = String(formData.get('bookingDateTime') ?? '').trim();
      const bookingTimezone = String(formData.get('bookingTimezone') ?? '').trim();
      const bookingSourceRaw = String(formData.get('bookingSource') ?? '').trim();

      if (!clientName || !clientEmail) return;

      const bookingSource = (
        bookingSourceRaw === 'manual_staff_entry' ||
        bookingSourceRaw === 'internal_booking_link' ||
        bookingSourceRaw === 'calendly' ||
        bookingSourceRaw === 'google_calendar' ||
        bookingSourceRaw === 'other'
      ) ? bookingSourceRaw : 'manual_staff_entry';

      await createConsultationBooking({
        submissionId,
        clientName,
        clientEmail,
        assignedSeniorStaffId: assignedSeniorStaffId || undefined,
        assignedSeniorStaffName: assignedSeniorStaffName || undefined,
        bookingDateTime: bookingDateTimeRaw ? new Date(bookingDateTimeRaw) : undefined,
        bookingTimezone: bookingTimezone || undefined,
        bookingSource,
        notesInternal: reason,
        actorId,
        actorRole,
        reason,
        actorName,
        actorStaffUserId,
      });
    } else {
      if (!bookingId) return;

      if (action === 'mark_booked') {
        await markConsultationBooked({ bookingId, submissionId, actorId, actorRole, reason, actorName, actorStaffUserId });
      } else if (action === 'mark_completed') {
        await markConsultationCompleted({ bookingId, submissionId, actorId, actorRole, reason, actorName, actorStaffUserId });
      } else if (action === 'mark_no_show') {
        await markConsultationNoShow({ bookingId, submissionId, actorId, actorRole, reason, actorName, actorStaffUserId });
      } else if (action === 'mark_cancelled') {
        await markConsultationCancelled({ bookingId, submissionId, actorId, actorRole, reason, actorName, actorStaffUserId });
      } else if (action === 'mark_rescheduled') {
        await markConsultationRescheduled({ bookingId, submissionId, actorId, actorRole, reason, actorName, actorStaffUserId });
      } else if (action === 'record_outcome') {
        const outcome = String(formData.get('consultationOutcome') ?? '').trim();
        if (!outcome) return;
        await recordConsultationOutcome({
          bookingId,
          submissionId,
          outcome,
          csaRecommended: String(formData.get('csaRecommended') ?? '') === 'true',
          actorId,
          actorRole,
          reason,
          actorName,
          actorStaffUserId,
        });
      } else if (action === 'mark_csa_issued') {
        await markCsaIssued({ bookingId, submissionId, actorId, actorRole, reason, actorName, actorStaffUserId });
      } else if (action === 'mark_deposit_paid') {
        await markDepositPaid({ bookingId, submissionId, actorId, actorRole, reason, actorName, actorStaffUserId });
      }
    }
  } catch {
    // Keep page stable for staff users if an action fails.
  }

  revalidatePath(`/dashboard/intakes/${submissionId}`);
}

export async function runDocumentReviewAction(formData: FormData) {
  'use server';

  const submissionId = String(formData.get('submissionId') ?? '').trim();
  const documentId = String(formData.get('documentId') ?? '').trim();
  const action = String(formData.get('action') ?? '').trim();
  const reason = String(formData.get('internalReason') ?? '').trim();
  const waiverReason = String(formData.get('waiverReason') ?? '').trim();

  if (!submissionId) throw new Error('Document review action validation failed: missing submissionId.');
  if (!documentId) throw new Error('Document review action validation failed: missing documentId.');
  if (!action) throw new Error('Document review action validation failed: missing action.');
  if (!reason) throw new Error('Document review action validation failed: missing internal reason.');

  const { requireStaffSession } = await import('@/server/auth/requireStaffSession');
  const session = await requireStaffSession();
  await requirePermission(PERMISSIONS.REVIEW_SUBMISSION_DOCUMENTS);

  const actorId = String(session.user.staffUserId ?? '').trim();
  const actorName = session.user.name?.trim() || session.user.email?.trim() || actorId;
  const actorRole = resolveActorRole(session.user.roles ?? []);
  const actorStaffUserId = session.user.staffUserId?.trim() || undefined;
  if (!actorId) throw new Error('Missing authenticated staff actor id');

  const knownActions = new Set(['accept', 'reject', 'needs_reupload', 'waive']);
  if (!knownActions.has(action)) {
    throw new Error(`Document review action validation failed: unknown action "${action}".`);
  }

  await db.$transaction(async (tx) => {
    const existing = await tx.submissionDocument.findUnique({ where: { id: documentId } });
    if (!existing) return;

    if (existing.submissionId !== submissionId) {
      throw new Error(
        `Document review action blocked: document ${documentId} does not belong to submission ${submissionId}.`,
      );
    }

    if (action === 'waive' && !waiverReason) {
      throw new Error('Waiver reason is required for all waiver actions.');
    }

    let nextStatus = existing.verificationStatus;
    let eventType: AuditEventType;
    let metadata: Prisma.JsonObject | undefined;
    const updateData: Prisma.SubmissionDocumentUpdateInput = {
      verificationNotesInternal: reason,
    };

    if (action === 'accept') {
      nextStatus = 'verified';
      updateData.verificationStatus = nextStatus;
      updateData.verifiedBy = actorId;
      updateData.verifiedAt = new Date();
      updateData.waived = false;
      updateData.waivedReason = null;
      updateData.waivedBy = null;
      updateData.waivedAt = null;
      eventType = AuditEventType.document_accepted;
    } else if (action === 'reject') {
      nextStatus = 'rejected';
      updateData.verificationStatus = nextStatus;
      updateData.verifiedBy = actorId;
      updateData.verifiedAt = new Date();
      eventType = AuditEventType.document_rejected;
    } else if (action === 'needs_reupload') {
      nextStatus = 'needs_reupload';
      updateData.verificationStatus = nextStatus;
      updateData.verifiedBy = actorId;
      updateData.verifiedAt = new Date();
      eventType = AuditEventType.document_rejected;
      metadata = { requiresReupload: true };
    } else if (action === 'waive') {
      nextStatus = existing.verificationStatus;
      updateData.waived = true;
      updateData.waivedReason = waiverReason;
      updateData.waivedBy = actorId;
      updateData.waivedAt = new Date();
      eventType = AuditEventType.document_waived;
      if (waiverReason !== reason) {
        metadata = { ...(metadata ?? {}), waiverReasonProvided: true };
      }
    }

    await tx.submissionDocument.update({ where: { id: documentId }, data: updateData });
    await recordAuditEventInTx(tx, {
      submissionId,
      eventType,
      actorId,
      actorName,
      actorRole,
      actorStaffUserId,
      relatedEntityType: 'submission_document',
      relatedEntityId: documentId,
      fromValue: { verificationStatus: existing.verificationStatus, waived: existing.waived },
      toValue: { verificationStatus: nextStatus, waived: updateData.waived ?? existing.waived },
      reason,
      internalNote: reason,
      metadata: metadata ? { ...metadata, actorStaffUserId } : { actorStaffUserId },
      eventSource: 'staff_document_review_action',
    });
  });

  revalidatePath(`/dashboard/intakes/${submissionId}`);
}

export async function runLeadRatingAction(formData: FormData) {
  'use server';
  const { requireStaffSession } = await import('@/server/auth/requireStaffSession');
  const session = await requireStaffSession();
  const submissionId = String(formData.get('submissionId') ?? '').trim();
  const action = String(formData.get('action') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const rating = String(formData.get('rating') ?? '').trim() as LeadRating;
  const actorId = String(session.user.staffUserId ?? '').trim();
  const actorName = session.user.name?.trim() || session.user.email?.trim() || actorId;
  const actorRole = resolveActorRole(session.user.roles ?? []);
  const actorRoles = (session.user.roles ?? []) as Array<typeof actorRole>;

  if (!submissionId || !action || !actorId) return;

  const actor = { actorId, actorName, actorRole, actorStaffUserId: actorId, actorRoles };
  if (action === 'suggest') {
    await requirePermission(PERMISSIONS.SUGGEST_LEAD_RATING);
    await suggestLeadRating({ submissionId, actor, reason });
  }

  if (action === 'confirm' && reason) {
    await requirePermission(PERMISSIONS.CONFIRM_LEAD_RATING);
    await confirmLeadRating({ submissionId, actor, rating, reason });
  }

  if (action === 'change' && reason) {
    await requirePermission(PERMISSIONS.CHANGE_CONFIRMED_LEAD_RATING);
    await changeLeadRating({ submissionId, actor, rating, reason });
  }

  revalidatePath(`/dashboard/intakes/${submissionId}`);
}

export default async function IntakeReviewPage({ params }: { params: Promise<{ submissionId: string }> }) {
  await requirePermission(PERMISSIONS.VIEW_INTAKE_DETAILS);
  let canViewLeadRating = true;
  let canSuggestLeadRating = true;
  let canConfirmLeadRating = true;
  let canChangeLeadRating = true;
  try { await requirePermission(PERMISSIONS.VIEW_LEAD_RATING); } catch { canViewLeadRating = false; }
  try { await requirePermission(PERMISSIONS.SUGGEST_LEAD_RATING); } catch { canSuggestLeadRating = false; }
  try { await requirePermission(PERMISSIONS.CONFIRM_LEAD_RATING); } catch { canConfirmLeadRating = false; }
  try { await requirePermission(PERMISSIONS.CHANGE_CONFIRMED_LEAD_RATING); } catch { canChangeLeadRating = false; }
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
    },
  });

  if (!submission) notFound();

  const payload = (submission.payload && typeof submission.payload === 'object' && !Array.isArray(submission.payload)
    ? submission.payload
    : {}) as IntakePayload;
  const latestPoints = submission.pointsSnapshots[0];
  const leadRatingHistory = submission.auditEvents.filter((event) => LEAD_RATING_HISTORY_EVENT_TYPES.has(String(event.eventType)));

  return (
    <>
      <section className="hero">
        <h1>Intake Review</h1>
        <p>Submission ID: {submission.id}</p>
        <p><Link href="/dashboard">← Back to dashboard</Link></p>
      </section>
      {canViewLeadRating ? <section className="section review-section">
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
      <section className="section dashboard-note" role="note" aria-label="Internal intake review note">
        <strong>Important:</strong> Internal review page only. No client outcome should be released without authorised human review.
        <p>These actions update internal workflow only. No client outcome is released from this page.</p>
      </section>
      <section className="section review-section">
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
      </section>


      <section className="section review-section">
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
      </section>

      <section className="section review-section"><h3>Communication records</h3>{submission.clientCommunications.length === 0 ? <p>No communication records available.</p> : (
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
      )}</section>
      <section className="section review-section">
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
      </section>

      <section className="section review-section"><h3>Client details</h3>{renderRows([
        ['First name', payload.firstName as string], ['Last name', payload.lastName as string], ['Date of birth', payload.dateOfBirth as string],
        ['Nationality', payload.nationality as string], ['Country of residence', payload.countryOfResidence as string], ['Address', payload.address as string],
      ])}</section>
      <section className="section review-section"><h3>Contact details</h3>{renderRows([
        ['Email', payload.email as string], ['Phone', payload.phone as string], ['Preferred contact method', payload.contactMethod as string],
      ])}</section>
      <section className="section review-section"><h3>Migration goal</h3>{renderRows([
        ['Interested country', payload.interestedCountry as string], ['Main goal', payload.mainGoal as string], ['Timeframe', payload.timeframe as string],
      ])}</section>
      <section className="section review-section"><h3>Family / partner details</h3>{renderRows([
        ['Marital status', payload.maritalStatus as string], ['Dependants', payload.dependants as string], ['Migrate with family', payload.migrateWithFamily as string], ['Partner name', payload.partnerName as string], ['Partner nationality', payload.partnerNationality as string],
        ['Partner English competency', payload.partnerEnglishCompetency as string], ['Partner skills assessment', payload.partnerSkillsAssessment as string],
      ])}</section>
      <section className="section review-section"><h3>Education</h3>{renderRows([
        ['Highest qualification', payload.highestQualification as string], ['Field of study', payload.fieldOfStudy as string], ['Institution', payload.institution as string], ['Study country', payload.studyCountry as string], ['Completion year', payload.completionYear as string],
      ])}</section>
      <section className="section review-section"><h3>Employment</h3>{renderRows([
        ['Current occupation', payload.currentOccupation as string], ['Migration occupation', payload.migrationOccupation as string], ['Work experience years', payload.workExperienceYears as string],
        ['Current employer', payload.currentEmployer as string], ['Duties summary', payload.dutiesSummary as string],
      ])}</section>
      <section className="section review-section"><h3>English details</h3>{renderRows([
        ['English test taken', boolText(payload.englishTestTaken as boolean | undefined)], ['English test type', payload.englishTestType as string], ['English overall band', payload.englishOverallBand as number | undefined], ['English test date', payload.englishTestDate as string], ['English score summary', payload.englishScoreSummary as string],
      ])}</section>
      <section className="section review-section"><h3>Risk disclosures and risk details</h3>{renderRows([
        ['Previous visa refusal', boolText(payload.previousVisaRefusal as boolean | undefined)], ['Cancellation/overstay/removal', boolText(payload.cancellationOverstayOrRemoval as boolean | undefined)], ['Criminal history', boolText(payload.criminalHistory as boolean | undefined)], ['Health condition', boolText(payload.healthCondition as boolean | undefined)],
        ['Refusal details', payload.refusalDetails as string], ['Cancellation/overstay details', payload.cancellationOverstayDetails as string], ['Criminal details', payload.criminalDetails as string], ['Health details', payload.healthDetails as string], ['General risk details', payload.riskDetails as string],
      ])}</section>

      <section className="section review-section"><h3>Latest points snapshot</h3>{latestPoints ? renderRows([
        ['Generated at', displayDate(latestPoints.generatedAt)], ['Total points', latestPoints.totalPoints], ['Calculator version', latestPoints.calculatorVersion], ['Generated by', latestPoints.generatedBy],
        ['Missing items', latestPoints.missingItems.length ? latestPoints.missingItems.join(', ') : 'None'], ['Preliminary label', latestPoints.preliminaryLabel],
      ]) : <p>No points snapshot available yet.</p>}</section>

      <section className="section review-section"><h3>Active risk flags</h3>{submission.riskFlags.length === 0 ? <p>No active risk flags.</p> : (
        <ul className="review-list">{submission.riskFlags.map((flag) => <li key={flag.id}><strong>{flag.riskCode}</strong> ({flag.severity}) — {flag.resolutionStatus}</li>)}</ul>
      )}</section>

      <section className="section review-section"><h3>Document review (staff-controlled)</h3>{submission.documents.length === 0 ? <p>No document metadata available.</p> : (
        <div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Type</th><th>Filename</th><th>Size (bytes)</th><th>Verification status</th><th>Required/optional</th><th>Waived</th><th>Waiver reason</th><th>Verification notes</th><th>Uploaded date</th><th>Reviewed by</th><th>Actions</th></tr></thead><tbody>{submission.documents.map((doc) => {
          const required = doc.documentType !== 'otherSupportingDocs';
          return <tr key={doc.id}><td>{doc.documentType}</td><td>{doc.originalFilename}</td><td>{doc.fileSizeBytes}</td><td>{doc.verificationStatus}</td><td>{required ? 'Required' : 'Optional'}</td><td>{doc.waived ? 'Yes' : 'No'}</td><td>{doc.waivedReason || 'Not waived'}</td><td>{doc.verificationNotesInternal || 'Not provided'}</td><td>{displayDate(doc.uploadedAt)}</td><td>{doc.verifiedBy || doc.waivedBy || 'Not provided'}</td><td><form action={runDocumentReviewAction} className="intake-form"><input type="hidden" name="submissionId" value={submission.id} /><input type="hidden" name="documentId" value={doc.id} /><input type="hidden" name="isRequired" value={required ? 'true' : 'false'} /><input name="internalReason" required placeholder="Internal note/reason" /><input name="waiverReason" placeholder="Waiver reason (required for required docs)" /><div className="button-row"><button type="submit" name="action" value="accept">Mark accepted</button><button type="submit" name="action" value="reject">Mark rejected</button><button type="submit" name="action" value="needs_reupload">Mark needs re-upload</button><button type="submit" name="action" value="waive">Waive requirement</button></div></form></td></tr>;
        })}</tbody></table></div>
      )}</section>

      <section className="section review-section"><h3>Current review state</h3>{submission.currentReviewState ? renderRows([
        ['Current stage', submission.currentReviewState.currentStage], ['Last decision', submission.currentReviewState.lastDecision], ['Mandatory stages complete', boolText(submission.currentReviewState.mandatoryStagesComplete)], ['Release checklist signed', boolText(submission.currentReviewState.releaseChecklistSigned)],
        ['Senior sign-off by', submission.currentReviewState.seniorSignOffBy], ['Senior sign-off at', submission.currentReviewState.seniorSignOffAt ? displayDate(submission.currentReviewState.seniorSignOffAt) : 'Not provided'], ['Updated at', displayDate(submission.currentReviewState.updatedAt)],
      ]) : <p>No review state available yet.</p>}</section>

      <section className="section review-section"><h3>Audit timeline</h3>{submission.auditEvents.length === 0 ? <p>No audit events available.</p> : (
        <ul className="review-list">{submission.auditEvents.map((event) => <li key={event.id}><strong>{event.eventType}</strong> at {displayDate(event.eventAt)}{event.reason ? ` — ${event.reason}` : ''}</li>)}</ul>
      )}</section>
    </>
  );
}
