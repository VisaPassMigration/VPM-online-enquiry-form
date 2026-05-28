import { ClientCommunicationType, Prisma } from '@prisma/client';
import { recordAuditEvent } from './audit';
import { validateClientCommunicationRelease } from './clientCommunicationGate';
import { db } from './db';
import { sendConsultationInvitationEmail, sendRequestMoreInformationEmail } from './email';

type ActorRole = 'staff' | 'admin' | 'case_manager' | 'consultant' | 'reviewer' | 'system' | 'client';

type RequiredFields = {
  submissionId: string;
  communicationType: ClientCommunicationType;
  subject: string;
  bodyText: string;
  internalReason: string;
  actorId: string;
  actorRole: ActorRole;
  actorStaffUserId?: string;
};

export type CreateClientCommunicationDraftInput = RequiredFields & {
  templateVersion?: string;
};

export type RequestClientCommunicationReleaseInput = RequiredFields & {
  communicationId: string;
  resendReason?: string;
};

export type MarkClientCommunicationStateInput = RequiredFields & {
  communicationId: string;
  failureReason?: string;
};

const DEFAULT_TEMPLATE_VERSION = 'v1';

export const CLIENT_COMMUNICATION_TEMPLATES: Record<
  ClientCommunicationType,
  { subject: string; bodyText: string; internalReason: string }
> = {
  request_more_information: {
    subject: 'Additional information requested for your enquiry',
    bodyText:
      'Thank you for your submission.\n\nOur team has reviewed the information provided and requires additional documents or details before we can continue the preliminary review.\n\nPlease provide the following information:\n[staff-entered checklist or internal reason]\n\nThis request forms part of our preliminary review process and does not confirm eligibility for any visa or migration pathway.\n\nOnce received, our team will continue reviewing your enquiry and contact you regarding any suitable next steps.\n\nKind regards,\nVisa Pass Migration',
    internalReason: 'Staff needs additional details to continue internal review.',
  },
  consultation_invitation: {
    subject: 'Invitation to book a consultation',
    bodyText:
      'Thank you for the information provided so far.\n\nBased on our internal review, we invite you to book a consultation to discuss your circumstances and possible next steps.\n\nYou can book a consultation using the link below:\n[booking link placeholder]\n\nA consultation is an information and planning session. Any pathway options depend on full assessment, supporting evidence, and applicable migration requirements.\n\nKind regards,\nVisa Pass Migration',
    internalReason: 'Staff prepared a consultation invitation after internal checks.',
  },
  not_progressing_hold: {
    subject: 'Update on your submission status',
    bodyText:
      'Hello,\n\nThank you for your time. Your submission is currently on hold and is not progressing at this stage. If circumstances change, we can review new information in the future.\n\nKind regards,\nVisa Pass Migration',
    internalReason: 'Staff placed communication on hold with clear internal context.',
  },
};

function assertRequired(input: RequiredFields): void {
  if (!input.submissionId.trim()) throw new Error('submissionId is required.');
  if (!input.communicationType) throw new Error('communication type is required.');
  if (!input.subject.trim()) throw new Error('subject is required.');
  if (!input.bodyText.trim()) throw new Error('bodyText is required.');
  if (!input.internalReason.trim()) throw new Error('internalReason is required.');
  if (!input.actorId.trim()) throw new Error('actorId is required.');
  if (!input.actorRole.trim()) throw new Error('actorRole is required.');
}

async function createAuditEvent(input: {
  submissionId: string;
  communicationId: string;
  eventType:
    | 'client_comm_drafted'
    | 'client_comm_release_requested'
    | 'client_comm_released'
    | 'client_comm_release_blocked';
  actorId: string;
  actorRole: string;
  actorStaffUserId?: string;
  reason: string;
  metadata: Prisma.InputJsonObject;
  fromStatus?: string;
  toStatus?: string;
}) {
  return recordAuditEvent({
    submissionId: input.submissionId,
    eventType: input.eventType,
    actorId: input.actorId,
    actorRole: input.actorRole,
      actorStaffUserId: input.actorStaffUserId,
    relatedEntityType: 'client_communication',
    relatedEntityId: input.communicationId,
    fromValue: input.fromStatus,
    toValue: input.toStatus,
    internalNote: input.reason,
    reason: input.reason,
    metadata: { ...input.metadata, ...(input.actorStaffUserId ? { actorStaffUserId: input.actorStaffUserId } : {}) },
    eventSource: 'client_communications_service',
  });
}

export async function createClientCommunicationDraft(input: CreateClientCommunicationDraftInput) {
  assertRequired(input);

  const created = await db.clientCommunication.create({
    data: {
      submissionId: input.submissionId,
      type: input.communicationType,
      status: 'drafted_internal',
      subject: input.subject.trim(),
      bodyText: input.bodyText.trim(),
      templateVersion: input.templateVersion ?? DEFAULT_TEMPLATE_VERSION,
      internalReason: input.internalReason.trim(),
      requiresRiskClearance: input.communicationType === 'consultation_invitation',
    },
  });

  await createAuditEvent({
    submissionId: input.submissionId,
    eventType: 'client_comm_drafted',
    actorId: input.actorId,
    actorRole: input.actorRole,
      actorStaffUserId: input.actorStaffUserId,
    reason: input.internalReason.trim(),
    metadata: {
      communicationId: created.id,
      communicationType: input.communicationType,
      communicationStatus: created.status,
    },
    communicationId: created.id,
    toStatus: created.status,
  });

  return created;
}

export async function requestClientCommunicationRelease(input: RequestClientCommunicationReleaseInput) {
  assertRequired(input);

  const [submission, riskFlags, reviewState, existingCommunications] = await Promise.all([
    db.intakeSubmission.findUnique({ where: { id: input.submissionId } }),
    db.riskFlag.findMany({ where: { submissionId: input.submissionId } }),
    db.submissionReviewState.findUnique({ where: { submissionId: input.submissionId } }),
    db.clientCommunication.findMany({ where: { submissionId: input.submissionId } }),
  ]);

  const gate = validateClientCommunicationRelease({
    submission,
    communicationType: input.communicationType,
    internalNote: input.internalReason,
    actorId: input.actorId,
    actorRole: input.actorRole,
      actorStaffUserId: input.actorStaffUserId,
    resendReason: input.resendReason,
    riskFlags: riskFlags.map((flag) => ({
      key: flag.riskCode,
      severity: flag.severity,
      status: flag.resolutionStatus,
    })),
    reviewState: {
      state: reviewState?.currentStage,
      decision: reviewState?.lastDecision ?? undefined,
    },
    existingCommunications: existingCommunications.map((comm) => ({
      type: comm.type as
        | 'request_more_information'
        | 'consultation_invitation'
        | 'not_progressing_hold',
      status: comm.status as
        | 'drafted_internal'
        | 'pending_staff_release'
        | 'released'
        | 'blocked'
        | 'failed',
    })),
  });

  if (!gate.allowed) {
    await db.clientCommunication.update({
      where: { id: input.communicationId },
      data: { status: 'blocked' },
    });

    await createAuditEvent({
      submissionId: input.submissionId,
      communicationId: input.communicationId,
      eventType: 'client_comm_release_blocked',
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorStaffUserId: input.actorStaffUserId,
      reason: gate.blockedReason ?? 'release_blocked',
      metadata: {
        communicationId: input.communicationId,
        communicationType: input.communicationType,
        requiredChecks: gate.requiredChecks as unknown as Prisma.InputJsonObject,
      },
      toStatus: 'blocked',
    });

    throw new Error(`Client communication release blocked: ${gate.blockedReason ?? 'unknown_reason'}.`);
  }

  const updated = await db.clientCommunication.update({
    where: { id: input.communicationId },
    data: {
      status: 'pending_staff_release',
      internalReason: input.internalReason.trim(),
      subject: input.subject.trim(),
      bodyText: input.bodyText.trim(),
    },
  });

  await createAuditEvent({
    submissionId: input.submissionId,
    eventType: 'client_comm_release_requested',
    actorId: input.actorId,
    actorRole: input.actorRole,
      actorStaffUserId: input.actorStaffUserId,
    reason: input.internalReason.trim(),
    metadata: {
      communicationId: input.communicationId,
      communicationType: input.communicationType,
      communicationStatus: updated.status,
    },
    communicationId: input.communicationId,
    fromStatus: 'drafted_internal',
    toStatus: updated.status,
  });

  return updated;
}

export async function markClientCommunicationBlocked(input: MarkClientCommunicationStateInput) {
  assertRequired(input);
  const updated = await db.clientCommunication.update({ where: { id: input.communicationId }, data: { status: 'blocked' } });
  await createAuditEvent({ submissionId: input.submissionId, communicationId: input.communicationId, eventType: 'client_comm_release_blocked', actorId: input.actorId, actorRole: input.actorRole, reason: input.internalReason, fromStatus: 'pending_staff_release', toStatus: 'blocked', metadata: { communicationId: input.communicationId, communicationType: input.communicationType } });
  return updated;
}

export async function markClientCommunicationReleased(input: MarkClientCommunicationStateInput) {
  assertRequired(input);
  const gate = validateClientCommunicationRelease({ submission: { id: input.submissionId }, communicationType: input.communicationType, internalNote: input.internalReason, actorId: input.actorId, actorRole: input.actorRole });
  if (!gate.allowed) throw new Error(`Client communication release blocked: ${gate.blockedReason ?? 'unknown_reason'}.`);
  const updated = await db.clientCommunication.update({ where: { id: input.communicationId }, data: { status: 'released', releasedBy: input.actorId, releasedAt: new Date() } });
  await createAuditEvent({ submissionId: input.submissionId, communicationId: input.communicationId, eventType: 'client_comm_released', actorId: input.actorId, actorRole: input.actorRole, reason: input.internalReason, fromStatus: 'pending_staff_release', toStatus: 'released', metadata: { communicationId: input.communicationId, communicationType: input.communicationType } });
  return updated;
}

export async function markClientCommunicationFailed(input: MarkClientCommunicationStateInput) {
  assertRequired(input);
  return db.clientCommunication.update({ where: { id: input.communicationId }, data: { status: 'failed', failureReason: input.failureReason?.trim() || 'unknown_failure' } });
}

export async function releaseRequestMoreInformationCommunication(input: RequestClientCommunicationReleaseInput) {
  assertRequired(input);
  if (input.communicationType !== 'request_more_information') {
    throw new Error('Only request_more_information communications can be released by this action.');
  }

  const submission = await db.intakeSubmission.findUnique({ where: { id: input.submissionId } });
  const gate = validateClientCommunicationRelease({
    submission,
    communicationType: input.communicationType,
    internalNote: input.internalReason,
    actorId: input.actorId,
    actorRole: input.actorRole,
      actorStaffUserId: input.actorStaffUserId,
  });

  if (!gate.allowed) {
    await db.clientCommunication.update({ where: { id: input.communicationId }, data: { status: 'blocked' } });
    await createAuditEvent({
      submissionId: input.submissionId,
      communicationId: input.communicationId,
      eventType: 'client_comm_release_blocked',
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorStaffUserId: input.actorStaffUserId,
      reason: gate.blockedReason ?? 'release_blocked',
      metadata: { communicationId: input.communicationId, communicationType: input.communicationType },
    });
    throw new Error(`Client communication release blocked: ${gate.blockedReason ?? 'unknown_reason'}.`);
  }

  const email = typeof submission?.payload === 'object' && submission.payload && !Array.isArray(submission.payload)
    ? (submission.payload as Record<string, unknown>).email
    : undefined;
  const to = typeof email === 'string' ? email.trim() : '';
  if (!to) throw new Error('Client email is required before releasing request_more_information communication.');

  try {
    await sendRequestMoreInformationEmail({ to, checklistOrReason: input.internalReason.trim() });
    const updated = await db.clientCommunication.update({
      where: { id: input.communicationId },
      data: { status: 'released', releasedBy: input.actorId, releasedAt: new Date(), internalReason: input.internalReason.trim() },
    });
    await createAuditEvent({
      submissionId: input.submissionId,
      communicationId: input.communicationId,
      eventType: 'client_comm_released',
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorStaffUserId: input.actorStaffUserId,
      reason: input.internalReason.trim(),
      metadata: { communicationId: input.communicationId, communicationType: input.communicationType },
    });
    return updated;
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : 'unknown_failure';
    const failed = await db.clientCommunication.update({ where: { id: input.communicationId }, data: { status: 'failed', failureReason } });
    await createAuditEvent({
      submissionId: input.submissionId,
      communicationId: input.communicationId,
      eventType: 'client_comm_release_blocked',
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorStaffUserId: input.actorStaffUserId,
      reason: 'email_send_failed',
      metadata: { communicationId: input.communicationId, communicationType: input.communicationType, failureReason } as Prisma.InputJsonObject,
    });
    return failed;
  }
}

export async function releaseConsultationInvitationCommunication(input: RequestClientCommunicationReleaseInput) {
  assertRequired(input);
  if (input.communicationType !== 'consultation_invitation') {
    throw new Error('Only consultation_invitation communications can be released by this action.');
  }

  const [submission, riskFlags, reviewState, existingCommunications] = await Promise.all([
    db.intakeSubmission.findUnique({ where: { id: input.submissionId } }),
    db.riskFlag.findMany({ where: { submissionId: input.submissionId } }),
    db.submissionReviewState.findUnique({ where: { submissionId: input.submissionId } }),
    db.clientCommunication.findMany({ where: { submissionId: input.submissionId } }),
  ]);

  const gate = validateClientCommunicationRelease({
    submission,
    communicationType: input.communicationType,
    internalNote: input.internalReason,
    actorId: input.actorId,
    actorRole: input.actorRole,
      actorStaffUserId: input.actorStaffUserId,
    riskFlags: riskFlags.map((flag) => ({
      key: flag.riskCode,
      severity: flag.severity,
      status: flag.resolutionStatus,
    })),
    reviewState: {
      state: reviewState?.currentStage,
      decision: reviewState?.lastDecision ?? undefined,
    },
    existingCommunications: existingCommunications.map((comm) => ({
      type: comm.type as ClientCommunicationType,
      status: comm.status as
        | 'drafted_internal'
        | 'pending_staff_release'
        | 'released'
        | 'blocked'
        | 'failed',
    })),
  });

  if (!gate.allowed) {
    await db.clientCommunication.update({ where: { id: input.communicationId }, data: { status: 'blocked' } });
    await createAuditEvent({
      submissionId: input.submissionId,
      communicationId: input.communicationId,
      eventType: 'client_comm_release_blocked',
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorStaffUserId: input.actorStaffUserId,
      reason: gate.blockedReason ?? 'release_blocked',
      metadata: { communicationId: input.communicationId, communicationType: input.communicationType },
    });
    throw new Error(`Client communication release blocked: ${gate.blockedReason ?? 'unknown_reason'}.`);
  }

  const email = typeof submission?.payload === 'object' && submission.payload && !Array.isArray(submission.payload)
    ? (submission.payload as Record<string, unknown>).email
    : undefined;
  const to = typeof email === 'string' ? email.trim() : '';
  if (!to) throw new Error('Client email is required before releasing consultation_invitation communication.');

  try {
    await sendConsultationInvitationEmail({ to });
    const updated = await db.clientCommunication.update({
      where: { id: input.communicationId },
      data: { status: 'released', releasedBy: input.actorId, releasedAt: new Date(), internalReason: input.internalReason.trim() },
    });
    await createAuditEvent({
      submissionId: input.submissionId,
      communicationId: input.communicationId,
      eventType: 'client_comm_released',
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorStaffUserId: input.actorStaffUserId,
      reason: input.internalReason.trim(),
      metadata: { communicationId: input.communicationId, communicationType: input.communicationType },
    });
    return updated;
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : 'unknown_failure';
    const failed = await db.clientCommunication.update({ where: { id: input.communicationId }, data: { status: 'failed', failureReason } });
    await createAuditEvent({
      submissionId: input.submissionId,
      communicationId: input.communicationId,
      eventType: 'client_comm_release_blocked',
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorStaffUserId: input.actorStaffUserId,
      reason: 'email_send_failed',
      metadata: { communicationId: input.communicationId, communicationType: input.communicationType, failureReason } as Prisma.InputJsonObject,
    });
    return failed;
  }
}
