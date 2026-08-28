import { describe, expect, it } from 'vitest';

import { mapToAuditEventCreateInput, mapToIntakeSubmissionCreateInput, mapToIntakeValidationPayload, mapToPointsSnapshotCreateInput, mapToRiskPayload } from '../intakeMapper';

const baseClientPayload = {
  firstName: 'Ava',
  lastName: 'Nguyen',
  email: 'ava@example.com',
  phone: '0400000000',
  nationality: 'Australian',
  countryOfResidence: 'Australia',
  englishTestTaken: true,
  englishTestType: 'IELTS',
  englishOverallBand: 8,
  englishTestDate: '2025-08-12',
  hasPartner: true,
  partnerName: 'Pat Nguyen',
  partnerEnglishCompetency: 'yes' as const,
  partnerSkillsAssessment: 'unknown' as const,
  previousVisaRefusal: true,
  cancellationOverstayOrRemoval: false,
  criminalHistory: false,
  healthCondition: false,
  riskDetails: 'Refusal in 2018 due to missing document.',
  preliminaryPoints: 75,
  documents: [],
};

describe('intakeMapper', () => {
  it('maps client payload into validation payload shape', () => {
    const mapped = mapToIntakeValidationPayload(baseClientPayload);
    expect(mapped.fullName).toBe('Ava Nguyen');
    expect(mapped.englishTestCompleted).toBe('Yes');
    expect(mapped.previousRefusal).toBe('Yes');
    expect(mapped.partnerFullName).toBe('Pat Nguyen');
  });

  it('maps client payload into risk payload shape', () => {
    const mapped = mapToRiskPayload(baseClientPayload);
    expect(mapped.previousRefusal).toBe('Yes');
    expect(mapped.previousCancellation).toBe('No');
    expect(mapped.overstayRemoval).toBe('No');
    expect(mapped.preliminaryPoints).toBe(75);
  });

  it('maps points snapshot output into Prisma create shape', () => {
    const mapped = mapToPointsSnapshotCreateInput('sub-1', {
      calculatorVersion: 'v2',
      inputPayload: { ageBracket: '25-32' } as never,
      pointsBreakdown: { age: 30 },
      estimatedTotal: 70,
      estimatedTotalPoints: 72,
      potentialRange: '70-80',
      missingItems: ['English test evidence'],
      generatedBy: 'system',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(mapped.totalPoints).toBe(72);
    expect(mapped.pointsBreakdown).toEqual({ age: 30 });
    expect(mapped.inputPayload).toEqual({ ageBracket: '25-32' });
    expect(mapped.generatedBy).toBe('system');
    expect(mapped.generatedAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(mapped.missingItems).toEqual(['English test evidence']);
  });

  it('maps an empty documents array into a create shape with no nested document writes', () => {
    const mapped = mapToIntakeSubmissionCreateInput(baseClientPayload);
    expect(mapped.documents).toBeUndefined();
    expect(mapped.payload).toEqual(baseClientPayload);
  });

  it('maps uploaded document metadata into nested SubmissionDocument create input', () => {
    const mapped = mapToIntakeSubmissionCreateInput({
      ...baseClientPayload,
      documents: [
        {
          documentType: 'passportBioPage',
          originalFilename: 'passport.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 12345,
          uploadedBy: 'client',
          storageKey: 'intake-documents/abc123-passport.pdf',
        },
      ],
    });

    expect(mapped.documents).toEqual({
      create: [{
        documentType: 'passportBioPage',
        originalFilename: 'passport.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 12345,
        uploadedBy: 'client',
        storageKey: 'intake-documents/abc123-passport.pdf',
      }],
    });
  });

  it('maps internal audit event output into Prisma create shape with enum-safe conversion', () => {
    const mapped = mapToAuditEventCreateInput({
      eventType: 'status_transition_requested',
      actorId: 'staff-1',
      actorRole: 'staff',
      submissionId: 'sub-1',
      metadata: { from: 'draft', to: 'submitted' },
      eventAt: '2026-01-01T00:00:00.000Z',
    });

    expect(mapped.eventType).toBe('status_transition_executed');
    expect(mapped.metadata).toEqual({ from: 'draft', to: 'submitted' });
    expect(mapped.eventAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });
});
