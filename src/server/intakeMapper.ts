import type { AuditEventType as PrismaAuditEventType, PointsGeneratedBy, Prisma } from '@prisma/client';

import type { AuditEventRecord } from './audit';
import type { IntakeValidationInput, YesNo } from './intakeValidation';
import type { PointsSnapshotRecord } from './pointsSnapshots';
import type { IntakeRiskInput } from './riskFlags';
import type { IntakeSubmissionInput } from '@/lib/schemas/intakeSubmission';

/**
 * API boundary mapper for intake-related payloads.
 *
 * This module is intentionally backend-only: API handlers should call these
 * adapters before validation/service logic and before persistence to Prisma.
 * It decouples client/form payload shape from internal services and DB models.
 */

const toYesNo = (value: boolean | string | undefined): YesNo => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).trim().toLowerCase() === 'yes' ? 'Yes' : 'No';
};

export type ValidationPayloadSource = IntakeSubmissionInput & {
  fullName?: string;
  mainGoal?: string;
  timeframe?: string;
  currentOccupation?: string;
  maritalStatus?: string;
  migrateWithFamily?: boolean | string;
  partnerNationality?: string;
  previousCancellation?: boolean | string;
  overstayRemoval?: boolean | string;
  refusalDetails?: string;
  criminalDetails?: string;
  healthDetails?: string;
  cancellationOverstayDetails?: string;
  dateOfBirth?: string;
  address?: string;
  contactMethod?: string;
};

export function mapToIntakeValidationPayload(input: ValidationPayloadSource): IntakeValidationInput {
  return {
    fullName: input.fullName?.trim() || `${input.firstName} ${input.lastName}`.trim(),
    dateOfBirth: input.dateOfBirth ?? '',
    nationality: input.nationality,
    residenceCountry: input.countryOfResidence,
    address: input.address ?? '',
    email: input.email,
    phone: input.phone,
    contactMethod: input.contactMethod ?? 'Email',
    mainGoal: input.mainGoal ?? '',
    timeframe: input.timeframe ?? '',
    currentOccupation: input.currentOccupation ?? '',
    maritalStatus: input.maritalStatus ?? (input.hasPartner ? 'Married' : 'Single'),
    migrateWithFamily: toYesNo(input.migrateWithFamily),
    partnerFullName: input.partnerName ?? '',
    partnerNationality: input.partnerNationality ?? '',
    englishTestCompleted: toYesNo(input.englishTestTaken),
    englishTestType: input.englishTestType ?? '',
    englishScoreSummary: input.englishOverallBand !== undefined ? String(input.englishOverallBand) : '',
    previousRefusal: toYesNo(input.previousVisaRefusal),
    refusalDetails: input.refusalDetails ?? input.riskDetails ?? '',
    previousCancellation: toYesNo(input.previousCancellation ?? input.cancellationOverstayOrRemoval),
    overstayRemoval: toYesNo(input.overstayRemoval ?? input.cancellationOverstayOrRemoval),
    cancellationOverstayDetails: input.cancellationOverstayDetails ?? input.riskDetails ?? '',
    criminalHistory: toYesNo(input.criminalHistory),
    criminalDetails: input.criminalDetails ?? input.riskDetails ?? '',
    healthCondition: toYesNo(input.healthCondition),
    healthDetails: input.healthDetails ?? input.riskDetails ?? '',
  };
}

export function mapToRiskPayload(input: IntakeSubmissionInput & { missingItems?: string[]; preliminaryPoints?: number }): IntakeRiskInput {
  return {
    previousRefusal: toYesNo(input.previousVisaRefusal),
    previousCancellation: toYesNo(input.cancellationOverstayOrRemoval),
    overstayRemoval: toYesNo(input.cancellationOverstayOrRemoval),
    criminalHistory: toYesNo(input.criminalHistory),
    healthCondition: toYesNo(input.healthCondition),
    preliminaryPoints: input.preliminaryPoints,
    missingItems: input.missingItems,
  };
}

export type PreparedPointsSnapshotLike = PointsSnapshotRecord & {
  estimatedTotalPoints?: number;
};

export function mapToPointsSnapshotCreateInput(
  submissionId: string,
  snapshot: PreparedPointsSnapshotLike,
): Prisma.PointsSnapshotUncheckedCreateInput {
  return {
    submissionId,
    calculatorVersion: snapshot.calculatorVersion,
    inputPayload: snapshot.inputPayload as unknown as Prisma.InputJsonValue,
    totalPoints: snapshot.estimatedTotalPoints ?? snapshot.estimatedTotal,
    pointsBreakdown: snapshot.pointsBreakdown as unknown as Prisma.InputJsonValue,
    missingItems: snapshot.missingItems,
    generatedBy: snapshot.generatedBy as PointsGeneratedBy,
    generatedAt: new Date(snapshot.generatedAt),
    preliminaryLabel: `Range: ${snapshot.potentialRange}`,
  };
}

const AUDIT_EVENT_TYPE_MAP: Record<AuditEventRecord['eventType'], PrismaAuditEventType> = {
  submission_created: 'submission_created',
  submission_updated: 'submission_updated',
  submission_submitted: 'submission_submitted',
  status_transition_requested: 'status_transition_executed',
  status_transition_applied: 'status_transition_executed',
  risk_flags_computed: 'risk_flag_created',
  points_snapshot_generated: 'points_snapshot_generated',
  human_review_recorded: 'submission_updated',
};

export function mapToAuditEventCreateInput(event: AuditEventRecord): Prisma.AuditEventUncheckedCreateInput {
  return {
    submissionId: event.submissionId,
    eventType: AUDIT_EVENT_TYPE_MAP[event.eventType],
    actorId: event.actorId,
    actorRole: event.actorRole,
    eventAt: new Date(event.eventAt),
    metadata: event.metadata as Prisma.InputJsonValue,
  };
}

export function mapToIntakeSubmissionCreateInput(payload: IntakeSubmissionInput): Prisma.IntakeSubmissionUncheckedCreateInput {
  return {
    payload: payload as Prisma.InputJsonValue,
  };
}
