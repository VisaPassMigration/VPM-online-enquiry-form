import { revalidatePath } from 'next/cache';
import { AuditEventType, LeadRating, Prisma, RiskResolutionStatus, RiskSeverity, ReviewDecision, ReviewStage, SubmissionStatus } from '@prisma/client';

import { PERMISSIONS, ROLES, UNKNOWN_STAFF_ROLE, normalizeRoleKeys, resolveActorRole, type RoleKey } from '@/server/auth/permissions';
import { requirePermission } from '@/server/auth/requirePermission';
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
import {
  approveClearReportForConsultation,
  completeAustraliaClearReview,
  generateClearReportDraft,
  markClearReportPrepared,
  overrideApproveClearReport,
  requestAustraliaClearReview,
  updateClearReportNotes,
} from '@/server/clearReports';

type ClientCommunicationActorRole = 'staff' | 'admin' | 'case_manager' | 'consultant' | 'reviewer' | 'system' | 'client';

type StaffActorContext = {
  actorId: string;
  actorName: string;
  actorRole: RoleKey;
  actorRoles: RoleKey[];
  actorStaffUserId: string;
};

type ClientCommunicationActorContext = Omit<StaffActorContext, 'actorRole'> & {
  actorRole: ClientCommunicationActorRole;
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

function mapClientCommunicationActorRole(actorRole: RoleKey): ClientCommunicationActorRole {
  if (actorRole === ROLES.BOSS_ADMIN) return 'admin';
  if (actorRole === ROLES.SENIOR_STAFF) return 'staff';
  if (actorRole === ROLES.KENYA_INTAKE_STAFF) return 'staff';
  if (actorRole === ROLES.AUSTRALIA_MIGRATION_TEAM) return 'consultant';
  if (actorRole === ROLES.READ_ONLY_REVIEWER) return 'reviewer';
  return 'staff';
}

async function requireStaffActorContext(permission?: string): Promise<StaffActorContext> {
  const { requireStaffSession } = await import('@/server/auth/requireStaffSession');
  const session = await requireStaffSession();
  if (permission) await requirePermission(permission as never);

  const actorId = String(session.user.staffUserId ?? '').trim();
  const actorName = session.user.name?.trim() || session.user.email?.trim() || actorId;
  const actorRole = resolveActorRole(session.user.roles ?? []);
  const actorRoles = normalizeRoleKeys(session.user.roles ?? []);

  if (!actorId) throw new Error('Missing authenticated staff actor id');
  if (actorRole === UNKNOWN_STAFF_ROLE || actorRoles.length === 0) throw new Error('Missing authenticated staff actor role');

  return { actorId, actorName, actorRole, actorRoles, actorStaffUserId: actorId };
}

async function requireStaffActorContextForClientCommunication(permission: string): Promise<ClientCommunicationActorContext> {
  const actor = await requireStaffActorContext(permission);
  return { ...actor, actorRole: mapClientCommunicationActorRole(actor.actorRole) };
}

function resolveDocumentReviewEventType(action: string): AuditEventType {
  if (action === 'accept') return AuditEventType.document_accepted;
  if (action === 'reject') return AuditEventType.document_rejected;
  if (action === 'needs_reupload') return AuditEventType.document_rejected;
  if (action === 'waive') return AuditEventType.document_waived;
  throw new Error(`Document review action validation failed: unknown action "${action}".`);
}

export async function runInternalReviewAction(formData: FormData) {
  'use server';
  const actor = await requireStaffActorContext(PERMISSIONS.PERFORM_INTERNAL_REVIEW_ACTIONS);

  const submissionId = String(formData.get('submissionId') ?? '');
  const action = String(formData.get('action') ?? '');
  const note = String(formData.get('internalNote') ?? '').trim();
  const reasonPreset = String(formData.get('reasonPreset') ?? '').trim();
  const auditNote = [reasonPreset, note].filter(Boolean).join(' — ');
  const { actorId, actorName, actorRole, actorStaffUserId } = actor;

  if (!submissionId || !action || !auditNote || !actorId) return;

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
          internalNote: auditNote,
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
        internalNotes: auditNote,
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
      reason: auditNote,
      internalNote: auditNote,
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
  'use server';

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

  const actor = await requireStaffActorContext();
  const { actorId, actorName, actorRole, actorStaffUserId } = actor;

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

  await requirePermission(PERMISSIONS.REVIEW_SUBMISSION_DOCUMENTS);
  const actor = await requireStaffActorContext();
  const { actorId, actorName, actorRole, actorStaffUserId } = actor;

  const eventType = resolveDocumentReviewEventType(action);

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
    } else if (action === 'reject') {
      nextStatus = 'rejected';
      updateData.verificationStatus = nextStatus;
      updateData.verifiedBy = actorId;
      updateData.verifiedAt = new Date();
    } else if (action === 'needs_reupload') {
      nextStatus = 'needs_reupload';
      updateData.verificationStatus = nextStatus;
      updateData.verifiedBy = actorId;
      updateData.verifiedAt = new Date();
      metadata = { requiresReupload: true };
    } else if (action === 'waive') {
      nextStatus = existing.verificationStatus;
      updateData.waived = true;
      updateData.waivedReason = waiverReason;
      updateData.waivedBy = actorId;
      updateData.waivedAt = new Date();
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
  const submissionId = String(formData.get('submissionId') ?? '').trim();
  const action = String(formData.get('action') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const rating = String(formData.get('rating') ?? '').trim() as LeadRating;
  const actor = await requireStaffActorContext();

  if (!submissionId || !action || !actor.actorId) return;

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

export async function runGenerateClearReportDraftAction(formData: FormData) {
  'use server';
  await requirePermission(PERMISSIONS.GENERATE_CLEAR_REPORT);

  const submissionId = String(formData.get('submissionId') ?? '').trim();
  const internalReason = String(formData.get('internalReason') ?? '').trim();
  const overrideNote = String(formData.get('overrideNote') ?? '').trim();
  const actor = await requireStaffActorContext();
  if (!submissionId || !internalReason || !actor.actorId) return;

  await generateClearReportDraft({
    submissionId,
    actor,
    staffNotes: internalReason,
    overrideNote: overrideNote || undefined,
  });

  revalidatePath(`/dashboard/intakes/${submissionId}`);
}

export async function runClearWorkflowAction(formData: FormData) {
  'use server';
  const clearReportId = String(formData.get('clearReportId') ?? '').trim();
  const submissionId = String(formData.get('submissionId') ?? '').trim();
  const action = String(formData.get('action') ?? '').trim();
  const internalReason = String(formData.get('internalReason') ?? '').trim();
  const actor = await requireStaffActorContext();
  if (!clearReportId || !submissionId || !action || !internalReason || !actor.actorId) return;

  if (action === 'mark_prepared') await markClearReportPrepared({ clearReportId, actor, note: internalReason });
  if (action === 'approve_for_consultation') await approveClearReportForConsultation({ clearReportId, actor, approvalNote: internalReason });
  if (action === 'request_au_review') await requestAustraliaClearReview({ clearReportId, actor, reason: internalReason });
  if (action === 'complete_au_review') await completeAustraliaClearReview({ clearReportId, actor, reviewNotes: internalReason });
  if (action === 'boss_override_approve') await overrideApproveClearReport({ clearReportId, actor, overrideReason: internalReason });
  revalidatePath(`/dashboard/intakes/${submissionId}`);
}

export async function runUpdateClearReportNotesAction(formData: FormData) {
  'use server';
  await requirePermission(PERMISSIONS.EDIT_CLEAR_REPORT);
  const clearReportId = String(formData.get('clearReportId') ?? '').trim();
  const submissionId = String(formData.get('submissionId') ?? '').trim();
  const staffNotes = String(formData.get('staffNotes') ?? '');
  const clientFacingNotes = String(formData.get('clientFacingNotes') ?? '');
  const internalReason = String(formData.get('internalReason') ?? '').trim();
  const actor = await requireStaffActorContext();
  if (!clearReportId || !submissionId || !internalReason || !actor.actorId) return;

  await updateClearReportNotes({
    clearReportId,
    actor,
    staffNotes,
    clientFacingNotes,
    reason: internalReason,
  });
  revalidatePath(`/dashboard/intakes/${submissionId}`);
}

export { runUpdateClearReportNotesAction as updateClearReportNotesAction };
