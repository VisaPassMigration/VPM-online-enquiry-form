import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffSessionMock: vi.fn(),
  requirePermissionMock: vi.fn(),
  transactionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  findUniqueMock: vi.fn(),
  updateSubmissionMock: vi.fn(),
  upsertReviewStateMock: vi.fn(),
  createStaffReviewMock: vi.fn(),
  createAuditEventMock: vi.fn(),
  updateManyRiskMock: vi.fn(),
}));

vi.mock('@/server/auth/requireStaffSession', () => ({ requireStaffSession: mocks.requireStaffSessionMock }));
vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermissionMock }));
vi.mock('@/server/db', () => ({ db: { $transaction: mocks.transactionMock } }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePathMock }));

import { runInternalReviewAction } from './page';

describe('runInternalReviewAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffSessionMock.mockResolvedValue({
      user: { staffUserId: 'staff-1', name: 'Jane Reviewer', roles: ['senior_staff'], email: 'jane@example.com' },
    });
    mocks.requirePermissionMock.mockResolvedValue(undefined);
    mocks.findUniqueMock.mockResolvedValue({
      id: 'sub-1',
      status: 'submitted',
      currentReviewState: { currentStage: 'intake_triage', lastDecision: 'manual_hold' },
      riskFlags: [],
    });
    mocks.updateSubmissionMock.mockResolvedValue({});
    mocks.upsertReviewStateMock.mockResolvedValue({});
    mocks.createStaffReviewMock.mockResolvedValue({ id: 'review-1' });
    mocks.createAuditEventMock.mockResolvedValue({});
    mocks.updateManyRiskMock.mockResolvedValue({ count: 0 });
    mocks.transactionMock.mockImplementation(async (cb) => cb({
      intakeSubmission: { findUnique: mocks.findUniqueMock, update: mocks.updateSubmissionMock },
      submissionReviewState: { upsert: mocks.upsertReviewStateMock },
      staffReview: { create: mocks.createStaffReviewMock },
      auditEvent: { create: mocks.createAuditEventMock },
      riskFlag: { updateMany: mocks.updateManyRiskMock },
    }));
  });

  it('uses actor identity from authenticated session and stamps audit actor fields', async () => {
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('action', 'add_internal_note');
    formData.set('internalNote', 'Internal check');
    formData.set('staffActor', 'placeholder-should-not-be-used');

    await runInternalReviewAction(formData);

    expect(mocks.requirePermissionMock).toHaveBeenCalled();
    expect(mocks.createStaffReviewMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reviewedBy: 'staff-1' }),
    }));
    const auditData = mocks.createAuditEventMock.mock.calls.at(-1)?.[0]?.data;
    expect(auditData.actorId).toBe('staff-1');
    expect(auditData.actorName).toBe('Jane Reviewer');
    expect(auditData.actorRole).toBe('senior_staff');
    expect(auditData.relatedEntityType).toBe('staff_review');
    expect(auditData.eventSource).toBe('staff_review_action');
  });

  it('blocks missing session', async () => {
    mocks.requireStaffSessionMock.mockRejectedValueOnce(new Error('redirect'));
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('action', 'mark_under_review');
    formData.set('internalNote', 'note');

    await expect(runInternalReviewAction(formData)).rejects.toThrow('redirect');
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it('blocks read_only_reviewer via permission check', async () => {
    mocks.requirePermissionMock.mockRejectedValueOnce(new Error('notFound'));
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('action', 'mark_under_review');
    formData.set('internalNote', 'note');

    await expect(runInternalReviewAction(formData)).rejects.toThrow('notFound');
    expect(mocks.transactionMock).not.toHaveBeenCalled();
  });

  it('keeps workflow outcome unchanged for request_more_information', async () => {
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('action', 'request_more_information');
    formData.set('internalNote', 'Need docs');

    await runInternalReviewAction(formData);

    expect(mocks.updateSubmissionMock).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'awaiting_client_documents' },
    }));
    expect(mocks.upsertReviewStateMock).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ currentStage: 'document_completeness_check', lastDecision: 'needs_more_documents' }),
    }));
  });
});
