/**
 * Backend-only communication release gate for client messaging.
 *
 * IMPORTANT SAFETY NOTES:
 * - This service validates release permission only.
 * - This service does not send any email or message.
 * - This service does not decide migration outcomes.
 * - Human staff review and action remain mandatory.
 */

export type ClientCommunicationType =
  | 'request_more_information'
  | 'consultation_invitation'
  | 'not_progressing_hold';

export type ClientCommunicationStatus =
  | 'drafted_internal'
  | 'pending_staff_release'
  | 'released'
  | 'blocked'
  | 'failed';

export type CommunicationRiskFlag = {
  key: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status?: 'open' | 'under_review' | 'resolved' | 'closed';
};

export type CommunicationReviewState = {
  state?: string;
  decision?: string;
};

export type ExistingCommunicationRecord = {
  type: ClientCommunicationType;
  status: ClientCommunicationStatus;
};

export type ValidateClientCommunicationReleaseInput = {
  submission: unknown;
  communicationType: string;
  internalNote?: string;
  actorId?: string;
  actorRole?: string;
  riskFlags?: CommunicationRiskFlag[];
  reviewState?: CommunicationReviewState;
  existingCommunications?: ExistingCommunicationRecord[];
  resendReason?: string;
};

export type CommunicationGateCheckResult = {
  staffActionRequired: boolean;
  internalNoteRequired: boolean;
  submissionExists: boolean;
  communicationTypeSupported: boolean;
  noAutomaticOrSystemRelease: boolean;
  consultationRiskClear: boolean;
  consultationReady: boolean;
  duplicateReleaseGuard: boolean;
};

export type ValidateClientCommunicationReleaseResult = {
  allowed: boolean;
  blockedReason?: string;
  requiredChecks: CommunicationGateCheckResult;
  auditEventType:
    | 'client_communication_release_validated'
    | 'client_communication_release_blocked';
};

const SUPPORTED_TYPES: ClientCommunicationType[] = [
  'request_more_information',
  'consultation_invitation',
  'not_progressing_hold',
];

function isSupportedType(type: string): type is ClientCommunicationType {
  return SUPPORTED_TYPES.includes(type as ClientCommunicationType);
}

function isStaffActor(actorRole?: string): boolean {
  if (!actorRole) return false;
  return ['staff', 'admin', 'case_manager', 'consultant'].includes(
    actorRole.toLowerCase(),
  );
}

function isOpenHighOrCriticalRisk(flag: CommunicationRiskFlag): boolean {
  const severe = flag.severity === 'high' || flag.severity === 'critical';
  const status = flag.status ?? 'open';
  const unresolved = status === 'open' || status === 'under_review';
  return severe && unresolved;
}

function isConsultationReady(reviewState?: CommunicationReviewState): boolean {
  const state = reviewState?.state?.toLowerCase() ?? '';
  const decision = reviewState?.decision?.toLowerCase() ?? '';
  return (
    state === 'consultation_ready' ||
    state === 'ready_for_consultation' ||
    decision === 'consultation_ready' ||
    decision === 'consultation_invite'
  );
}

export function validateClientCommunicationRelease(
  input: ValidateClientCommunicationReleaseInput,
): ValidateClientCommunicationReleaseResult {
  const supportedType = isSupportedType(input.communicationType);
  const staffActor = isStaffActor(input.actorRole);
  const notePresent = Boolean(input.internalNote?.trim());
  const submissionExists = Boolean(input.submission);
  const noAutomaticOrSystemRelease =
    Boolean(input.actorId?.trim()) && input.actorRole?.toLowerCase() !== 'system';

  const isConsultation = input.communicationType === 'consultation_invitation';
  const hasUnresolvedSevereRisk = (input.riskFlags ?? []).some(
    isOpenHighOrCriticalRisk,
  );

  const duplicateReleasedSameType = (input.existingCommunications ?? []).some(
    (comm) => comm.type === input.communicationType && comm.status === 'released',
  );
  const hasResendReason = Boolean(input.resendReason?.trim());

  const requiredChecks: CommunicationGateCheckResult = {
    staffActionRequired: staffActor,
    internalNoteRequired: notePresent,
    submissionExists,
    communicationTypeSupported: supportedType,
    noAutomaticOrSystemRelease,
    consultationRiskClear: !isConsultation || !hasUnresolvedSevereRisk,
    consultationReady: !isConsultation || isConsultationReady(input.reviewState),
    duplicateReleaseGuard: !duplicateReleasedSameType || hasResendReason,
  };

  const blockedReason = Object.entries(requiredChecks).find(([, pass]) => !pass)?.[0];

  return {
    allowed: !blockedReason,
    blockedReason,
    requiredChecks,
    auditEventType: blockedReason
      ? 'client_communication_release_blocked'
      : 'client_communication_release_validated',
  };
}
