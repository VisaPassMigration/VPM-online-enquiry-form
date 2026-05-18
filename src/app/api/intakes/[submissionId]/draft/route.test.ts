import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  recordAuditEventMock: vi.fn(),
  parsePayloadMock: vi.fn(),
  assertDraftStatusMock: vi.fn(),
  mapPrismaErrorMock: vi.fn(() => ({ message: 'oops', code: 500 })),
}));

vi.mock('@/server/db', () => ({ db: { $transaction: mocks.transactionMock } }));
vi.mock('@/server/audit', () => ({ recordAuditEvent: mocks.recordAuditEventMock }));
vi.mock('@/server/intakeApi', () => ({
  assertDraftStatus: mocks.assertDraftStatusMock,
  mapPrismaError: mocks.mapPrismaErrorMock,
  parseIntakePayload: mocks.parsePayloadMock,
}));

import { PATCH } from './route';

describe('PATCH /api/intakes/[submissionId]/draft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parsePayloadMock.mockReturnValue({ payload: { firstName: 'A' }, errors: [] });
    mocks.findUniqueMock.mockResolvedValue({ id: 'sub-1', status: 'draft' });
    mocks.updateMock.mockResolvedValue({ id: 'sub-1', status: 'draft' });
    mocks.recordAuditEventMock.mockResolvedValue({ id: 'audit-1' });
    mocks.transactionMock.mockImplementation(async (cb) => cb({ intakeSubmission: { findUnique: mocks.findUniqueMock, update: mocks.updateMock } }));
  });

  it('updates draft and writes audit event in transaction flow', async () => {
    const response = await PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({}) }), { params: Promise.resolve({ submissionId: 'sub-1' }) });
    expect(response.status).toBe(200);
    expect(mocks.recordAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      tx: expect.any(Object),
      submissionId: 'sub-1',
      eventType: 'submission_updated',
      relatedEntityType: 'intake_submission',
      eventSource: 'intake_api',
    }));
  });
});
