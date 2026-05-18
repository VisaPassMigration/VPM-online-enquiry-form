/**
 * Internal backend-only audit event service.
 * API routes and storage wiring will be added later.
 * Human review remains mandatory before any client communication state changes.
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
export type ActorRole = 'client' | 'staff' | 'reviewer' | 'admin' | 'system';

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

export async function writeAuditEvent(event: AuditEventRecord): Promise<AuditEventRecord> {
  // Placeholder writer for now. DB persistence integration comes later.
  return event;
}
