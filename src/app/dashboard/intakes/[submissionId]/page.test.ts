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
  findDocumentMock: vi.fn(),
  updateDocumentMock: vi.fn(),
  createClientCommunicationDraftMock: vi.fn(),
  releaseRequestMoreInformationCommunicationMock: vi.fn(),
  releaseConsultationInvitationCommunicationMock: vi.fn(),
  createConsultationBookingMock: vi.fn(),
  markConsultationBookedMock: vi.fn(),
  markConsultationCompletedMock: vi.fn(),
  markConsultationNoShowMock: vi.fn(),
  markConsultationCancelledMock: vi.fn(),
  markConsultationRescheduledMock: vi.fn(),
  markCsaIssuedMock: vi.fn(),
  markDepositPaidMock: vi.fn(),
  recordConsultationOutcomeMock: vi.fn(),
}));

vi.mock('@/server/auth/requireStaffSession', () => ({ requireStaffSession: mocks.requireStaffSessionMock }));
vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermissionMock }));
vi.mock('@/server/db', () => ({ db: { $transaction: mocks.transactionMock } }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePathMock }));

vi.mock('@/server/consultationBookings', () => ({
  createConsultationBooking: mocks.createConsultationBookingMock,
  markConsultationBooked: mocks.markConsultationBookedMock,
  markConsultationCompleted: mocks.markConsultationCompletedMock,
  markConsultationNoShow: mocks.markConsultationNoShowMock,
  markConsultationCancelled: mocks.markConsultationCancelledMock,
  markConsultationRescheduled: mocks.markConsultationRescheduledMock,
  markCsaIssued: mocks.markCsaIssuedMock,
  markDepositPaid: mocks.markDepositPaidMock,
  recordConsultationOutcome: mocks.recordConsultationOutcomeMock,
}));

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
  runConsultationBookingAction,
  runDocumentReviewAction,
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
    mocks.findDocumentMock.mockResolvedValue({
      id: 'doc-1',
      submissionId: 'sub-1',
      verificationStatus: 'uploaded_unchecked',
      waived: false,
      documentType: 'passportBioPage',
    });
    mocks.updateDocumentMock.mockResolvedValue({});
    mocks.transactionMock.mockImplementation(async (cb) => cb({
      intakeSubmission: { findUnique: mocks.findUniqueMock, update: mocks.updateSubmissionMock },
      submissionDocument: { findUnique: mocks.findDocumentMock, update: mocks.updateDocumentMock },
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
    expect(mocks.createClientCommunicationDraftMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'staff-1', actorRole: 'senior_staff', actorStaffUserId: 'staff-1' }));
  });

  it('release request-more-info uses session-derived actor', async () => {
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('communicationId', 'comm-1');
    formData.set('internalReason', 'approved by reviewer');
    formData.set('staffActor', 'placeholder-should-not-be-used');

    await runReleaseRequestMoreInformationAction(formData);

    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.RELEASE_REQUEST_MORE_INFO);
    expect(mocks.releaseRequestMoreInformationCommunicationMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'staff-1', actorRole: 'senior_staff', actorStaffUserId: 'staff-1' }));
  });

  it('release consultation invite uses session-derived actor', async () => {
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('communicationId', 'comm-2');
    formData.set('internalReason', 'consultation-ready checklist complete');

    await runReleaseConsultationInvitationAction(formData);

    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.RELEASE_CONSULTATION_INVITE);
    expect(mocks.releaseConsultationInvitationCommunicationMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'staff-1', actorRole: 'senior_staff', actorStaffUserId: 'staff-1' }));
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



  it('create booking uses session-derived actor', async () => {
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('action', 'create_booking');
    formData.set('internalReason', 'note');
    formData.set('clientName', 'Jane');
    formData.set('clientEmail', 'jane@example.com');
    formData.set('staffActor', 'placeholder-should-not-be-used');

    await runConsultationBookingAction(formData);

    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.MANAGE_CONSULTATION_BOOKINGS);
    expect(mocks.createConsultationBookingMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'staff-1', actorName: 'Jane Reviewer', actorRole: 'senior_staff', actorStaffUserId: 'staff-1' }));
  });

  it('mark booked and completed use session-derived actor', async () => {
    const booked = new FormData();
    booked.set('submissionId', 'sub-1'); booked.set('bookingId', 'booking-1'); booked.set('action', 'mark_booked'); booked.set('internalReason', 'note');
    await runConsultationBookingAction(booked);
    expect(mocks.markConsultationBookedMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'staff-1', actorName: 'Jane Reviewer', actorStaffUserId: 'staff-1' }));

    const completed = new FormData();
    completed.set('submissionId', 'sub-1'); completed.set('bookingId', 'booking-1'); completed.set('action', 'mark_completed'); completed.set('internalReason', 'note');
    await runConsultationBookingAction(completed);
    expect(mocks.markConsultationCompletedMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'staff-1', actorName: 'Jane Reviewer', actorStaffUserId: 'staff-1' }));
  });

  it('enforces consultation booking action permissions', async () => {
    const csa = new FormData(); csa.set('submissionId','sub-1'); csa.set('bookingId','booking-1'); csa.set('action','mark_csa_issued'); csa.set('internalReason','note');
    await runConsultationBookingAction(csa);
    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.MARK_CSA_ISSUED);

    const dep = new FormData(); dep.set('submissionId','sub-1'); dep.set('bookingId','booking-1'); dep.set('action','mark_deposit_paid'); dep.set('internalReason','note');
    await runConsultationBookingAction(dep);
    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.MARK_DEPOSIT_PAID);
  });

  it('read_only_reviewer cannot perform booking actions', async () => {
    mocks.requirePermissionMock.mockRejectedValueOnce(new Error('notFound'));
    const fd = new FormData(); fd.set('submissionId','sub-1'); fd.set('action','create_booking'); fd.set('internalReason','note'); fd.set('clientName','Jane'); fd.set('clientEmail','jane@example.com');
    await expect(runConsultationBookingAction(fd)).rejects.toThrow('notFound');
  });

  it('missing session blocks booking action', async () => {
    mocks.requireStaffSessionMock.mockRejectedValueOnce(new Error('redirect'));
    const fd = new FormData(); fd.set('submissionId','sub-1'); fd.set('action','mark_booked'); fd.set('bookingId','booking-1'); fd.set('internalReason','note');
    await expect(runConsultationBookingAction(fd)).rejects.toThrow('redirect');
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
    expect(auditData.actorStaffUserId).toBe('staff-1');
  });

  it('accepted document writes document_accepted audit event', async () => {
    const fd = new FormData();
    fd.set('submissionId', 'sub-1'); fd.set('documentId', 'doc-1'); fd.set('action', 'accept'); fd.set('internalReason', 'all good'); fd.set('isRequired', 'true');
    await runDocumentReviewAction(fd);
    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.REVIEW_SUBMISSION_DOCUMENTS);
    const auditData = mocks.createAuditEventMock.mock.calls.at(-1)?.[0]?.data;
    expect(auditData.eventType).toBe('document_accepted');
    expect(auditData.actorStaffUserId).toBe('staff-1');
  });

  it('rejected document writes document_rejected audit event', async () => {
    const fd = new FormData();
    fd.set('submissionId', 'sub-1'); fd.set('documentId', 'doc-1'); fd.set('action', 'reject'); fd.set('internalReason', 'illegible'); fd.set('isRequired', 'true');
    await runDocumentReviewAction(fd);
    const auditData = mocks.createAuditEventMock.mock.calls.at(-1)?.[0]?.data;
    expect(auditData.eventType).toBe('document_rejected');
  });

  it('needs re-upload writes rejected audit event with requiresReupload metadata', async () => {
    const fd = new FormData();
    fd.set('submissionId', 'sub-1'); fd.set('documentId', 'doc-1'); fd.set('action', 'needs_reupload'); fd.set('internalReason', 'new scan required'); fd.set('isRequired', 'true');
    await runDocumentReviewAction(fd);
    const auditData = mocks.createAuditEventMock.mock.calls.at(-1)?.[0]?.data;
    expect(auditData.eventType).toBe('document_rejected');
    expect(auditData.metadata).toEqual(expect.objectContaining({ requiresReupload: true, actorStaffUserId: 'staff-1' }));
  });

  it('waived document stores waiver fields', async () => {
    const fd = new FormData();
    fd.set('submissionId', 'sub-1'); fd.set('documentId', 'doc-1'); fd.set('action', 'waive'); fd.set('internalReason', 'manual exception'); fd.set('waiverReason', 'unobtainable'); fd.set('isRequired', 'false');
    await runDocumentReviewAction(fd);
    expect(mocks.updateDocumentMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ waived: true, waivedReason: 'unobtainable', waivedBy: 'staff-1' }),
    }));
    const auditData = mocks.createAuditEventMock.mock.calls.at(-1)?.[0]?.data;
    expect(auditData.eventType).toBe('document_waived');
  });

  it('waiving required document requires reason', async () => {
    const fd = new FormData();
    fd.set('submissionId', 'sub-1'); fd.set('documentId', 'doc-1'); fd.set('action', 'waive'); fd.set('internalReason', 'manual exception'); fd.set('isRequired', 'true');
    await expect(runDocumentReviewAction(fd)).rejects.toThrow('Waiver reason is required for required documents.');
  });

  it('read_only_reviewer cannot perform document actions', async () => {
    mocks.requirePermissionMock.mockRejectedValueOnce(new Error('notFound'));
    const fd = new FormData();
    fd.set('submissionId', 'sub-1'); fd.set('documentId', 'doc-1'); fd.set('action', 'accept'); fd.set('internalReason', 'ok'); fd.set('isRequired', 'true');
    await expect(runDocumentReviewAction(fd)).rejects.toThrow('notFound');
  });
});
