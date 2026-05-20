import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
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
  suggestLeadRatingMock: vi.fn(),
  confirmLeadRatingMock: vi.fn(),
  changeLeadRatingMock: vi.fn(),
}));

vi.mock('@/server/auth/requireStaffSession', () => ({ requireStaffSession: mocks.requireStaffSessionMock }));
vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermissionMock }));
vi.mock('@/server/db', () => ({ db: { $transaction: mocks.transactionMock, intakeSubmission: { findUnique: mocks.findUniqueMock } } }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePathMock }));
vi.mock('next/link', () => ({ default: ({ children }: { children: string }) => children }));

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
vi.mock('@/server/leadRatings', () => ({
  suggestLeadRating: mocks.suggestLeadRatingMock,
  confirmLeadRating: mocks.confirmLeadRatingMock,
  changeLeadRating: mocks.changeLeadRatingMock,
}));

import {
  runClientCommunicationAction,
  runInternalReviewAction,
  runReleaseConsultationInvitationAction,
  runReleaseRequestMoreInformationAction,
  runConsultationBookingAction,
  runDocumentReviewAction,
  runLeadRatingAction,
  default as IntakeReviewPage,
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
      payload: {},
      pointsSnapshots: [],
      currentReviewState: { currentStage: 'intake_triage', lastDecision: 'manual_hold' },
      riskFlags: [],
      documents: [],
      clientCommunications: [],
      consultationBookings: [],
      auditEvents: [],
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

  it('lead rating actions call service functions and enforce permissions', async () => {
    const suggest = new FormData();
    suggest.set('submissionId', 'sub-1');
    suggest.set('action', 'suggest');
    suggest.set('reason', 'triage');
    await runLeadRatingAction(suggest);
    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.SUGGEST_LEAD_RATING);
    expect(mocks.suggestLeadRatingMock).toHaveBeenCalled();

    const confirm = new FormData();
    confirm.set('submissionId', 'sub-1');
    confirm.set('action', 'confirm');
    confirm.set('reason', 'confirmed');
    confirm.set('rating', 'hot');
    await runLeadRatingAction(confirm);
    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.CONFIRM_LEAD_RATING);
    expect(mocks.confirmLeadRatingMock).toHaveBeenCalled();

    const change = new FormData();
    change.set('submissionId', 'sub-1');
    change.set('action', 'change');
    change.set('reason', 'adjusted');
    change.set('rating', 'warm');
    await runLeadRatingAction(change);
    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.CHANGE_CONFIRMED_LEAD_RATING);
    expect(mocks.changeLeadRatingMock).toHaveBeenCalled();
  });

  it('lead rating actions do not trigger client communication', async () => {
    const suggest = new FormData();
    suggest.set('submissionId', 'sub-1');
    suggest.set('action', 'suggest');
    suggest.set('reason', 'triage');
    await runLeadRatingAction(suggest);
    expect(mocks.createClientCommunicationDraftMock).not.toHaveBeenCalled();
    expect(mocks.releaseConsultationInvitationCommunicationMock).not.toHaveBeenCalled();
    expect(mocks.releaseRequestMoreInformationCommunicationMock).not.toHaveBeenCalled();
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
    await expect(runDocumentReviewAction(fd)).rejects.toThrow('Waiver reason is required for all waiver actions.');
  });

  it('waiving optional document still requires waiverReason', async () => {
    const fd = new FormData();
    fd.set('submissionId', 'sub-1'); fd.set('documentId', 'doc-1'); fd.set('action', 'waive'); fd.set('internalReason', 'manual exception'); fd.set('isRequired', 'false');
    await expect(runDocumentReviewAction(fd)).rejects.toThrow('Waiver reason is required for all waiver actions.');
  });

  it('missing internal reason throws clear error', async () => {
    const fd = new FormData();
    fd.set('submissionId', 'sub-1'); fd.set('documentId', 'doc-1'); fd.set('action', 'accept');
    await expect(runDocumentReviewAction(fd)).rejects.toThrow('Document review action validation failed: missing internal reason.');
  });

  it('unknown action throws clear error', async () => {
    const fd = new FormData();
    fd.set('submissionId', 'sub-1'); fd.set('documentId', 'doc-1'); fd.set('action', 'archive'); fd.set('internalReason', 'not valid');
    await expect(runDocumentReviewAction(fd)).rejects.toThrow('Document review action validation failed: unknown action "archive".');
  });

  it('blocks document action if document belongs to another submission', async () => {
    mocks.findDocumentMock.mockResolvedValueOnce({
      id: 'doc-1',
      submissionId: 'sub-2',
      verificationStatus: 'uploaded_unchecked',
      waived: false,
      documentType: 'passportBioPage',
    });
    const fd = new FormData();
    fd.set('submissionId', 'sub-1'); fd.set('documentId', 'doc-1'); fd.set('action', 'accept'); fd.set('internalReason', 'all good');
    await expect(runDocumentReviewAction(fd)).rejects.toThrow('Document review action blocked: document doc-1 does not belong to submission sub-1.');
    expect(mocks.updateDocumentMock).not.toHaveBeenCalled();
    expect(mocks.createAuditEventMock).not.toHaveBeenCalled();
  });

  it('does not call client communication services during document review actions', async () => {
    const fd = new FormData();
    fd.set('submissionId', 'sub-1'); fd.set('documentId', 'doc-1'); fd.set('action', 'accept'); fd.set('internalReason', 'all good');
    await runDocumentReviewAction(fd);
    expect(mocks.createClientCommunicationDraftMock).not.toHaveBeenCalled();
    expect(mocks.releaseRequestMoreInformationCommunicationMock).not.toHaveBeenCalled();
    expect(mocks.releaseConsultationInvitationCommunicationMock).not.toHaveBeenCalled();
  });

  it('document review audit payload includes required actor/source/entity/note/metadata fields', async () => {
    const fd = new FormData();
    fd.set('submissionId', 'sub-1'); fd.set('documentId', 'doc-1'); fd.set('action', 'waive'); fd.set('internalReason', 'manual exception'); fd.set('waiverReason', 'client unavailable');
    await runDocumentReviewAction(fd);
    const auditData = mocks.createAuditEventMock.mock.calls.at(-1)?.[0]?.data;
    expect(auditData).toEqual(expect.objectContaining({
      actorId: 'staff-1',
      actorRole: 'senior_staff',
      actorStaffUserId: 'staff-1',
      eventSource: 'staff_document_review_action',
      relatedEntityType: 'submission_document',
      relatedEntityId: 'doc-1',
      internalNote: 'manual exception',
    }));
    expect(auditData.metadata).toEqual(expect.objectContaining({
      actorStaffUserId: 'staff-1',
      waiverReasonProvided: true,
    }));
  });

  it('read_only_reviewer cannot perform document actions', async () => {
    mocks.requirePermissionMock.mockRejectedValueOnce(new Error('notFound'));
    const fd = new FormData();
    fd.set('submissionId', 'sub-1'); fd.set('documentId', 'doc-1'); fd.set('action', 'accept'); fd.set('internalReason', 'ok'); fd.set('isRequired', 'true');
    await expect(runDocumentReviewAction(fd)).rejects.toThrow('notFound');
  });

  it('lead rating history renders suggested/confirmed/changed events as internal read-only timeline', async () => {
    mocks.findUniqueMock.mockResolvedValueOnce({
      id: 'sub-1',
      payload: { staffTasks: [] },
      status: 'submitted',
      leadRatingSuggested: 'warm',
      leadRatingSuggestedAt: new Date('2026-01-01T00:00:00.000Z'),
      leadRating: 'hot',
      leadRatingConfirmedAt: new Date('2026-01-02T00:00:00.000Z'),
      leadRatingConfirmedBy: 'Jane Reviewer',
      leadRatingReason: 'Strong urgency',
      pointsSnapshots: [],
      riskFlags: [],
      documents: [],
      currentReviewState: null,
      clientCommunications: [],
      consultationBookings: [],
      auditEvents: [
        { id: 'a1', eventType: 'lead_rating_suggested', eventAt: new Date('2026-01-01T01:00:00.000Z'), actorName: 'System', actorRole: 'service', fromValue: null, toValue: { rating: 'warm' }, internalNote: null, reason: 'Auto score', metadata: { source: 'rules' } },
        { id: 'a2', eventType: 'lead_rating_confirmed', eventAt: new Date('2026-01-01T02:00:00.000Z'), actorName: 'Jane Reviewer', actorRole: 'senior_staff', fromValue: { rating: 'warm' }, toValue: { rating: 'hot' }, internalNote: 'Escalating priority', reason: null, metadata: null },
        { id: 'a3', eventType: 'lead_rating_changed', eventAt: new Date('2026-01-01T03:00:00.000Z'), actorName: 'Alex', actorRole: 'admin', fromValue: { rating: 'hot' }, toValue: { rating: 'warm' }, internalNote: null, reason: 'Evidence updated', metadata: { source: 'manual' } },
      ],
    });
    const jsx = await IntakeReviewPage({ params: Promise.resolve({ submissionId: 'sub-1' }) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('lead_rating_suggested');
    expect(html).toContain('lead_rating_confirmed');
    expect(html).toContain('lead_rating_changed');
    expect(html).toContain('Actor name');
    expect(html).toContain('From rating');
    expect(html).toContain('To rating');
    expect(html).toContain('Lead rating history is shown for internal accountability and triage review.');
    expect(html).not.toContain('Edit');
    expect(html).not.toContain('Delete');
    expect(html).not.toContain('assessment outcome for client');
  });

  it('lead rating history empty state renders when no rating history exists', async () => {
    mocks.findUniqueMock.mockResolvedValueOnce({
      id: 'sub-1',
      payload: { staffTasks: [] },
      status: 'submitted',
      leadRatingSuggested: null,
      leadRatingSuggestedAt: null,
      leadRating: null,
      leadRatingConfirmedAt: null,
      leadRatingConfirmedBy: null,
      leadRatingReason: null,
      pointsSnapshots: [],
      riskFlags: [],
      documents: [],
      currentReviewState: null,
      clientCommunications: [],
      consultationBookings: [],
      auditEvents: [{ id: 'ax', eventType: 'submission_updated', eventAt: new Date(), actorName: null, actorRole: null, fromValue: null, toValue: null, internalNote: null, reason: null, metadata: null }],
    });
    const jsx = await IntakeReviewPage({ params: Promise.resolve({ submissionId: 'sub-1' }) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('No lead rating history recorded yet.');
  });

  it('overview tab renders internal review actions and current review state', async () => {
    const jsx = await IntakeReviewPage({ params: Promise.resolve({ submissionId: 'sub-1' }), searchParams: Promise.resolve({ tab: 'overview' }) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('Internal review actions');
    expect(html).toContain('Mark Under Review');
    expect(html).toContain('Current review state');
  });

  it('staff tasks tab renders task controls and excludes internal review action labels', async () => {
    const jsx = await IntakeReviewPage({ params: Promise.resolve({ submissionId: 'sub-1' }), searchParams: Promise.resolve({ tab: 'staff-tasks' }) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('Staff task list');
    expect(html).toContain('Create task');
    expect(html).toContain('Start task');
    expect(html).toContain('Complete task');
    expect(html).toContain('Cancel task');
    expect(html).toContain('Assign task');
    expect(html).toContain('Reassign task');
    expect(html).not.toContain('Internal review actions');
    expect(html).not.toContain('Mark Under Review');
  });

  it('renders all tab labels and supports tab query parameter fallback', async () => {
    const jsx = await IntakeReviewPage({ params: Promise.resolve({ submissionId: 'sub-1' }), searchParams: Promise.resolve({ tab: 'unknown' }) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('Overview');
    expect(html).toContain('Intake Details');
    expect(html).toContain('Documents');
    expect(html).toContain('Lead Rating');
    expect(html).toContain('Communications');
    expect(html).toContain('Consultation');
    expect(html).toContain('Staff Tasks');
    expect(html).toContain('Audit Trail');
    expect(html).toContain('Internal review actions');
  });
});
