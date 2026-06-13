import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUniqueOrThrowMock, updateMock, recordAuditEventMock, findUniqueMock } = vi.hoisted(() => ({
  findUniqueOrThrowMock: vi.fn(),
  updateMock: vi.fn(),
  findUniqueMock: vi.fn(),
  recordAuditEventMock: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    intakeSubmission: {
      findUniqueOrThrow: findUniqueOrThrowMock,
      update: updateMock,
      findUnique: findUniqueMock,
    },
  },
}));

vi.mock('../audit', () => ({
  recordAuditEvent: recordAuditEventMock,
}));

import { changeLeadRating, computeSuggestedLeadRating, confirmLeadRating, suggestLeadRating } from '../leadRatings';

const actor = {
  actorId: 'actor-1',
  actorName: 'Staff One',
  actorRole: 'senior_staff' as const,
  actorStaffUserId: 'staff-1',
  actorRoles: ['senior_staff'] as const,
};

describe('computeSuggestedLeadRating', () => {
  it('severe unresolved risk suggests escalate', () => {
    expect(
      computeSuggestedLeadRating({ unresolvedSevereRiskCount: 1, preliminaryPoints: 90, missingEvidenceCount: 0, englishKnown: true, claritySignals: 3 }).rating,
    ).toBe('escalate');
  });

  it('low/no risk with strong points can suggest hot', () => {
    expect(
      computeSuggestedLeadRating({ unresolvedSevereRiskCount: 0, preliminaryPoints: 85, missingEvidenceCount: 0, englishKnown: true, claritySignals: 3 }).rating,
    ).toBe('hot');
  });

  it('incomplete evidence can suggest warm or cold', () => {
    expect(
      computeSuggestedLeadRating({ unresolvedSevereRiskCount: 0, preliminaryPoints: 70, missingEvidenceCount: 1, englishKnown: true, claritySignals: 2 }).rating,
    ).toBe('warm');

    expect(
      computeSuggestedLeadRating({ unresolvedSevereRiskCount: 0, preliminaryPoints: 55, missingEvidenceCount: 4, englishKnown: false, claritySignals: 0 }).rating,
    ).toBe('cold');
  });
});

describe('lead rating services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockResolvedValue({ id: 'sub-1' });
    recordAuditEventMock.mockResolvedValue({ id: 'audit-1' });
  });

  it('confirm rating requires permission-ready actor context', async () => {
    findUniqueOrThrowMock.mockResolvedValue({ id: 'sub-1', leadRating: 'warm' });
    await expect(
      confirmLeadRating({ submissionId: 'sub-1', actor: { ...actor, actorRoles: ['read_only_reviewer'] }, rating: 'hot', reason: 'manual check complete' }),
    ).rejects.toThrow('Missing permission: confirm_lead_rating.');
  });

  it('change rating requires reason', async () => {
    await expect(
      changeLeadRating({ submissionId: 'sub-1', actor, rating: 'cold', reason: '   ' }),
    ).rejects.toThrow('Reason is required when changing confirmed lead rating.');
  });

  it('audit event written for suggest/confirm/change', async () => {
    findUniqueOrThrowMock
      .mockResolvedValueOnce({
        id: 'sub-1',
        payload: { englishTestType: 'IELTS', occupation: 'Engineer', workExperienceYears: 5, highestQualification: 'bachelor' },
        riskFlags: [],
        pointsSnapshots: [{ totalPoints: 85 }],
        documents: [],
        leadRatingSuggested: null,
      })
      .mockResolvedValueOnce({ id: 'sub-1', leadRating: 'warm' })
      .mockResolvedValueOnce({ id: 'sub-1', leadRating: 'hot' });

    await suggestLeadRating({ submissionId: 'sub-1', actor });
    await confirmLeadRating({ submissionId: 'sub-1', actor, rating: 'hot', reason: 'confirmed' });
    await changeLeadRating({ submissionId: 'sub-1', actor, rating: 'warm', reason: 'new evidence' });

    expect(recordAuditEventMock).toHaveBeenCalledTimes(3);
    for (const [arg] of recordAuditEventMock.mock.calls) {
      expect(arg.relatedEntityType).toBe('intake_submission');
      expect(arg.metadata).toEqual({ internalOnly: true, triageClassification: true });
    }
  });

  it('stores lead rating audit from/to values as rating objects and preserves actor metadata', async () => {
    findUniqueOrThrowMock.mockResolvedValueOnce({ id: 'sub-1', leadRating: 'warm' });

    await changeLeadRating({ submissionId: 'sub-1', actor, rating: 'hot', reason: 'new evidence' });

    expect(recordAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'lead_rating_changed',
      actorName: 'Staff One',
      actorRole: 'senior_staff',
      actorStaffUserId: 'staff-1',
      fromValue: { rating: 'warm' },
      toValue: { rating: 'hot' },
      internalNote: 'new evidence',
    }));
  });

  it('does not create a misleading changed event when submitted rating already matches current rating', async () => {
    findUniqueOrThrowMock.mockResolvedValueOnce({ id: 'sub-1', leadRating: 'hot', leadRatingReason: 'existing' });

    const result = await changeLeadRating({ submissionId: 'sub-1', actor, rating: 'hot', reason: 'second click' });

    expect(result).toEqual(expect.objectContaining({ leadRating: 'hot', leadRatingNoChange: true }));
    expect(updateMock).not.toHaveBeenCalled();
    expect(recordAuditEventMock).not.toHaveBeenCalled();
  });

  it('no client communication is sent', async () => {
    findUniqueOrThrowMock.mockResolvedValue({
      id: 'sub-1',
      payload: {},
      riskFlags: [],
      pointsSnapshots: [{ totalPoints: 60 }],
      documents: [],
      leadRatingSuggested: null,
    });

    await suggestLeadRating({ submissionId: 'sub-1', actor });
    expect(findUniqueMock).not.toHaveBeenCalled();
  });
});
