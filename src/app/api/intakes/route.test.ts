import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  createMock: vi.fn(),
  recordAuditEventMock: vi.fn(),
  mapPrismaErrorMock: vi.fn(() => ({ message: 'oops', code: 500 })),
  mapInputMock: vi.fn((payload) => payload),
  parsePayloadMock: vi.fn(),
}));

vi.mock('@/server/db', () => ({ db: { $transaction: mocks.transactionMock } }));
vi.mock('@/server/audit', () => ({ recordAuditEvent: mocks.recordAuditEventMock }));
vi.mock('@/server/intakeApi', () => ({
  mapPrismaError: mocks.mapPrismaErrorMock,
  mapToIntakeSubmissionCreateInput: mocks.mapInputMock,
  parseIntakePayload: mocks.parsePayloadMock,
}));

import { POST } from './route';

describe('POST /api/intakes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parsePayloadMock.mockReturnValue({ payload: { firstName: 'A' }, errors: [] });
    mocks.createMock.mockResolvedValue({ id: 'sub-1', status: 'draft' });
    mocks.recordAuditEventMock.mockResolvedValue({ id: 'audit-1' });
    mocks.transactionMock.mockImplementation(async (cb) => cb({ intakeSubmission: { create: mocks.createMock } }));
  });

  it('creates submission and writes audit event in transaction flow', async () => {
    const response = await POST(new Request('http://localhost/api/intakes', { method: 'POST', body: JSON.stringify({}) }));
    expect(response.status).toBe(201);
    expect(mocks.recordAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      tx: expect.any(Object),
      submissionId: 'sub-1',
      eventType: 'submission_created',
      relatedEntityType: 'intake_submission',
      relatedEntityId: 'sub-1',
      eventSource: 'intake_api',
    }));
  });
});
