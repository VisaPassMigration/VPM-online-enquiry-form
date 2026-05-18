import { describe, expect, it } from 'vitest';
import { validateIntakePayload, type IntakeValidationInput } from '../intakeValidation';

const basePayload = (): IntakeValidationInput => ({
  fullName: 'Test User', dateOfBirth: '1990-01-01', nationality: 'AU', residenceCountry: 'Australia',
  address: '123 Street', email: 'test@example.com', phone: '123456', contactMethod: 'Email',
  mainGoal: 'Skilled migration', timeframe: '6 months', currentOccupation: 'Engineer',
  maritalStatus: 'Single', migrateWithFamily: 'No', partnerFullName: '', partnerNationality: '',
  englishTestCompleted: 'No', englishTestType: '', englishScoreSummary: '',
  previousRefusal: 'No', refusalDetails: '', previousCancellation: 'No', overstayRemoval: 'No', cancellationOverstayDetails: '',
  criminalHistory: 'No', criminalDetails: '', healthCondition: 'No', healthDetails: '',
});

describe('validateIntakePayload', () => {
  it('valid minimum intake payload passes', () => {
    expect(validateIntakePayload(basePayload())).toEqual({});
  });

  it('missing base required fields fail', () => {
    const payload = basePayload();
    payload.fullName = '  ';
    payload.email = '';
    const errors = validateIntakePayload(payload);
    expect(errors.fullName).toBeDefined();
    expect(errors.email).toBeDefined();
  });

  it('English details are required when englishTestCompleted = Yes', () => {
    const payload = basePayload();
    payload.englishTestCompleted = 'Yes';
    const errors = validateIntakePayload(payload);
    expect(errors.englishTestType).toBeDefined();
    expect(errors.englishScoreSummary).toBeDefined();
  });

  it('partner details are required when married/de facto or migrating family = Yes', () => {
    const marriedPayload = basePayload();
    marriedPayload.maritalStatus = 'Married';
    let errors = validateIntakePayload(marriedPayload);
    expect(errors.partnerFullName).toBeDefined();
    expect(errors.partnerNationality).toBeDefined();

    const familyPayload = basePayload();
    familyPayload.migrateWithFamily = 'Yes';
    errors = validateIntakePayload(familyPayload);
    expect(errors.partnerFullName).toBeDefined();
    expect(errors.partnerNationality).toBeDefined();
  });

  it('refusal details required when previous refusal = Yes', () => {
    const payload = basePayload();
    payload.previousRefusal = 'Yes';
    expect(validateIntakePayload(payload).refusalDetails).toBeDefined();
  });

  it('cancellation/overstay details required when cancellation or overstay/removal = Yes', () => {
    const payload = basePayload();
    payload.previousCancellation = 'Yes';
    expect(validateIntakePayload(payload).cancellationOverstayDetails).toBeDefined();

    payload.previousCancellation = 'No';
    payload.overstayRemoval = 'Yes';
    expect(validateIntakePayload(payload).cancellationOverstayDetails).toBeDefined();
  });

  it('criminal details required when criminal history = Yes', () => {
    const payload = basePayload();
    payload.criminalHistory = 'Yes';
    expect(validateIntakePayload(payload).criminalDetails).toBeDefined();
  });

  it('health details required when serious health condition = Yes', () => {
    const payload = basePayload();
    payload.healthCondition = 'Yes';
    expect(validateIntakePayload(payload).healthDetails).toBeDefined();
  });
});
