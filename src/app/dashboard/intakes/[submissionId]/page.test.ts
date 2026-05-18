import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '@/server/auth/permissions';

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
  createClientCommunicationDraftMock: vi.fn(),
  releaseRequestMoreInformationCommunicationMock: vi.fn(),
  releaseConsultationInvitationCommunicationMock: vi.fn(),
}));

vi.mock('@/server/auth/requireStaffSession', () => ({ requireStaffSession: mocks.requireStaffSessionMock }));
vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermissionMock }));
vi.mock('@/server/db', () => ({ db: { $transaction: mocks.transactionMock } }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePathMock }));
vi.mock('@/server/clientCommunications', () => ({
  CLIENT_COMMUNICATION_TEMPLATES: {
    request_more_information: { subject: 'Request', bodyText: 'Body A' },
    consultation_invitation: { subject: 'Invite', bodyText: 'Body B' },
    not_progressing_hold: { subject: 'Hold', bodyText: 'Body C' },
  },
  createClientCommunicationDraft: mocks.createClientCommunicationDraftMock,
  releaseRequestMoreInformationCommunication: mocks.releaseRequestMoreInformationCommunicationMock,
  releaseConsultationInvitationCommunication: mocks.releaseConsultationInvitationCommunicationMock,
}));

import {
  runClientCommunicationAction,
  runInternalReviewAction,
  runReleaseConsultationInvitationAction,
  runReleaseRequestMoreInformationAction,
} from './page';

describe('intake dashboard actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffSessionMock.mockResolvedValue({
      user: { staffUserId: 'staff-1', name: 'Jane Reviewer', roles: ['senior_staff'], email: 'jane@example.com' },
    });
    mocks.requirePermissionMock.mockResolvedValue(undefined);
    mocks.createClientCommunicationDraftMock.mockResolvedValue({ id: 'comm-1' });
    mocks.releaseRequestMoreInformationCommunicationMock.mockResolvedValue({ id: 'comm-1' });
    mocks.releaseConsultationInvitationCommunicationMock.mockResolvedValue({ id: 'comm-2' });

    mocks.findUniqueMock.mockResolvedValue({
      id: 'sub-1', status: 'submitted',
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

  it('prepare communication uses session-derived actor', async () => {
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('communicationType', 'request_more_information');
    formData.set('internalReason', 'need more docs');
    formData.set('staffActor', 'placeholder-should-not-be-used');

    await runClientCommunicationAction(formData);

    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.PREPARE_CLIENT_COMMUNICATION);
    expect(mocks.createClientCommunicationDraftMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'staff-1', actorRole: 'senior_staff' }));
  });

  it('release request-more-info uses session-derived actor', async () => {
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('communicationId', 'comm-1');
    formData.set('internalReason', 'approved by reviewer');
    formData.set('staffActor', 'placeholder-should-not-be-used');

    await runReleaseRequestMoreInformationAction(formData);

    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.RELEASE_REQUEST_MORE_INFO);
    expect(mocks.releaseRequestMoreInformationCommunicationMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'staff-1', actorRole: 'senior_staff' }));
  });

  it('release consultation invite uses session-derived actor', async () => {
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('communicationId', 'comm-2');
    formData.set('internalReason', 'consultation-ready checklist complete');

    await runReleaseConsultationInvitationAction(formData);

    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.RELEASE_CONSULTATION_INVITE);
    expect(mocks.releaseConsultationInvitationCommunicationMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'staff-1', actorRole: 'senior_staff' }));
  });

  it('read_only_reviewer cannot prepare communication', async () => {
    mocks.requirePermissionMock.mockRejectedValueOnce(new Error('notFound'));
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('communicationType', 'request_more_information');
    formData.set('internalReason', 'reason');

    await expect(runClientCommunicationAction(formData)).rejects.toThrow('notFound');
  });

  it('read_only_reviewer cannot release communication', async () => {
    mocks.requirePermissionMock.mockRejectedValueOnce(new Error('notFound'));
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('communicationId', 'comm-1');
    formData.set('internalReason', 'reason');

    await expect(runReleaseRequestMoreInformationAction(formData)).rejects.toThrow('notFound');
  });

  it('missing session blocks communication action', async () => {
    mocks.requireStaffSessionMock.mockRejectedValueOnce(new Error('redirect'));
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('communicationType', 'request_more_information');
    formData.set('internalReason', 'reason');

    await expect(runClientCommunicationAction(formData)).rejects.toThrow('redirect');
  });

  it('uses actor identity from authenticated session and stamps audit actor fields', async () => {
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('action', 'add_internal_note');
    formData.set('internalNote', 'Internal check');

    await runInternalReviewAction(formData);

    const auditData = mocks.createAuditEventMock.mock.calls.at(-1)?.[0]?.data;
    expect(auditData.actorId).toBe('staff-1');
    expect(auditData.actorName).toBe('Jane Reviewer');
    expect(auditData.actorRole).toBe('senior_staff');
  });
});
