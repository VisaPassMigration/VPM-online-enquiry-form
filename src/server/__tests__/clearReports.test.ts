import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findSubmissionMock: vi.fn(),
  findDatasetMock: vi.fn(),
  findLegalReferencesMock: vi.fn(),
  createClearReportMock: vi.fn(),
  updateClearReportMock: vi.fn(),
  findClearReportMock: vi.fn(),
  recordAuditEventMock: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    intakeSubmission: { findUniqueOrThrow: mocks.findSubmissionMock },
    migrationReferenceDataset: { findFirst: mocks.findDatasetMock },
    legalReference: { findMany: mocks.findLegalReferencesMock },
    clearReport: { create: mocks.createClearReportMock, update: mocks.updateClearReportMock, findUniqueOrThrow: mocks.findClearReportMock },
  },
}));

vi.mock('../audit', () => ({ recordAuditEvent: mocks.recordAuditEventMock }));

import { approveClearReportForConsultation, completeAustraliaClearReview, generateClearReportDraft, markClearReportPrepared, overrideApproveClearReport, requestAustraliaClearReview, updateClearReportNotes } from '../clearReports';

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
    mocks.findLegalReferencesMock.mockResolvedValue([
      { id: 'lr-1', topic: 'refusal_history', referenceType: 'act_section', sectionOrSchedule: 's57', sourceUrl: 'https://example.gov/refusal', legendComReference: 'LEG-REF-1', sourceDate: new Date('2026-02-01T00:00:00Z'), approvedAt: new Date('2026-03-01T00:00:00Z'), summary: 'Refusal context', operationalNotes: 'ops', riskTriggerNotes: 'risk trigger' },
      { id: 'lr-2', topic: 'character', referenceType: 'policy_reference', sectionOrSchedule: 'PIC 4001', sourceUrl: 'https://example.gov/character', legendComReference: null, sourceDate: new Date('2026-02-05T00:00:00Z'), approvedAt: new Date('2026-03-02T00:00:00Z'), summary: 'Character context', operationalNotes: null, riskTriggerNotes: null },
      { id: 'lr-3', topic: 'gsm_points', referenceType: 'internal_guidance', sectionOrSchedule: 'GSM policy', sourceUrl: 'https://example.gov/gsm', legendComReference: null, sourceDate: null, approvedAt: new Date('2026-03-03T00:00:00Z'), summary: 'Points context', operationalNotes: null, riskTriggerNotes: null },
    ]);
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


  it('matched legal references expose strict metadata schema', async () => {
    mocks.findSubmissionMock.mockResolvedValue(submissionFixture({
      payload: { refusalHistory: true, characterDisclosure: true },
      riskFlags: [{ riskCode: 'refusal_history_check', severity: 'medium', resolutionStatus: 'open', clientSafeDisclosure: 'prior refusal', resolutionSummaryInternal: 'character and refusal' }],
    }));
    await generateClearReportDraft({ submissionId: 'sub-1', actor });
    const payload = mocks.createClearReportMock.mock.calls[0][0].data.generatedSnapshotJson as Record<string, any>;
    for (const reference of payload.legalReferenceGuidance.matchedReferences) {
      for (const key of ['legalReferenceId','topic','referenceType','sectionOrSchedule','sourceUrl','legendComReference','sourceDate','approvedAt','summary','operationalNotes','riskTriggerNotes']) {
        expect(reference).toHaveProperty(key);
      }
    }
  });

  it('topic matching: refusal_history positive and negative', async () => {
    mocks.findSubmissionMock.mockResolvedValue(submissionFixture({ payload: { refusalHistory: true }, riskFlags: [] }));
    await generateClearReportDraft({ submissionId: 'sub-1', actor });
    let payload = mocks.createClearReportMock.mock.calls.at(-1)[0].data.generatedSnapshotJson as Record<string, any>;
    expect(payload.legalReferenceGuidance.matchedTopics).toContain('refusal_history');

    mocks.findSubmissionMock.mockResolvedValue(submissionFixture({ payload: { refusalHistory: false, notes: 'clean history' }, riskFlags: [] }));
    await generateClearReportDraft({ submissionId: 'sub-1', actor });
    payload = mocks.createClearReportMock.mock.calls.at(-1)[0].data.generatedSnapshotJson as Record<string, any>;
    expect(payload.legalReferenceGuidance.matchedTopics).not.toContain('refusal_history');
  });

  it('topic matching: cancellation_history, character, health, section_48_bar, section_116_cancellation, skills_assessment, and gsm_points behavior', async () => {
    mocks.findSubmissionMock.mockResolvedValue(submissionFixture({
      payload: {
        cancellationHistory: true,
        characterDisclosure: true,
        healthDeclaration: true,
        section48: 'possible',
        section116: 'possible',
        skillsAssessmentStatus: 'required',
      },
      riskFlags: [],
    }));
    await generateClearReportDraft({ submissionId: 'sub-1', actor });
    let payload = mocks.createClearReportMock.mock.calls.at(-1)[0].data.generatedSnapshotJson as Record<string, any>;
    for (const topic of ['cancellation_history','character','health','section_48_bar','section_116_cancellation','skills_assessment','gsm_points']) {
      expect(payload.legalReferenceGuidance.matchedTopics).toContain(topic);
    }

    mocks.findSubmissionMock.mockResolvedValue(submissionFixture({
      payload: {
        cancellationHistory: false,
        characterDisclosure: false,
        healthDeclaration: false,
        section48: 'none',
        section116: 'none',
        skillsAssessmentStatus: 'not_required',
      },
      riskFlags: [],
    }));
    await generateClearReportDraft({ submissionId: 'sub-1', actor });
    payload = mocks.createClearReportMock.mock.calls.at(-1)[0].data.generatedSnapshotJson as Record<string, any>;
    for (const topic of ['cancellation_history','character','health','section_48_bar','section_116_cancellation','skills_assessment']) {
      expect(payload.legalReferenceGuidance.matchedTopics).not.toContain(topic);
    }
    expect(payload.legalReferenceGuidance.matchedTopics).toContain('gsm_points');
  });

  it('includes approved legal references matched by risk context with safe language and metadata', async () => {
    mocks.findSubmissionMock.mockResolvedValue(submissionFixture({
      payload: { refusalHistory: true, characterDisclosure: true, section48: 'possible' },
      riskFlags: [{ riskCode: 'refusal_history_check', severity: 'medium', resolutionStatus: 'open', clientSafeDisclosure: 'prior refusal', resolutionSummaryInternal: 'character and refusal' }],
    }));
    await generateClearReportDraft({ submissionId: 'sub-1', actor });
    const payload = mocks.createClearReportMock.mock.calls[0][0].data.generatedSnapshotJson as Record<string, any>;
    expect(payload.legalReferenceGuidance.internalOnly).toBe(true);
    expect(payload.legalReferenceGuidance.disclaimer).toContain('does not constitute legal advice');
    expect(payload.legalReferenceGuidance.matchedTopics).toContain('refusal_history');
    expect(payload.legalReferenceGuidance.matchedReferences[0]).toEqual(expect.objectContaining({
      legalReferenceId: expect.any(String),
      topic: expect.any(String),
      referenceType: expect.any(String),
      sectionOrSchedule: expect.any(String),
      sourceUrl: expect.any(String),
      summary: expect.any(String),
      internalGuidanceText: expect.stringContaining('internal guidance only'),
    }));
  });
});


describe('clear approval gating', () => {
  beforeEach(() => {
    mocks.findClearReportMock.mockResolvedValue({ id: 'cr-1', submissionId: 'sub-1', status: 'prepared', australiaReviewedAt: null, generatedSnapshotJson: { safe: true }, submission: { leadRating: 'hot', riskFlags: [] } });
    mocks.updateClearReportMock.mockImplementation(async ({ data }) => ({ id: 'cr-1', submissionId: 'sub-1', ...data }));
    mocks.findDatasetMock.mockResolvedValue({ status: 'approved', approvedAt: new Date(), updatedAt: new Date() });
  });

  it('Kenya senior can approve standard hot report', async () => {
    const result = await approveClearReportForConsultation({ clearReportId: 'cr-1', actor, approvalNote: 'ready for internal consultation' });
    expect(result.approved).toBe(true);
  });

  it('Kenya intake staff can prepare but cannot approve', async () => {
    const intakeActor = { ...actor, actorRole: 'kenya_intake_staff' as const, actorRoles: ['kenya_intake_staff'] as const };
    await expect(markClearReportPrepared({ clearReportId: 'cr-1', actor: intakeActor, note: 'prepared' })).resolves.toBeTruthy();
    await expect(approveClearReportForConsultation({ clearReportId: 'cr-1', actor: intakeActor, approvalNote: 'x' })).rejects.toThrow('Missing permission');
  });

  it('escalate rating requires Australia review or boss override', async () => {
    mocks.findClearReportMock.mockResolvedValue({ id: 'cr-1', submissionId: 'sub-1', australiaReviewedAt: null, generatedSnapshotJson: { safe: true }, submission: { leadRating: 'escalate', riskFlags: [] } });
    const blocked = await approveClearReportForConsultation({ clearReportId: 'cr-1', actor, approvalNote: 'try' });
    expect(blocked.approved).toBe(false);
    const boss = { ...actor, actorRole: 'boss_admin' as const, actorRoles: ['boss_admin'] as const };
    await expect(overrideApproveClearReport({ clearReportId: 'cr-1', actor: boss, overrideReason: 'policy exception' })).resolves.toBeTruthy();
  });

  it('unresolved high/critical risk blocks approval', async () => {
    mocks.findClearReportMock.mockResolvedValue({ id: 'cr-1', submissionId: 'sub-1', australiaReviewedAt: null, generatedSnapshotJson: { safe: true }, submission: { leadRating: 'hot', riskFlags: [{ severity: 'critical' }] } });
    const blocked = await approveClearReportForConsultation({ clearReportId: 'cr-1', actor, approvalNote: 'try' });
    expect(blocked.approved).toBe(false);
  });

  it('stale/unapproved/no reference dataset blocks approval', async () => {
    mocks.findDatasetMock.mockResolvedValue({ status: 'stale', approvedAt: null, updatedAt: new Date() });
    const blocked = await approveClearReportForConsultation({ clearReportId: 'cr-1', actor, approvalNote: 'try' });
    expect(blocked.approved).toBe(false);
  });

  it('unsafe wording blocks approval', async () => {
    mocks.findClearReportMock.mockResolvedValue({ id: 'cr-1', submissionId: 'sub-1', australiaReviewedAt: null, generatedSnapshotJson: { txt: 'guaranteed approval' }, submission: { leadRating: 'hot', riskFlags: [] } });
    const blocked = await approveClearReportForConsultation({ clearReportId: 'cr-1', actor, approvalNote: 'try' });
    expect(blocked.approved).toBe(false);
  });

  it('Australia review request/completion writes audit', async () => {
    await requestAustraliaClearReview({ clearReportId: 'cr-1', actor, reason: 'escalate path' });
    const ausActor = { ...actor, actorRole: 'australia_migration_team' as const, actorRoles: ['australia_migration_team'] as const };
    await completeAustraliaClearReview({ clearReportId: 'cr-1', actor: ausActor, reviewNotes: 'completed' });
    expect(mocks.recordAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'clear_report_australia_review_requested' }));
    expect(mocks.recordAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'clear_report_australia_review_completed' }));
  });

  it('boss override approves with mandatory reason', async () => {
    const boss = { ...actor, actorRole: 'boss_admin' as const, actorRoles: ['boss_admin'] as const };
    await expect(overrideApproveClearReport({ clearReportId: 'cr-1', actor: boss, overrideReason: '' })).rejects.toThrow('Override reason is required');
    await expect(overrideApproveClearReport({ clearReportId: 'cr-1', actor: boss, overrideReason: 'required reason' })).resolves.toBeTruthy();
  });
});

describe('updateClearReportNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findClearReportMock.mockResolvedValue({ id: 'cr-1', submissionId: 'sub-1', staffNotes: 'old staff', clientFacingNotes: 'old safe note' });
    mocks.updateClearReportMock.mockImplementation(async ({ data }) => ({ id: 'cr-1', submissionId: 'sub-1', ...data }));
  });

  it('updates staffNotes', async () => {
    await updateClearReportNotes({ clearReportId: 'cr-1', actor, staffNotes: 'new staff note', reason: 'internal update' });
    expect(mocks.updateClearReportMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ staffNotes: 'new staff note' }) }));
  });

  it('updates clientFacingNotes', async () => {
    await updateClearReportNotes({ clearReportId: 'cr-1', actor, clientFacingNotes: 'preliminary pathway only', reason: 'internal update' });
    expect(mocks.updateClearReportMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ clientFacingNotes: 'preliminary pathway only' }) }));
  });

  it('blocks prohibited wording in clientFacingNotes', async () => {
    await expect(updateClearReportNotes({ clearReportId: 'cr-1', actor, clientFacingNotes: 'You are approved', reason: 'internal update' })).rejects.toThrow('Prohibited wording');
  });

  it('blocks missing internal reason', async () => {
    await expect(updateClearReportNotes({ clearReportId: 'cr-1', actor, staffNotes: 'x', reason: '' })).rejects.toThrow('Internal note/reason is required');
  });

  it('writes clear_report_updated audit with from/to values', async () => {
    await updateClearReportNotes({ clearReportId: 'cr-1', actor, staffNotes: 'new staff', clientFacingNotes: 'safe note', reason: 'audit trace' });
    expect(mocks.recordAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'clear_report_updated',
      fromValue: { staffNotes: 'old staff', clientFacingNotes: 'old safe note' },
      toValue: { staffNotes: 'new staff', clientFacingNotes: 'safe note' },
    }));
  });
});
