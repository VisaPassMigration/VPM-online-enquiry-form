import { ClientCommunicationType, Prisma } from '@prisma/client';
import { validateClientCommunicationRelease } from './clientCommunicationGate';
import { db } from './db';

type ActorRole = 'staff' | 'admin' | 'case_manager' | 'consultant' | 'reviewer' | 'system' | 'client';

type RequiredFields = {
  submissionId: string;
  communicationType: ClientCommunicationType;
  subject: string;
  bodyText: string;
  internalReason: string;
  actorId: string;
  actorRole: ActorRole;
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
    subject: 'Additional information requested for your submission',
    bodyText:
      'Hello,\n\nThank you for your submission. We need a few additional details to continue internal review. A team member will contact you with specific requests.\n\nKind regards,\nVisa Pass Migration',
    internalReason: 'Staff needs additional details to continue internal review.',
  },
  consultation_invitation: {
    subject: 'Invitation to schedule a consultation',
    bodyText:
      'Hello,\n\nThank you for your submission. Our team is ready to offer a consultation to discuss next steps and answer your questions. We will follow up with scheduling details.\n\nKind regards,\nVisa Pass Migration',
    internalReason: 'Staff is ready to invite the client to a consultation discussion.',
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
  eventType:
    | 'client_comm_drafted'
    | 'client_comm_release_requested'
    | 'client_comm_released'
    | 'client_comm_release_blocked';
  actorId: string;
  actorRole: string;
  reason: string;
  metadata: Prisma.InputJsonObject;
}) {
  return db.auditEvent.create({
    data: {
      submissionId: input.submissionId,
      eventType: input.eventType,
      actorId: input.actorId,
      actorRole: input.actorRole,
      reason: input.reason,
      metadata: input.metadata,
    },
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
    reason: input.internalReason.trim(),
    metadata: {
      communicationId: created.id,
      communicationType: input.communicationType,
      communicationStatus: created.status,
    },
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
      eventType: 'client_comm_release_blocked',
      actorId: input.actorId,
      actorRole: input.actorRole,
      reason: gate.blockedReason ?? 'release_blocked',
      metadata: {
        communicationId: input.communicationId,
        communicationType: input.communicationType,
        requiredChecks: gate.requiredChecks as unknown as Prisma.InputJsonObject,
      },
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
    reason: input.internalReason.trim(),
    metadata: {
      communicationId: input.communicationId,
      communicationType: input.communicationType,
      communicationStatus: updated.status,
    },
  });

  return updated;
}

export async function markClientCommunicationBlocked(input: MarkClientCommunicationStateInput) {
  assertRequired(input);
  const updated = await db.clientCommunication.update({ where: { id: input.communicationId }, data: { status: 'blocked' } });
  await createAuditEvent({ submissionId: input.submissionId, eventType: 'client_comm_release_blocked', actorId: input.actorId, actorRole: input.actorRole, reason: input.internalReason, metadata: { communicationId: input.communicationId, communicationType: input.communicationType } });
  return updated;
}

export async function markClientCommunicationReleased(input: MarkClientCommunicationStateInput) {
  assertRequired(input);
  const gate = validateClientCommunicationRelease({ submission: { id: input.submissionId }, communicationType: input.communicationType, internalNote: input.internalReason, actorId: input.actorId, actorRole: input.actorRole });
  if (!gate.allowed) throw new Error(`Client communication release blocked: ${gate.blockedReason ?? 'unknown_reason'}.`);
  const updated = await db.clientCommunication.update({ where: { id: input.communicationId }, data: { status: 'released', releasedBy: input.actorId, releasedAt: new Date() } });
  await createAuditEvent({ submissionId: input.submissionId, eventType: 'client_comm_released', actorId: input.actorId, actorRole: input.actorRole, reason: input.internalReason, metadata: { communicationId: input.communicationId, communicationType: input.communicationType } });
  return updated;
}

export async function markClientCommunicationFailed(input: MarkClientCommunicationStateInput) {
  assertRequired(input);
  return db.clientCommunication.update({ where: { id: input.communicationId }, data: { status: 'failed', failureReason: input.failureReason?.trim() || 'unknown_failure' } });
}
