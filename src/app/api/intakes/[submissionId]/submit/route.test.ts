import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  createPointsSnapshotMock: vi.fn(),
  riskCreateManyMock: vi.fn(),
  upsertReviewMock: vi.fn(),
  recordAuditEventMock: vi.fn(),
  sendClientIntakeReceivedEmailMock: vi.fn(),
  assertDraftStatusMock: vi.fn(),
  parsePayloadMock: vi.fn(),
  prepareStatusTransitionMock: vi.fn(),
  preparePointsSnapshotMock: vi.fn(),
  toPointsInputMock: vi.fn(),
  computeRiskFlagsMock: vi.fn(),
  mapToRiskPayloadMock: vi.fn(),
  mapToPointsSnapshotCreateInputMock: vi.fn(),
  sendClientConfirmationEmailWithAuditMock: vi.fn(),
  mapPrismaErrorMock: vi.fn(() => ({ message: 'oops', code: 500 })),
}));

vi.mock('@/server/db', () => ({ db: { $transaction: mocks.transactionMock } }));
vi.mock('@/server/audit', () => ({ recordAuditEvent: mocks.recordAuditEventMock }));
vi.mock('@/server/email', () => ({ sendClientIntakeReceivedEmail: mocks.sendClientIntakeReceivedEmailMock }));
vi.mock('@/server/intakeApi', () => ({
  assertDraftStatus: mocks.assertDraftStatusMock,
  computeRiskFlags: mocks.computeRiskFlagsMock,
  mapPrismaError: mocks.mapPrismaErrorMock,
  mapToPointsSnapshotCreateInput: mocks.mapToPointsSnapshotCreateInputMock,
  mapToRiskPayload: mocks.mapToRiskPayloadMock,
  parseIntakePayload: mocks.parsePayloadMock,
  preparePointsSnapshot: mocks.preparePointsSnapshotMock,
  prepareStatusTransition: mocks.prepareStatusTransitionMock,
  sendClientConfirmationEmailWithAudit: mocks.sendClientConfirmationEmailWithAuditMock,
  toPointsInput: mocks.toPointsInputMock,
}));

import { POST } from './route';

describe('POST /api/intakes/[submissionId]/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUniqueMock.mockResolvedValue({ id: 'sub-1', status: 'draft', payload: { email: 'a@b.com', firstName: 'A', lastName: 'B' } });
    mocks.parsePayloadMock.mockReturnValue({ payload: { email: 'a@b.com', firstName: 'A', lastName: 'B' }, errors: [] });
    mocks.prepareStatusTransitionMock.mockReturnValue({ fromStatus: 'draft', toStatus: 'submitted', internalNote: 'note' });
    mocks.preparePointsSnapshotMock.mockReturnValue({ estimatedTotal: 65, potentialRange: { min: 60, max: 70 }, missingItems: [] });
    mocks.computeRiskFlagsMock.mockReturnValue([{ key: 'r1', severity: 'low' }]);
    mocks.updateMock.mockResolvedValue({ id: 'sub-1', status: 'submitted', submittedAt: new Date('2026-01-01T00:00:00.000Z') });
    mocks.sendClientConfirmationEmailWithAuditMock.mockImplementation(async ({ recordAudit }) => { await recordAudit('submission_updated', { source: 'email' }); });
    mocks.recordAuditEventMock.mockResolvedValue({ id: 'audit-1' });
    mocks.transactionMock.mockImplementation(async (cb) => cb({
      intakeSubmission: { findUnique: mocks.findUniqueMock, update: mocks.updateMock },
      pointsSnapshot: { create: mocks.createPointsSnapshotMock },
      riskFlag: { createMany: mocks.riskCreateManyMock },
      submissionReviewState: { upsert: mocks.upsertReviewMock },
    }));
  });

  it('submits intake and records transaction-bound audits plus email-flow audit', async () => {
    const response = await POST(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ submissionId: 'sub-1' }) });
    expect(response.status).toBe(200);
    const calls = mocks.recordAuditEventMock.mock.calls.map((c) => c[0]);
    expect(calls.some((c) => c.tx && c.eventType === 'submission_submitted')).toBe(true);
    expect(calls.some((c) => c.tx && c.eventType === 'status_transition_requested')).toBe(true);
    expect(calls.some((c) => c.tx && c.eventType === 'status_transition_applied')).toBe(true);
    expect(calls.some((c) => c.tx && c.eventType === 'points_snapshot_generated')).toBe(true);
    expect(calls.some((c) => c.tx && c.eventType === 'risk_flags_computed')).toBe(true);
    expect(calls.some((c) => !c.tx && c.eventType === 'submission_updated' && c.eventSource === 'intake_api')).toBe(true);
  });
});
