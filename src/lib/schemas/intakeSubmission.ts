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
  storageKey: z.string().min(1),
});

const baseSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(5),
  nationality: z.string().min(1),
  countryOfResidence: z.string().min(1),

  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  contactMethod: z.string().optional(),
  interestedCountry: z.string().optional(),
  mainGoal: z.string().optional(),
  timeframe: z.string().optional(),
  maritalStatus: z.string().optional(),
  dependants: z.string().optional(),
  migrateWithFamily: z.string().optional(),
  partnerNationality: z.string().optional(),
  highestQualification: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  institution: z.string().optional(),
  studyCountry: z.string().optional(),
  completionYear: z.string().optional(),
  currentOccupation: z.string().optional(),
  migrationOccupation: z.string().optional(),
  workExperienceYears: z.string().optional(),
  currentEmployer: z.string().optional(),
  dutiesSummary: z.string().optional(),
  englishScoreSummary: z.string().optional(),
  previousCancellation: z.boolean().optional(),
  overstayRemoval: z.boolean().optional(),
  refusalDetails: z.string().optional(),
  cancellationOverstayDetails: z.string().optional(),
  criminalDetails: z.string().optional(),
  healthDetails: z.string().optional(),
  ageBracket: z.enum(['18-24', '25-32', '33-39', '40-44', '45+']).optional(),
  englishLevel: z.enum(['Competent', 'Proficient', 'Superior']).optional(),
  overseasSkilledEmploymentYears: z.enum(['0-2', '3-4', '5-7', '8+']).optional(),
  australianSkilledEmploymentYears: z.enum(['0', '1-2', '3-4', '5-7', '8+']).optional(),
  highestQualificationLevel: z.enum(['Doctorate', 'Bachelor/Masters', 'Diploma/Trade', 'No recognised qualification']).optional(),
  australianStudyRequirementCompleted: z.enum(['Yes', 'No']).optional(),
  regionalStudyCompleted: z.enum(['Yes', 'No']).optional(),
  specialistEducationalQualification: z.enum(['Yes', 'No']).optional(),
  professionalYearCompleted: z.enum(['Yes', 'No']).optional(),
  naatiCredential: z.enum(['Yes', 'No']).optional(),
  partnerPointsCategory: z.enum(['Not applicable', 'Single or partner is AU citizen/PR', 'Partner has competent English only', 'Partner has skills + competent English']).optional(),
  nominationType: z.enum(['None', 'State nomination (190)', 'Regional nomination (491)']).optional(),

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
  structuredRiskDetails: z.object({
    refusalDetails: z.string().optional(),
    cancellationOverstayDetails: z.string().optional(),
    criminalDetails: z.string().optional(),
    healthDetails: z.string().optional(),
  }).optional(),
  riskDetails: z.string().optional(),

  preliminaryPoints: z.number().int().nonnegative().max(200).optional(),
  documents: z.array(intakeDocumentMetadataSchema).default([]),
});

export const intakeSubmissionSchema = baseSchema
  .superRefine((data, ctx) => {
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
  dateOfBirth?: string;
  address?: string;
  contactMethod?: string;
  interestedCountry?: string;
  mainGoal?: string;
  timeframe?: string;
  maritalStatus?: string;
  dependants?: string;
  migrateWithFamily?: string;
  partnerNationality?: string;
  highestQualification?: string;
  fieldOfStudy?: string;
  institution?: string;
  studyCountry?: string;
  completionYear?: string;
  currentOccupation?: string;
  migrationOccupation?: string;
  workExperienceYears?: string;
  currentEmployer?: string;
  dutiesSummary?: string;
  englishScoreSummary?: string;
  previousCancellation?: boolean;
  overstayRemoval?: boolean;
  refusalDetails?: string;
  cancellationOverstayDetails?: string;
  criminalDetails?: string;
  healthDetails?: string;
  ageBracket?: "18-24" | "25-32" | "33-39" | "40-44" | "45+";
  englishLevel?: "Competent" | "Proficient" | "Superior";
  overseasSkilledEmploymentYears?: "0-2" | "3-4" | "5-7" | "8+";
  australianSkilledEmploymentYears?: "0" | "1-2" | "3-4" | "5-7" | "8+";
  highestQualificationLevel?: "Doctorate" | "Bachelor/Masters" | "Diploma/Trade" | "No recognised qualification";
  australianStudyRequirementCompleted?: "Yes" | "No";
  regionalStudyCompleted?: "Yes" | "No";
  specialistEducationalQualification?: "Yes" | "No";
  professionalYearCompleted?: "Yes" | "No";
  naatiCredential?: "Yes" | "No";
  partnerPointsCategory?: "Not applicable" | "Single or partner is AU citizen/PR" | "Partner has competent English only" | "Partner has skills + competent English";
  nominationType?: "None" | "State nomination (190)" | "Regional nomination (491)";
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
  structuredRiskDetails?: { refusalDetails?: string; cancellationOverstayDetails?: string; criminalDetails?: string; healthDetails?: string; };
  riskDetails?: string;
  preliminaryPoints?: number;
  documents: Array<{
    documentType: "passportBioPage" | "resume" | "qualificationsDoc" | "transcripts" | "englishResultDoc" | "skillsAssessmentDoc" | "refusalDocs" | "otherSupportingDocs";
    originalFilename: string;
    mimeType: string;
    fileSizeBytes: number;
    uploadedBy: "client" | "staff";
    storageKey: string;
  }>;
};
type IntakeSubmissionRefinementInput = IntakeSubmissionInput;
