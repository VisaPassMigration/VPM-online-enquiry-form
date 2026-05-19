import { Prisma, type AuditEvent, type AuditEventType as PrismaAuditEventType } from '@prisma/client';

import { db } from './db';

/**
 * Internal backend-only audit event service.
 * Keeps audit rows append-only by exposing create-only helpers.
 */

export const AUDIT_EVENT_TYPES = [
  'submission_created',
  'submission_updated',
  'submission_submitted',
  'status_transition_requested',
  'status_transition_applied',
  'risk_flags_computed',
  'points_snapshot_generated',
  'human_review_recorded',
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];
export type ActorRole = 'client' | 'staff' | 'reviewer' | 'admin' | 'system' | 'user';

export type AuditEventRecord = {
  eventType: AuditEventType;
  actorId: string;
  actorRole: ActorRole;
  submissionId: string;
  metadata: Record<string, unknown>;
  eventAt: string;
};

export function prepareAuditEvent(input: {
  eventType: AuditEventType;
  actorId: string;
  actorRole: ActorRole;
  submissionId: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}): AuditEventRecord {
  if (!input.eventType?.trim()) throw new Error('eventType is required.');
  if (!input.actorId.trim()) throw new Error('actorId is required.');
  if (!input.submissionId.trim()) throw new Error('submissionId is required.');

  return {
    eventType: input.eventType,
    actorId: input.actorId.trim(),
    actorRole: input.actorRole,
    submissionId: input.submissionId.trim(),
    metadata: input.metadata ?? {},
    eventAt: (input.timestamp ?? new Date()).toISOString(),
  };
}

const STAFF_USER_ROLES = new Set(['staff', 'admin', 'reviewer', 'user', 'client']);

export type RecordAuditEventInput = {
  submissionId: string;
  eventType: PrismaAuditEventType;
  actorId?: string;
  actorRole?: string;
  actorName?: string;
  actorStaffUserId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  fromValue?: Prisma.InputJsonValue;
  toValue?: Prisma.InputJsonValue;
  reason?: string;
  internalNote?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
  eventSource?: string;
  tx?: Prisma.TransactionClient;
};

function normalize(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function recordAuditEvent(input: RecordAuditEventInput): Promise<AuditEvent> {
  const submissionId = normalize(input.submissionId);
  if (!submissionId) throw new Error('submissionId is required.');

  const eventType = normalize(input.eventType);
  if (!eventType) throw new Error('eventType is required.');

  const actorRole = normalize(input.actorRole);
  const actorId = normalize(input.actorId);
  if (actorRole && STAFF_USER_ROLES.has(actorRole) && !actorId) {
    throw new Error(`actorId is required for actorRole ${actorRole}.`);
  }

  const client = input.tx ?? db;

  return client.auditEvent.create({
    data: {
      submissionId,
      eventType: eventType as PrismaAuditEventType,
      actorId,
      actorRole,
      actorName: normalize(input.actorName),
      actorStaffUserId: normalize(input.actorStaffUserId),
      relatedEntityType: normalize(input.relatedEntityType),
      relatedEntityId: normalize(input.relatedEntityId),
      fromValue: input.fromValue,
      toValue: input.toValue,
      reason: normalize(input.reason),
      internalNote: normalize(input.internalNote),
      metadata: input.metadata,
      ipAddress: normalize(input.ipAddress),
      userAgent: normalize(input.userAgent),
      eventSource: normalize(input.eventSource),
    },
  });
}

export async function writeAuditEvent(event: AuditEventRecord): Promise<AuditEventRecord> {
  return event;
}
