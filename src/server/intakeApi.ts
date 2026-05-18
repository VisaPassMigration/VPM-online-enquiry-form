import type { Prisma, SubmissionStatus } from '@prisma/client';

import { intakeSubmissionSchema, type IntakeSubmissionInput } from '@/lib/schemas/intakeSubmission';
import type { PointsCalculatorInput } from '@/lib/pointsCalculator';
import { mapToAuditEventCreateInput, mapToIntakeSubmissionCreateInput, mapToIntakeValidationPayload, mapToPointsSnapshotCreateInput, mapToRiskPayload } from './intakeMapper';
import { prepareAuditEvent } from './audit';
import { preparePointsSnapshot } from './pointsSnapshots';
import { computeRiskFlags } from './riskFlags';
import { validateIntakePayload } from './intakeValidation';
import { validateWorkflowTransition } from './workflow';

export const PLACEHOLDER_ACTOR = { actorId: 'anonymous-client', actorRole: 'client' as const };

export function parseIntakePayload(raw: unknown): { payload?: IntakeSubmissionInput; errors?: Record<string, string> } {
  const parsed = intakeSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      const key = issue.path.join('.') || 'payload';
      errors[key] = issue.message;
    });
    return { errors };
  }

  const validationErrors = validateIntakePayload(mapToIntakeValidationPayload(parsed.data));
  if (Object.keys(validationErrors).length > 0) return { errors: validationErrors };

  return { payload: parsed.data };
}

export function toPointsInput(payload: IntakeSubmissionInput): PointsCalculatorInput {
  return {
    ageBracket: '25-32',
    englishLevel: payload.englishOverallBand && payload.englishOverallBand >= 8 ? 'Superior' : payload.englishOverallBand && payload.englishOverallBand >= 7 ? 'Proficient' : 'Competent',
    overseasSkilledEmploymentYears: '0-2',
    australianSkilledEmploymentYears: '0',
    highestQualificationLevel: 'Bachelor/Masters',
    australianStudyRequirementCompleted: 'No',
    regionalStudyCompleted: 'No',
    specialistEducationalQualification: 'No',
    professionalYearCompleted: 'No',
    naatiCredential: 'No',
    partnerPointsCategory: payload.hasPartner ? 'Partner has competent English only' : 'Single or partner is AU citizen/PR',
    nominationType: 'None',
    englishTestCompleted: payload.englishTestTaken ? 'Yes' : 'No',
    migrationOccupation: '',
    workExperienceYears: '',
    completionYear: '',
  };
}

export function riskSeverityToPrisma(value: 'low' | 'medium' | 'high'): 'low' | 'medium' | 'high' | 'critical' {
  return value;
}

export function assertDraftStatus(status: SubmissionStatus) {
  if (status !== 'draft') throw Object.assign(new Error('Submission is no longer draft.'), { code: 409 });
}

export function prepareStatusTransition(from: SubmissionStatus, to: SubmissionStatus) {
  try {
    return validateWorkflowTransition(from, to, { isAutomatedAction: false });
  } catch (error) {
    throw Object.assign(new Error(error instanceof Error ? error.message : 'Invalid workflow transition'), { code: 409 });
  }
}

export function buildAuditCreate(submissionId: string, eventType: Parameters<typeof prepareAuditEvent>[0]['eventType'], metadata: Record<string, unknown> = {}) {
  return mapToAuditEventCreateInput(
    prepareAuditEvent({ submissionId, eventType, metadata, ...PLACEHOLDER_ACTOR }),
  );
}

export function mapPrismaError(error: unknown): { code: number; message: string } {
  if (error instanceof Error && 'code' in error && (error as { code?: number }).code) {
    return { code: Number((error as { code?: number }).code), message: error.message };
  }
  return { code: 500, message: 'Unexpected server error.' };
}

export { mapToIntakeSubmissionCreateInput, mapToPointsSnapshotCreateInput, mapToRiskPayload, preparePointsSnapshot, computeRiskFlags };
