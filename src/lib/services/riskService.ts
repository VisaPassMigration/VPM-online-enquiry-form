import type { IntakeSubmissionInput } from '@/lib/schemas/intakeSubmission';

const REQUIRED_DOCUMENT_TYPES = ['passportBioPage', 'resume', 'qualificationsDoc'] as const;

export type RiskFlags = {
  previousRefusal: boolean;
  cancellationOverstayRemoval: boolean;
  criminalHistory: boolean;
  healthCondition: boolean;
  missingRequiredDocuments: boolean;
  lowPreliminaryPoints: boolean;
};

export function computeRiskFlags(submission: IntakeSubmissionInput, minimumPreliminaryPoints = 65): RiskFlags {
  const uploadedTypes = new Set(submission.documents.map((d) => d.documentType));
  const missingRequiredDocuments = REQUIRED_DOCUMENT_TYPES.some((docType) => !uploadedTypes.has(docType));

  return {
    previousRefusal: submission.previousVisaRefusal,
    cancellationOverstayRemoval: submission.cancellationOverstayOrRemoval,
    criminalHistory: submission.criminalHistory,
    healthCondition: submission.healthCondition,
    missingRequiredDocuments,
    lowPreliminaryPoints: (submission.preliminaryPoints ?? 0) < minimumPreliminaryPoints,
  };
}
