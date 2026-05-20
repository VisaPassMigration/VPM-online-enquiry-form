import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findSubmissionMock: vi.fn(),
  findDatasetMock: vi.fn(),
  createClearReportMock: vi.fn(),
  recordAuditEventMock: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    intakeSubmission: { findUniqueOrThrow: mocks.findSubmissionMock },
    migrationReferenceDataset: { findFirst: mocks.findDatasetMock },
    clearReport: { create: mocks.createClearReportMock },
  },
}));

vi.mock('../audit', () => ({ recordAuditEvent: mocks.recordAuditEventMock }));

import { generateClearReportDraft } from '../clearReports';

const actor = {
  actorId: 'actor-1',
  actorName: 'Staff One',
  actorRole: 'senior_staff' as const,
  actorStaffUserId: 'staff-1',
  actorRoles: ['senior_staff'] as const,
};

function submissionFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    status: 'submitted',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    submittedAt: new Date('2026-01-02T00:00:00.000Z'),
    payload: { age: 29, occupation: 'Engineer', workExperienceYears: 5, highestQualification: 'Bachelor', englishTestType: 'IELTS', englishScore: '8.0' },
    leadRating: 'hot',
    leadRatingSuggested: 'warm',
    leadRatingReason: 'priority follow-up',
    pointsSnapshots: [{ id: 'ps-1', totalPoints: 75, generatedAt: new Date('2026-01-03T00:00:00.000Z') }],
    riskFlags: [{ riskCode: 'missing_docs', severity: 'medium', resolutionStatus: 'open', clientSafeDisclosure: 'Need more docs', resolutionSummaryInternal: null }],
    documents: [{ id: 'doc-1', documentType: 'passport', verificationStatus: 'uploaded_unchecked', waived: false }],
    consultationBookings: [{ id: 'cb-1', status: 'invited' }],
    ...overrides,
  };
}

describe('generateClearReportDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findSubmissionMock.mockResolvedValue(submissionFixture());
    mocks.findDatasetMock.mockResolvedValue({
      datasetVersion: 'v2026.05',
      reviewedAt: new Date('2026-05-01T00:00:00.000Z'),
      approvedAt: new Date('2026-05-10T00:00:00.000Z'),
      costReferences: [{ category: 'visa', label: 'Visa Application Charge', amount: '4,640', currency: 'AUD' }],
    });
    mocks.createClearReportMock.mockImplementation(async ({ data }) => ({ id: 'cr-1', ...data }));
    mocks.recordAuditEventMock.mockResolvedValue({ id: 'audit-1' });
  });

  it('draft generation creates ClearReport', async () => {
    const result = await generateClearReportDraft({ submissionId: 'sub-1', actor });
    expect(result.blocked).toBe(false);
    expect(mocks.createClearReportMock).toHaveBeenCalledTimes(1);
  });

  it('draft includes client snapshot and latest points snapshot', async () => {
    await generateClearReportDraft({ submissionId: 'sub-1', actor });
    const payload = mocks.createClearReportMock.mock.calls[0][0].data.generatedSnapshotJson as Record<string, any>;
    expect(payload.clientSnapshot.submissionId).toBe('sub-1');
    expect(payload.preliminaryPointsSnapshot.totalPoints).toBe(75);
  });

  it('draft includes risk/document/lead rating and approved reference dataset version', async () => {
    await generateClearReportDraft({ submissionId: 'sub-1', actor });
    const payload = mocks.createClearReportMock.mock.calls[0][0].data.generatedSnapshotJson as Record<string, any>;
    expect(payload.riskDisclosuresReviewNotes).toHaveLength(1);
    expect(payload.documentCompleteness.total).toBe(1);
    expect(payload.leadRating.leadRating).toBe('hot');
    expect(payload.referenceDataset.datasetVersion).toBe('v2026.05');
  });

  it('no approved reference dataset returns warning behavior', async () => {
    mocks.findDatasetMock.mockResolvedValue(null);
    const result = await generateClearReportDraft({ submissionId: 'sub-1', actor });
    expect(result.blocked).toBe(false);
    expect((result as any).warning).toContain('No approved migration reference dataset found');
  });

  it('hot lead can generate', async () => {
    const result = await generateClearReportDraft({ submissionId: 'sub-1', actor });
    expect(result.blocked).toBe(false);
  });

  it('non-hot/non-escalate lead blocks unless override note is provided by allowed role', async () => {
    mocks.findSubmissionMock.mockResolvedValue(submissionFixture({ leadRating: 'warm', leadRatingSuggested: 'cold' }));
    const blocked = await generateClearReportDraft({ submissionId: 'sub-1', actor });
    expect(blocked).toEqual(expect.objectContaining({ blocked: true, requiresOverrideNote: true }));

    const allowed = await generateClearReportDraft({ submissionId: 'sub-1', actor, overrideNote: 'Override approved for preliminary internal draft' });
    expect(allowed.blocked).toBe(false);
  });

  it('audit event is written', async () => {
    await generateClearReportDraft({ submissionId: 'sub-1', actor });
    expect(mocks.recordAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'clear_report_generated',
        relatedEntityType: 'clear_report',
        actorId: 'actor-1',
      }),
    );
  });

  it('prohibited wording is not present', async () => {
    await generateClearReportDraft({ submissionId: 'sub-1', actor });
    const text = JSON.stringify(mocks.createClearReportMock.mock.calls[0][0].data.generatedSnapshotJson).toLowerCase();
    for (const prohibited of ['eligible', 'guaranteed', 'qualified', 'suitable', 'strong candidate']) {
      expect(text).not.toContain(prohibited);
    }
  });

  it('no client communication/email/PDF is triggered', async () => {
    await generateClearReportDraft({ submissionId: 'sub-1', actor });
    expect(mocks.recordAuditEventMock).toHaveBeenCalledTimes(1);
    expect(mocks.recordAuditEventMock.mock.calls[0][0].eventType).toBe('clear_report_generated');
  });
});
