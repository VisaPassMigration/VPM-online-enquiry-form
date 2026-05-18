import { describe, expect, it } from 'vitest';

import { parseIntakePayload, prepareStatusTransition } from '@/server/intakeApi';

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
  mainGoal: 'Skilled migration',
  timeframe: 'Within 6 months',
  currentOccupation: 'Software Engineer',
  englishTestTaken: true,
  englishTestType: 'IELTS',
  englishOverallBand: 7,
  englishTestDate: '2025-01-01',
  hasPartner: false,
  previousVisaRefusal: false,
  cancellationOverstayOrRemoval: false,
  criminalHistory: false,
  healthCondition: false,
  documents: [],
};

describe('intakeApi helpers', () => {
  it('parses valid payload', () => {
    const result = parseIntakePayload(validPayload);
    expect(result.payload).toBeTruthy();
    expect(result.errors).toBeUndefined();
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
