/**
 * Internal backend-only validation service.
 * Mirrors current /intake front-end requirements for server-side safety.
 * API routes will call this later.
 */

export type YesNo = 'Yes' | 'No';

export type IntakeValidationInput = {
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  residenceCountry: string;
  address: string;
  email: string;
  phone: string;
  contactMethod: 'Email' | 'Phone' | 'WhatsApp' | string;
  mainGoal: string;
  timeframe: string;
  currentOccupation: string;
  maritalStatus: 'Single' | 'Married' | 'De facto' | 'Separated' | 'Divorced' | 'Widowed' | string;
  migrateWithFamily: YesNo;
  partnerFullName: string;
  partnerNationality: string;
  englishTestCompleted: YesNo;
  englishTestType: string;
  englishScoreSummary: string;
  previousRefusal: YesNo;
  refusalDetails: string;
  previousCancellation: YesNo;
  overstayRemoval: YesNo;
  cancellationOverstayDetails: string;
  criminalHistory: YesNo;
  criminalDetails: string;
  healthCondition: YesNo;
  healthDetails: string;
};

const REQUIRED_FIELDS: Array<keyof IntakeValidationInput> = [
  'fullName',
  'dateOfBirth',
  'nationality',
  'residenceCountry',
  'address',
  'email',
  'phone',
  'contactMethod',
  'mainGoal',
  'timeframe',
  'currentOccupation',
];

export function requiresPartnerDetails(data: Pick<IntakeValidationInput, 'maritalStatus' | 'migrateWithFamily'>): boolean {
  return data.maritalStatus === 'Married' || data.maritalStatus === 'De facto' || data.migrateWithFamily === 'Yes';
}

export function validateIntakePayload(data: IntakeValidationInput): Record<string, string> {
  const errors: Record<string, string> = {};

  REQUIRED_FIELDS.forEach((field) => {
    if (!String(data[field] ?? '').trim()) {
      errors[field] = `${field} is required.`;
    }
  });

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Valid email is required.';
  }

  if (data.englishTestCompleted === 'Yes') {
    if (!data.englishTestType.trim()) errors.englishTestType = 'English test type is required when test completed is Yes.';
    if (!data.englishScoreSummary.trim()) errors.englishScoreSummary = 'English score summary is required when test completed is Yes.';
  }

  if (requiresPartnerDetails(data)) {
    if (!data.partnerFullName.trim()) errors.partnerFullName = 'Partner full name is required for partner/family scenarios.';
    if (!data.partnerNationality.trim()) errors.partnerNationality = 'Partner nationality is required for partner/family scenarios.';
  }

  if (data.previousRefusal === 'Yes' && !data.refusalDetails.trim()) {
    errors.refusalDetails = 'Refusal details are required when previous refusal is Yes.';
  }

  if ((data.previousCancellation === 'Yes' || data.overstayRemoval === 'Yes') && !data.cancellationOverstayDetails.trim()) {
    errors.cancellationOverstayDetails = 'Cancellation/overstay details are required when cancellation or overstay/removal is Yes.';
  }

  if (data.criminalHistory === 'Yes' && !data.criminalDetails.trim()) {
    errors.criminalDetails = 'Criminal details are required when criminal history is Yes.';
  }

  if (data.healthCondition === 'Yes' && !data.healthDetails.trim()) {
    errors.healthDetails = 'Health details are required when serious health condition is Yes.';
  }

  return errors;
}

export function isIntakePayloadValid(data: IntakeValidationInput): boolean {
  return Object.keys(validateIntakePayload(data)).length === 0;
}
