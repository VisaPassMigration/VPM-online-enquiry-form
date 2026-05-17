import { z } from 'zod';

const yesNoUnknownSchema = z.enum(['yes', 'no', 'unknown']);

export const submissionStatusSchema = z.enum([
  'draft',
  'submitted',
  'intake_triage_in_progress',
  'awaiting_client_documents',
  'document_review_in_progress',
  'risk_review_in_progress',
  'preliminary_points_review_in_progress',
  'senior_review_in_progress',
  'ready_for_client_summary',
  'client_summary_sent',
  'on_hold',
  'closed',
]);

export const intakeDocumentMetadataSchema = z.object({
  documentType: z.enum([
    'passportBioPage',
    'resume',
    'qualificationsDoc',
    'transcripts',
    'englishResultDoc',
    'skillsAssessmentDoc',
    'refusalDocs',
    'otherSupportingDocs',
  ]),
  originalFilename: z.string().min(1),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().int().positive(),
  uploadedBy: z.enum(['client', 'staff']),
});

const baseSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(5),
  nationality: z.string().min(1),
  countryOfResidence: z.string().min(1),

  englishTestTaken: z.boolean(),
  englishTestType: z.string().optional(),
  englishOverallBand: z.number().min(0).max(9).optional(),
  englishTestDate: z.string().optional(),

  hasPartner: z.boolean(),
  partnerName: z.string().optional(),
  partnerEnglishCompetency: yesNoUnknownSchema.optional(),
  partnerSkillsAssessment: yesNoUnknownSchema.optional(),

  previousVisaRefusal: z.boolean(),
  cancellationOverstayOrRemoval: z.boolean(),
  criminalHistory: z.boolean(),
  healthCondition: z.boolean(),
  riskDetails: z.string().optional(),

  preliminaryPoints: z.number().int().nonnegative().max(200).optional(),
  documents: z.array(intakeDocumentMetadataSchema).default([]),
});

export const intakeSubmissionSchema = baseSchema
  .superRefine((data: IntakeSubmissionRefinementInput, ctx: { addIssue: (issue: { code: string; path?: string[]; message: string }) => void }) => {
    if (data.englishTestTaken) {
      if (!data.englishTestType?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['englishTestType'], message: 'English test type is required.' });
      }
      if (data.englishOverallBand === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['englishOverallBand'], message: 'English score is required.' });
      }
      if (!data.englishTestDate?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['englishTestDate'], message: 'English test date is required.' });
      }
    }

    if (data.hasPartner) {
      if (!data.partnerName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['partnerName'], message: 'Partner name is required when partner details are provided.' });
      }
      if (!data.partnerEnglishCompetency) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['partnerEnglishCompetency'], message: 'Partner English competency is required.' });
      }
      if (!data.partnerSkillsAssessment) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['partnerSkillsAssessment'], message: 'Partner skills assessment status is required.' });
      }
    }

    const riskTriggered = data.previousVisaRefusal || data.cancellationOverstayOrRemoval || data.criminalHistory || data.healthCondition;
    if (riskTriggered && !data.riskDetails?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['riskDetails'], message: 'Risk details are required when any risk condition is selected.' });
    }
  });

export type IntakeSubmissionInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  countryOfResidence: string;
  englishTestTaken: boolean;
  englishTestType?: string;
  englishOverallBand?: number;
  englishTestDate?: string;
  hasPartner: boolean;
  partnerName?: string;
  partnerEnglishCompetency?: "yes" | "no" | "unknown";
  partnerSkillsAssessment?: "yes" | "no" | "unknown";
  previousVisaRefusal: boolean;
  cancellationOverstayOrRemoval: boolean;
  criminalHistory: boolean;
  healthCondition: boolean;
  riskDetails?: string;
  preliminaryPoints?: number;
  documents: Array<{
    documentType: "passportBioPage" | "resume" | "qualificationsDoc" | "transcripts" | "englishResultDoc" | "skillsAssessmentDoc" | "refusalDocs" | "otherSupportingDocs";
    originalFilename: string;
    mimeType: string;
    fileSizeBytes: number;
    uploadedBy: "client" | "staff";
  }>;
};
type IntakeSubmissionRefinementInput = IntakeSubmissionInput;
