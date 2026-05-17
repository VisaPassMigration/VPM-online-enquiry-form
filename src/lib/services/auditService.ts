import { submissionStatusSchema } from '@/lib/schemas/intakeSubmission';

const auditEventTypeSchema = [
  'submission_created',
  'submission_updated',
  'submission_submitted',
  'document_uploaded',
  'document_verified',
  'document_rejected',
  'status_transition_executed',
  'risk_flag_created',
  'risk_flag_resolved',
  'points_snapshot_generated',
  'points_snapshot_regenerated',
  'client_summary_released',
] as const;

type AuditEventType = (typeof auditEventTypeSchema)[number];
type SubmissionStatus = ReturnType<typeof submissionStatusSchema.parse>;

export type AuditEventPayload = {
  submissionId: string;
  eventType: AuditEventType;
  actorId?: string;
  actorRole?: string;
  fromStatus?: SubmissionStatus;
  toStatus?: SubmissionStatus;
  reason?: string;
  metadata?: Record<string, unknown>;
  eventAt: string;
};

export function createAuditEventPayload(input: Omit<AuditEventPayload, 'eventAt'>): AuditEventPayload {
  if (!input.submissionId.trim()) {
    throw new Error('submissionId is required for audit events.');
  }

  if (!auditEventTypeSchema.includes(input.eventType)) {
    throw new Error(`Unsupported audit event type: ${input.eventType}`);
  }

  return {
    ...input,
    fromStatus: input.fromStatus ? submissionStatusSchema.parse(input.fromStatus) : undefined,
    toStatus: input.toStatus ? submissionStatusSchema.parse(input.toStatus) : undefined,
    eventAt: new Date().toISOString(),
  };
}
