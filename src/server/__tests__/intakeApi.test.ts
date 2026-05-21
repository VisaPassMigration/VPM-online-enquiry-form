import { describe, expect, it } from 'vitest';

import { parseIntakePayload, prepareStatusTransition, toPointsInput } from '@/server/intakeApi';

const validPayload = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '0400000000',
  nationality: 'Australian',
  countryOfResidence: 'Australia',
  dateOfBirth: '1990-01-01',
  address: '100 Example St',
  contactMethod: 'Email',
  interestedCountry: 'Australia',
  mainGoal: 'Skilled migration',
  timeframe: 'Within 6 months',
  currentOccupation: 'Software Engineer',
  highestQualification: 'Bachelor',
  fieldOfStudy: 'IT',
  institution: 'Example Uni',
  studyCountry: 'Australia',
  completionYear: '2014',
  currentEmployer: 'Example Pty Ltd',
  dutiesSummary: 'Engineering duties',
  englishTestTaken: true,
  englishTestType: 'IELTS',
  englishOverallBand: 7,
  englishScoreSummary: 'IELTS 7.0',
  englishTestDate: '2025-01-01',
  hasPartner: false,
  previousVisaRefusal: true,
  cancellationOverstayOrRemoval: false,
  criminalHistory: false,
  healthCondition: false,
  refusalDetails: 'Prior refusal details',
  structuredRiskDetails: { refusalDetails: 'Prior refusal details' },
  riskDetails: 'Prior refusal details',
  documents: [],
};

describe('intakeApi helpers', () => {
  it('parses valid payload', () => {
    const result = parseIntakePayload(validPayload);
    expect(result.payload).toBeTruthy();
    expect(result.errors).toBeUndefined();
    expect(result.payload?.dateOfBirth).toBe('1990-01-01');
    expect(result.payload?.structuredRiskDetails?.refusalDetails).toBe('Prior refusal details');
  });

  it('tracks unknown points factors instead of silently assuming all are known', () => {
    const parsed = parseIntakePayload({ ...validPayload, ageBracket: undefined });
    expect(parsed.payload).toBeTruthy();
    const pointsInput = toPointsInput(parsed.payload!);
    expect(pointsInput.unknownFactors).toContain('ageBracket');
  });

  it('returns validation errors for invalid payload', () => {
    const result = parseIntakePayload({ ...validPayload, email: 'bad' });
    expect(result.payload).toBeUndefined();
    expect(result.errors).toBeTruthy();
  });

  it('throws conflict for invalid transition', () => {
    expect(() => prepareStatusTransition('submitted', 'submitted')).toThrow(/Unsafe transition/);
  });
});
