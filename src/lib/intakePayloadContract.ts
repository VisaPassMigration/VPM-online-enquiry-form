import type { IntakeSubmissionInput } from '@/lib/schemas/intakeSubmission';

export type IntakeFormPayloadSource = {
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  residenceCountry: string;
  address: string;
  email: string;
  phone: string;
  contactMethod: string;
  interestedCountry: string;
  mainGoal: string;
  timeframe: string;
  maritalStatus: string;
  dependants: string;
  migrateWithFamily: string;
  partnerFullName: string;
  partnerNationality: string;
  highestQualification: string;
  fieldOfStudy: string;
  institution: string;
  studyCountry: string;
  completionYear: string;
  currentOccupation: string;
  migrationOccupation: string;
  workExperienceYears: string;
  currentEmployer: string;
  dutiesSummary: string;
  englishTestCompleted: string;
  englishTestType: string;
  englishTestDate: string;
  englishScoreSummary: string;
  previousRefusal: string;
  refusalDetails: string;
  previousCancellation: string;
  overstayRemoval: string;
  criminalHistory: string;
  healthCondition: string;
  cancellationOverstayDetails: string;
  criminalDetails: string;
  healthDetails: string;
  ageBracket: IntakeSubmissionInput['ageBracket'] | 'Not selected';
  englishLevel: IntakeSubmissionInput['englishLevel'] | 'Not selected';
  overseasSkilledEmploymentYears: IntakeSubmissionInput['overseasSkilledEmploymentYears'];
  australianSkilledEmploymentYears: IntakeSubmissionInput['australianSkilledEmploymentYears'];
  highestQualificationLevel: IntakeSubmissionInput['highestQualificationLevel'] | 'Not selected';
  australianStudyRequirementCompleted: IntakeSubmissionInput['australianStudyRequirementCompleted'];
  regionalStudyCompleted: IntakeSubmissionInput['regionalStudyCompleted'];
  specialistEducationalQualification: IntakeSubmissionInput['specialistEducationalQualification'];
  professionalYearCompleted: IntakeSubmissionInput['professionalYearCompleted'];
  naatiCredential: IntakeSubmissionInput['naatiCredential'];
  partnerPointsCategory: IntakeSubmissionInput['partnerPointsCategory'];
  nominationType: IntakeSubmissionInput['nominationType'];
};

const toYesNoUnknown = (value: boolean): 'yes' | 'no' | 'unknown' => (value ? 'yes' : 'no');
const selectedOrUndefined = <T extends string>(value: T | 'Not selected' | undefined): T | undefined => (value && value !== 'Not selected' ? value as T : undefined);
const toEnglishOverallBand = (summary: string): number | undefined => {
  const match = summary.match(/(\d(?:\.\d)?)/);
  if (!match) return undefined;
  const band = Number(match[1]);
  return Number.isFinite(band) ? band : undefined;
};

const splitName = (fullName: string) => {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  const firstName = parts.shift() ?? '';
  const lastName = parts.join(' ') || '-';
  return { firstName, lastName };
};

export function buildCanonicalIntakePayload(formData: IntakeFormPayloadSource, preliminaryPoints: number, documents: IntakeSubmissionInput['documents']): IntakeSubmissionInput {
  const { firstName, lastName } = splitName(formData.fullName);
  const hasPartner = ['Married', 'De facto'].includes(formData.maritalStatus) || formData.migrateWithFamily === 'Yes';
  const riskDetails = [formData.refusalDetails, formData.cancellationOverstayDetails, formData.criminalDetails, formData.healthDetails].filter(Boolean).join(' | ') || undefined;

  return {
    firstName,
    lastName,
    email: formData.email,
    phone: formData.phone,
    nationality: formData.nationality,
    countryOfResidence: formData.residenceCountry,
    dateOfBirth: formData.dateOfBirth,
    address: formData.address,
    contactMethod: formData.contactMethod,
    interestedCountry: formData.interestedCountry,
    mainGoal: formData.mainGoal,
    timeframe: formData.timeframe,
    maritalStatus: formData.maritalStatus,
    dependants: formData.dependants,
    migrateWithFamily: formData.migrateWithFamily,
    partnerNationality: hasPartner ? formData.partnerNationality : undefined,
    highestQualification: formData.highestQualification,
    fieldOfStudy: formData.fieldOfStudy,
    institution: formData.institution,
    studyCountry: formData.studyCountry,
    completionYear: formData.completionYear,
    currentOccupation: formData.currentOccupation,
    migrationOccupation: formData.migrationOccupation,
    workExperienceYears: formData.workExperienceYears,
    currentEmployer: formData.currentEmployer,
    dutiesSummary: formData.dutiesSummary,
    englishTestTaken: formData.englishTestCompleted === 'Yes',
    englishTestType: formData.englishTestType || undefined,
    englishOverallBand: toEnglishOverallBand(formData.englishScoreSummary),
    englishScoreSummary: formData.englishScoreSummary || undefined,
    englishTestDate: formData.englishTestDate || undefined,
    hasPartner,
    partnerName: hasPartner ? formData.partnerFullName : undefined,
    partnerEnglishCompetency: hasPartner ? toYesNoUnknown(formData.partnerPointsCategory === 'Partner has competent English only' || formData.partnerPointsCategory === 'Partner has skills + competent English') : undefined,
    partnerSkillsAssessment: hasPartner ? toYesNoUnknown(formData.partnerPointsCategory === 'Partner has skills + competent English') : undefined,
    previousVisaRefusal: formData.previousRefusal === 'Yes',
    previousCancellation: formData.previousCancellation === 'Yes',
    overstayRemoval: formData.overstayRemoval === 'Yes',
    cancellationOverstayOrRemoval: formData.previousCancellation === 'Yes' || formData.overstayRemoval === 'Yes',
    criminalHistory: formData.criminalHistory === 'Yes',
    healthCondition: formData.healthCondition === 'Yes',
    refusalDetails: formData.refusalDetails || undefined,
    cancellationOverstayDetails: formData.cancellationOverstayDetails || undefined,
    criminalDetails: formData.criminalDetails || undefined,
    healthDetails: formData.healthDetails || undefined,
    structuredRiskDetails: {
      refusalDetails: formData.refusalDetails || undefined,
      cancellationOverstayDetails: formData.cancellationOverstayDetails || undefined,
      criminalDetails: formData.criminalDetails || undefined,
      healthDetails: formData.healthDetails || undefined,
    },
    riskDetails,
    ageBracket: selectedOrUndefined<NonNullable<IntakeSubmissionInput['ageBracket']>>(formData.ageBracket),
    englishLevel: selectedOrUndefined<NonNullable<IntakeSubmissionInput['englishLevel']>>(formData.englishLevel),
    overseasSkilledEmploymentYears: formData.overseasSkilledEmploymentYears,
    australianSkilledEmploymentYears: formData.australianSkilledEmploymentYears,
    highestQualificationLevel: selectedOrUndefined<NonNullable<IntakeSubmissionInput['highestQualificationLevel']>>(formData.highestQualificationLevel),
    australianStudyRequirementCompleted: formData.australianStudyRequirementCompleted,
    regionalStudyCompleted: formData.regionalStudyCompleted,
    specialistEducationalQualification: formData.specialistEducationalQualification,
    professionalYearCompleted: formData.professionalYearCompleted,
    naatiCredential: formData.naatiCredential,
    partnerPointsCategory: formData.partnerPointsCategory,
    nominationType: formData.nominationType,
    preliminaryPoints,
    documents,
  };
}
