import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
  generateClearReportDraftMock: vi.fn(),
  markClearReportPreparedMock: vi.fn(),
  approveClearReportForConsultationMock: vi.fn(),
  requestAustraliaClearReviewMock: vi.fn(),
  completeAustraliaClearReviewMock: vi.fn(),
  overrideApproveClearReportMock: vi.fn(),
  updateClearReportNotesMock: vi.fn(),
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
vi.mock('@/server/clearReports', () => ({
  generateClearReportDraft: mocks.generateClearReportDraftMock,
  markClearReportPrepared: mocks.markClearReportPreparedMock,
  approveClearReportForConsultation: mocks.approveClearReportForConsultationMock,
  requestAustraliaClearReview: mocks.requestAustraliaClearReviewMock,
  completeAustraliaClearReview: mocks.completeAustraliaClearReviewMock,
  overrideApproveClearReport: mocks.overrideApproveClearReportMock,
  updateClearReportNotes: mocks.updateClearReportNotesMock,
}));

import IntakeReviewPage from './page';
import {
  runClientCommunicationAction,
  runInternalReviewAction,
  runReleaseConsultationInvitationAction,
  runReleaseRequestMoreInformationAction,
  runConsultationBookingAction,
  runDocumentReviewAction,
  runLeadRatingAction,
  runGenerateClearReportDraftAction,
  runClearWorkflowAction,
  runUpdateClearReportNotesAction,
} from './actions';


let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let originalConsoleError: typeof console.error;

beforeAll(() => {
  originalConsoleError = console.error;
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const [first] = args;
    if (typeof first === 'string' && first.includes('Invalid value for prop `action` on <form> tag')) return;
    originalConsoleError(...(args as Parameters<typeof console.error>));
  });
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
});

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
      clearReports: [],
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
    expect(mocks.createClientCommunicationDraftMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'staff-1', actorRole: 'staff', actorStaffUserId: 'staff-1' }));
  });

  it('release request-more-info uses session-derived actor', async () => {
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('communicationId', 'comm-1');
    formData.set('internalReason', 'approved by reviewer');
    formData.set('staffActor', 'placeholder-should-not-be-used');

    await runReleaseRequestMoreInformationAction(formData);

    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.RELEASE_REQUEST_MORE_INFO);
    expect(mocks.releaseRequestMoreInformationCommunicationMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'staff-1', actorRole: 'staff', actorStaffUserId: 'staff-1' }));
  });

  it('release consultation invite uses session-derived actor', async () => {
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('communicationId', 'comm-2');
    formData.set('internalReason', 'consultation-ready checklist complete');

    await runReleaseConsultationInvitationAction(formData);

    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.RELEASE_CONSULTATION_INVITE);
    expect(mocks.releaseConsultationInvitationCommunicationMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'staff-1', actorRole: 'staff', actorStaffUserId: 'staff-1' }));
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

  it('request more information is internal-only, audited, and does not call client communication helpers', async () => {
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('action', 'request_more_information');
    formData.set('internalNote', 'Need staff to verify missing passport evidence before progressing.');

    const result = await runInternalReviewAction(formData);

    expect(result).toEqual({ status: 'success', message: 'More information request marked internally.' });
    expect(mocks.updateSubmissionMock).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { status: 'awaiting_client_documents' },
    });
    expect(mocks.upsertReviewStateMock).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ currentStage: 'document_completeness_check', lastDecision: 'needs_more_documents' }),
    }));
    expect(mocks.createStaffReviewMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        decision: 'needs_more_documents',
        internalNotes: 'Need staff to verify missing passport evidence before progressing.',
      }),
    }));
    expect(mocks.createAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'status_transition_executed',
        internalNote: 'Need staff to verify missing passport evidence before progressing.',
        metadata: expect.objectContaining({ action: 'request_more_information', internalOnly: true }),
      }),
    }));
    expect(mocks.createClientCommunicationDraftMock).not.toHaveBeenCalled();
    expect(mocks.releaseRequestMoreInformationCommunicationMock).not.toHaveBeenCalled();
    expect(mocks.releaseConsultationInvitationCommunicationMock).not.toHaveBeenCalled();
  });

  it('escalate for risk review is internal-only, audited, and does not call client communication helpers', async () => {
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('action', 'escalate_risk_review');
    formData.set('internalNote', 'Senior risk review required before any client-facing next step.');

    const result = await runInternalReviewAction(formData);

    expect(result).toEqual({ status: 'success', message: 'Risk review escalation recorded.' });
    expect(mocks.updateSubmissionMock).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { status: 'risk_review_in_progress' },
    });
    expect(mocks.updateManyRiskMock).toHaveBeenCalledWith({
      where: { submissionId: 'sub-1', resolutionStatus: 'open' },
      data: { resolutionStatus: 'under_review' },
    });
    expect(mocks.upsertReviewStateMock).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ currentStage: 'risk_assessment', lastDecision: 'needs_risk_clarification' }),
    }));
    expect(mocks.createStaffReviewMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        decision: 'needs_risk_clarification',
        internalNotes: 'Senior risk review required before any client-facing next step.',
      }),
    }));
    expect(mocks.createAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'status_transition_executed',
        metadata: expect.objectContaining({ action: 'escalate_risk_review', internalOnly: true }),
      }),
    }));
    expect(mocks.createClientCommunicationDraftMock).not.toHaveBeenCalled();
    expect(mocks.releaseRequestMoreInformationCommunicationMock).not.toHaveBeenCalled();
    expect(mocks.releaseConsultationInvitationCommunicationMock).not.toHaveBeenCalled();
  });

  it('sending C.L.E.A.R preparation forward lands on Senior Review without client communication', async () => {
    mocks.findUniqueMock.mockResolvedValueOnce({
      id: 'sub-1', status: 'preliminary_points_review_in_progress',
      currentReviewState: { currentStage: 'preliminary_points_review', lastDecision: 'manual_hold' },
      riskFlags: [],
    });
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('action', 'send_for_senior_review');
    formData.set('internalNote', 'C.L.E.A.R approved; governance review required.');

    const result = await runInternalReviewAction(formData);

    expect(result).toEqual({ status: 'success', message: 'Status updated → Senior Review.' });
    expect(mocks.updateSubmissionMock).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { status: 'senior_review_in_progress' },
    });
    expect(mocks.upsertReviewStateMock).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ currentStage: 'senior_consultant_check', lastDecision: 'manual_hold' }),
    }));
    expect(mocks.createAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'status_transition_executed',
        metadata: expect.objectContaining({ action: 'send_for_senior_review', internalOnly: true }),
      }),
    }));
    expect(mocks.createClientCommunicationDraftMock).not.toHaveBeenCalled();
    expect(mocks.releaseRequestMoreInformationCommunicationMock).not.toHaveBeenCalled();
    expect(mocks.releaseConsultationInvitationCommunicationMock).not.toHaveBeenCalled();
  });

  it('blocks consultation-ready transition before Senior Review', async () => {
    mocks.findUniqueMock.mockResolvedValueOnce({
      id: 'sub-1', status: 'preliminary_points_review_in_progress',
      currentReviewState: { currentStage: 'preliminary_points_review', lastDecision: 'manual_hold' },
      riskFlags: [],
    });
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('action', 'mark_consultation_ready_internal');
    formData.set('internalNote', 'Attempted early consultation readiness.');

    const result = await runInternalReviewAction(formData);

    expect(result).toEqual({ status: 'success', message: 'Senior Review must be completed first.' });
    expect(mocks.updateSubmissionMock).not.toHaveBeenCalled();
    expect(mocks.upsertReviewStateMock).not.toHaveBeenCalled();
    expect(mocks.createStaffReviewMock).not.toHaveBeenCalled();
    expect(mocks.createAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        reason: 'Senior Review must be completed first.',
        metadata: expect.objectContaining({ action: 'mark_consultation_ready_internal', blockedBySeniorReviewGate: true }),
      }),
    }));
    expect(mocks.createClientCommunicationDraftMock).not.toHaveBeenCalled();
    expect(mocks.releaseRequestMoreInformationCommunicationMock).not.toHaveBeenCalled();
    expect(mocks.releaseConsultationInvitationCommunicationMock).not.toHaveBeenCalled();
  });

  it('marking consultation-ready internally is a readiness transition only and does not call client communication helpers', async () => {
    mocks.findUniqueMock.mockResolvedValueOnce({
      id: 'sub-1', status: 'senior_review_in_progress',
      currentReviewState: { currentStage: 'senior_consultant_check', lastDecision: 'manual_hold' },
      riskFlags: [],
    });
    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('action', 'mark_consultation_ready_internal');
    formData.set('internalNote', 'Checklist complete; prepare invite separately only if authorised.');

    const result = await runInternalReviewAction(formData);

    expect(result).toEqual({ status: 'success', message: 'Status updated → Ready for Client Summary.' });
    expect(mocks.updateSubmissionMock).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { status: 'ready_for_client_summary' },
    });
    expect(mocks.upsertReviewStateMock).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ currentStage: 'client_summary_ready', lastDecision: 'manual_hold' }),
    }));
    expect(mocks.createAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'status_transition_executed',
        metadata: expect.objectContaining({ action: 'mark_consultation_ready_internal', internalOnly: true }),
      }),
    }));
    expect(mocks.createClientCommunicationDraftMock).not.toHaveBeenCalled();
    expect(mocks.releaseRequestMoreInformationCommunicationMock).not.toHaveBeenCalled();
    expect(mocks.releaseConsultationInvitationCommunicationMock).not.toHaveBeenCalled();
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


  it('no-change confirmed lead rating returns visible feedback without submitting a change', async () => {
    mocks.findUniqueMock.mockResolvedValueOnce({ leadRating: 'hot' });
    const change = new FormData();
    change.set('submissionId', 'sub-1');
    change.set('action', 'change');
    change.set('reason', 'already hot');
    change.set('rating', 'hot');

    const result = await runLeadRatingAction(change);

    expect(result).toEqual({ status: 'unchanged', message: 'Already set to Hot — no change made.' });
    expect(mocks.changeLeadRatingMock).not.toHaveBeenCalled();
    expect(mocks.createAuditEventMock).not.toHaveBeenCalled();
  });

  it('real confirmed lead rating change still submits and returns inline success feedback', async () => {
    mocks.findUniqueMock.mockResolvedValueOnce({ leadRating: 'warm' });
    const change = new FormData();
    change.set('submissionId', 'sub-1');
    change.set('action', 'change');
    change.set('reason', 'upgraded after review');
    change.set('rating', 'hot');

    const result = await runLeadRatingAction(change);

    expect(result).toEqual({ status: 'success', message: 'Confirmed rating updated to Hot.' });
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
    const jsx = await IntakeReviewPage({ params: Promise.resolve({ submissionId: 'sub-1' }), searchParams: Promise.resolve({ tab: 'lead-rating' }) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('Lead rating suggested');
    expect(html).toContain('Lead rating confirmed');
    expect(html).toContain('Lead rating changed');
    expect(html).not.toContain('lead_rating_changed');
    expect(html).toContain('Actor name');
    expect(html).toContain('From rating');
    expect(html).toContain('To rating');
    expect(html).not.toContain('Internal use only: Lead ratings are staff triage classifications and must not be communicated to clients as assessment outcomes.');
    expect(html).not.toContain('Edit');
    expect(html).not.toContain('Delete');
    expect(html).not.toContain('assessment outcome for client');
  });


  it('renders client review workspace header, workflow snapshot, case quality snapshot, and spaced tab chips', async () => {
    mocks.findUniqueMock.mockResolvedValueOnce({
      id: '6f36b53d-3f13-49ef-81e8-2ac6d75fabcd',
      registrationReference: 'VPM-REG-030626-0001',
      submittedAt: new Date('2026-06-03T10:53:00.000Z'),
      createdAt: new Date('2026-06-03T10:53:00.000Z'),
      payload: { firstName: 'Testing', currentOccupation: 'Mechanical Engineer', email: 'client@example.com' },
      status: 'ready_for_client_summary',
      leadRatingSuggested: 'hot', leadRatingSuggestedAt: new Date('2026-06-03T11:00:00.000Z'), leadRating: 'hot', leadRatingConfirmedAt: new Date('2026-06-03T11:05:00.000Z'), leadRatingConfirmedBy: 'Jane Reviewer', leadRatingReason: 'Strong profile',
      pointsSnapshots: [{ totalPoints: 85, missingItems: [], pointsBreakdown: { age: 30, english: 20 }, generatedAt: new Date('2026-06-03T10:54:00.000Z'), calculatorVersion: 'v1', generatedBy: 'system', preliminaryLabel: 'Preliminary only; subject to human review.' }],
      riskFlags: [], documents: [], currentReviewState: { currentStage: 'client_summary_ready', lastDecision: 'manual_hold', mandatoryStagesComplete: false, releaseChecklistSigned: false, seniorSignOffBy: null, seniorSignOffAt: null, updatedAt: new Date('2026-06-03T11:10:00.000Z') }, clientCommunications: [], consultationBookings: [], clearReports: [], auditEvents: [],
    });
    const jsx = await IntakeReviewPage({ params: Promise.resolve({ submissionId: '6f36b53d-3f13-49ef-81e8-2ac6d75fabcd' }), searchParams: Promise.resolve({ tab: 'overview' }) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('Client Review Workspace');
    expect(html).toContain('Registration Reference');
    expect(html).toContain('VPM-REG-030626-0001');
    expect(html).toContain('Testing — Mechanical Engineer');
    expect(html).toContain('Submitted: 3 June 2026, 6:53 pm');
    expect(html).not.toContain('Submission ID: 6f36b53d-3f13-49ef-81e8-2ac6d75fabcd');
    expect(html).toContain('Technical details');
    expect(html).toContain('Full submission UUID');
    expect(html).toContain('value="6f36b53d-3f13-49ef-81e8-2ac6d75fabcd"');
    expect(html).toContain('Progressing to consultation');
    expect(html).toContain('Workflow Stage Snapshot');
    expect(html).toContain('Ready to prepare/send consultation invitation; no invitation is sent automatically by entering this stage');
    expect(html).not.toContain('Staff has sent consultation invitation to Potential Client');
    expect(html).toContain('Quick Workflow Movement Controls');
    expect(html).not.toContain('Current stage: Consultation invite');
    expect(html).not.toContain('Next workflow stage:');
    expect(html).toContain('Upcoming / not started');
    expect(html).toContain('Case Quality Snapshot');
    expect(html).toContain('Strong indicators');
    expect(html).toContain('Recommended next staff action');
    expect(html).toContain('review-tab-list');
    expect(html).toContain('Overview');
    expect(html).toContain('Lead Rating Summary');
    expect(html).toContain('Open Lead Rating');
    expect(html).not.toContain('Lead Quality Rating');
    expect(html).not.toContain('Lead rating details');
  });

  it('lead rating history is human-readable, hides raw JSON metadata, and preserves from/to rating values', async () => {
    mocks.findUniqueMock.mockResolvedValueOnce({
      id: 'sub-1', submittedAt: new Date('2026-01-01T00:00:00.000Z'), createdAt: new Date('2026-01-01T00:00:00.000Z'),
      payload: {}, status: 'submitted', leadRatingSuggested: 'hot', leadRatingSuggestedAt: null, leadRating: 'hot', leadRatingConfirmedAt: null, leadRatingConfirmedBy: 'Jane', leadRatingReason: 'Manual decision',
      pointsSnapshots: [], riskFlags: [], documents: [], currentReviewState: null, clientCommunications: [], consultationBookings: [], clearReports: [],
      auditEvents: [{ id: 'a1', eventType: 'lead_rating_changed', eventAt: new Date('2026-01-01T01:00:00.000Z'), actorName: 'Jane', actorRole: 'senior_staff', fromValue: { rating: null }, toValue: { rating: 'hot' }, internalNote: 'Decision note', reason: null, metadata: { internalOnly: true, triageClassification: true } }],
    });
    const jsx = await IntakeReviewPage({ params: Promise.resolve({ submissionId: 'sub-1' }), searchParams: Promise.resolve({ tab: 'lead-rating' }) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('Lead rating changed');
    expect(html).toContain('Internal only');
    expect(html).toContain('Triage classification');
    expect(html).toContain('<dt>From rating</dt><dd>Not rated</dd>');
    expect(html).toContain('<dt>To rating</dt><dd>Hot</dd>');
    expect(html).not.toContain('{&quot;internalOnly&quot;:true');
    expect(html).not.toContain('lead_rating_changed');
    expect(html).not.toContain('Internal use only: Lead ratings are staff triage classifications and must not be communicated to clients as assessment outcomes.');
    expect(html).toContain('Lead rating details');
    expect(html).toContain('Show details');
    expect(html).toContain('This note is internal only and is used for audit history. It is not sent to the client.');
  });

  it('renders action feedback, useful points labels, and humanised review states without auth changes', async () => {
    const permissionCallsBefore = mocks.requirePermissionMock.mock.calls.length;
    mocks.findUniqueMock.mockResolvedValueOnce({
      id: 'sub-1', submittedAt: new Date('2026-01-01T00:00:00.000Z'), createdAt: new Date('2026-01-01T00:00:00.000Z'),
      payload: {}, status: 'ready_for_client_summary', leadRatingSuggested: null, leadRatingSuggestedAt: null, leadRating: null, leadRatingConfirmedAt: null, leadRatingConfirmedBy: null, leadRatingReason: null,
      pointsSnapshots: [{ totalPoints: 70, missingItems: ['english_test'], pointsBreakdown: { age: 25, qualification: 15 }, generatedAt: new Date('2026-01-01T01:00:00.000Z'), calculatorVersion: 'v1', generatedBy: 'system', preliminaryLabel: 'Preliminary only; subject to human review.' }],
      riskFlags: [], documents: [], currentReviewState: { currentStage: 'client_summary_ready', lastDecision: 'manual_hold', mandatoryStagesComplete: true, releaseChecklistSigned: false, seniorSignOffBy: null, seniorSignOffAt: null, updatedAt: new Date('2026-01-01T02:00:00.000Z') }, clientCommunications: [], consultationBookings: [], clearReports: [],
      auditEvents: [{ id: 'a1', eventType: 'status_transition_executed', eventAt: new Date('2026-01-01T02:00:00.000Z'), eventSource: 'staff_review_action', relatedEntityType: 'staff_review', actorName: 'Jane', actorRole: 'senior_staff', fromValue: null, toValue: null, internalNote: 'done', reason: 'done', metadata: { internalOnly: true } }],
    });
    const jsx = await IntakeReviewPage({ params: Promise.resolve({ submissionId: 'sub-1' }), searchParams: Promise.resolve({ tab: 'overview' }) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('Status updated: Progressing to consultation.');
    expect(html).toContain('Internal review state updated successfully.');
    expect(html).toContain('Total preliminary points');
    expect(html).toContain('Key points contributors / breakdown');
    expect(html).toContain('Missing items');
    expect(html).toContain('Preliminary only:');
    expect(html).toContain('Client summary ready');
    expect(html).toContain('Manual hold');
    expect(mocks.requirePermissionMock.mock.calls.length).toBeGreaterThan(permissionCallsBefore);
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
    const jsx = await IntakeReviewPage({ params: Promise.resolve({ submissionId: 'sub-1' }), searchParams: Promise.resolve({ tab: 'lead-rating' }) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('No lead rating history recorded yet.');
  });

  it('overview tab renders internal review actions and current review state', async () => {
    const jsx = await IntakeReviewPage({ params: Promise.resolve({ submissionId: 'sub-1' }), searchParams: Promise.resolve({ tab: 'overview' }) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('Internal Review Actions');
    expect(html).toContain('Recommended next action');
    expect(html).toContain('Current Review State');
  });



  it('renders staff action pending labels for lead rating and internal review actions', async () => {
    const jsx = await IntakeReviewPage({ params: Promise.resolve({ submissionId: 'sub-1' }), searchParams: Promise.resolve({ tab: 'lead-rating' }) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('data-pending-label="Updating rating…"');
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



  it('clear tab renders label, warning, and generate action with permission', async () => {
    const jsx = await IntakeReviewPage({ params: Promise.resolve({ submissionId: 'sub-1' }), searchParams: Promise.resolve({ tab: 'clear' }) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('C.L.E.A.R');
    expect(html).toContain('internal staff-reviewed preliminary strategy report');
    expect(html).toContain('Generate C.L.E.A.R Draft');
    expect(html).not.toContain('PDF');
    expect(html).not.toContain('Email');
    expect(html).toContain('internal governance steps only');
    expect(html).not.toContain('Share');
    expect(html).toContain('Stale/unapproved reference data blocks normal approval');
  });

  it('generate clear draft action calls service', async () => {
    const fd = new FormData();
    fd.set('submissionId', 'sub-1');
    fd.set('internalReason', 'internal rationale');
    fd.set('overrideNote', 'optional override');
    await runGenerateClearReportDraftAction(fd);
    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.GENERATE_CLEAR_REPORT);
    expect(mocks.generateClearReportDraftMock).toHaveBeenCalledWith(expect.objectContaining({ submissionId: 'sub-1', staffNotes: 'internal rationale', overrideNote: 'optional override' }));
  });

  it('clear tab renders existing reports and safe snapshot preview sections', async () => {
    mocks.findUniqueMock.mockResolvedValueOnce({
      id: 'sub-1', payload: {}, status: 'submitted', leadRating: null, leadRatingSuggested: null, leadRatingReason: null, leadRatingConfirmedAt: null, leadRatingConfirmedBy: null, leadRatingSuggestedAt: null,
      pointsSnapshots: [], riskFlags: [], documents: [], currentReviewState: null, clientCommunications: [], consultationBookings: [], auditEvents: [],
      clearReports: [{
        id: 'cr-1', status: 'draft', reportVersion: 'clear-v1', createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T01:00:00Z'), preparedByStaffUserId: 'staff-1', preparedAt: new Date('2026-01-01T02:00:00Z'), reviewedAt: new Date('2026-01-01T03:00:00Z'), approvedByStaffUserId: 'boss-1', approvedAt: new Date('2026-01-01T04:00:00Z'), approvalScope: 'standard_hot', requiresAustraliaReview: true, australiaReviewReason: 'escalated', australiaReviewedByStaffUserId: 'au-1', australiaReviewedAt: new Date('2026-01-01T05:00:00Z'), escalationReason: 'risk', reviewNotes: 'notes', reviewedByStaffUserId: 'staff-2', sharedAt: null,
        staffNotes: 'Internal strategy note',
        clientFacingNotes: 'Client-safe note draft',
        generatedSnapshotJson: { clientSnapshot: { a: 1 }, ageProfileSummary: { age: 30 }, qualificationSummary: { highestQualification: 'Bachelor' }, workExperienceSummary: { years: 5 }, englishSummary: { level: 'Superior' }, potentialOccupationAlignment: { placeholder: 'alignment' }, possibleSkillsAssessmentBodyPathway: { placeholder: 'body/pathway' }, preliminaryPointsSnapshot: { total: 80 }, pointsImprovementStrategy: { placeholder: 'improve points' }, gsmOverviewSc189Sc190Sc491: { placeholder: 'gsm' }, referenceDataset: { datasetVersion: 'ds-v3', warning: 'dataset stale' }, legalReferenceGuidance: { internalOnly: true, matchedReferences: [{ legalReferenceId: 'lr-1', topic: 'refusal_history', referenceType: 'act_section', sectionOrSchedule: 's57', sourceUrl: 'https://example.gov', legendComReference: 'LEG-1', sourceDate: '2026-01-02', approvedAt: '2026-01-01', summary: 'Refusal context', operationalNotes: 'ops', riskTriggerNotes: 'risk note' }] }, documentCompleteness: { total: 1 }, riskDisclosuresReviewNotes: [{ riskCode: 'x' }], consultationTalkingPoints: { placeholder: 'talking points' }, recommendedNextSteps: { placeholder: 'next steps' }, estimatedForwardCostCategories: [{ code: 'gov_fee' }], disclaimer: 'Internal only.' },
      }],
    });
    const jsx = await IntakeReviewPage({ params: Promise.resolve({ submissionId: 'sub-1' }), searchParams: Promise.resolve({ tab: 'clear' }) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('Report status');
    expect(html).toContain('Report version');
    expect(html).toContain('Prepared by');
    expect(html).toContain('Approval scope');
    expect(html).toContain('Requires Australia review');
    expect(html).toContain('Australia reviewed by');
    expect(html).toContain('Escalation reason');
    expect(html).toContain('Mark Prepared');
    expect(html).toContain('Boss Override Approval (Internal)');
    expect(html).toContain('Approve for Consultation Use (Internal)');
    expect(html).toContain('Approval for consultation use is an internal readiness step only. It does not send the report to the client and does not confirm any visa outcome.');
    expect(html).toContain('Reference dataset warning');
    expect(html).toContain('Consultation Pack');
    expect(html).toContain('Internal only warning');
    expect(html).toContain('This Consultation Pack is an internal staff tool for structured discussion. It does not confirm any visa outcome and must not be treated as legal advice.');
    expect(html).toContain('Report status marker');
    expect(html).toContain('Approved for consultation marker');
    expect(html).toContain('Requires Australia review marker');
    expect(html).toContain('Reference dataset warning marker');
    expect(html).toContain('Legal reference guidance marker');
    expect(html).toContain('Risk flags marker');
    expect(html).toContain('Missing documents marker');
    expect(html).toContain('Consultation readiness status');
    expect(html).toContain('Lead rating summary');
    expect(html).toContain('Key strengths / positive pathway indicators');
    expect(html).toContain('Key concerns / risk items');
    expect(html).toContain('Preliminary points position');
    expect(html).toContain('Points improvement opportunities');
    expect(html).toContain('GSM pathway overview: SC189 / SC190 / SC491');
    expect(html).toContain('Document completeness / missing documents');
    expect(html).toContain('Internal legal reference guidance summary');
    expect(html).toContain('CSA discussion prompt');
    expect(html).toContain('If the client understands the strategy and wishes to proceed, discuss the Client Service Agreement pathway and next onboarding steps.');
    expect(html).toContain('Reference dataset version');
    expect(html).toContain('Legal/reference warning');
    expect(html).toContain('C.L.E.A.R cover/header');
    expect(html).toContain('Safe language reminder');
    expect(html).toContain('C.L.E.A.R title');
    expect(html).toContain('Client Eligibility Assessment Report');
    expect(html).toContain('Visa Pass Migration');
    expect(html).toContain('src="/brand/vpm-logo-light.png"');
    expect(html).toContain('Internal status badge');
    expect(html).toContain('Client snapshot');
    expect(html).toContain('Age/profile summary');
    expect(html).toContain('Qualification summary');
    expect(html).toContain('Work experience summary');
    expect(html).toContain('English summary');
    expect(html).toContain('Potential occupation alignment');
    expect(html).toContain('Possible skills assessment body/pathway');
    expect(html).toContain('Preliminary points snapshot');
    expect(html).toContain('Points improvement strategy');
    expect(html).toContain('GSM overview: SC189 / SC190 / SC491');
    expect(html).toContain('Document completeness');
    expect(html).toContain('Risk disclosures/review notes');
    expect(html).toContain('Consultation talking points');
    expect(html).toContain('Recommended next steps');
    expect(html).toContain('Estimated forward cost categories');
    expect(html).toContain('Reference dataset version/source notes');
    expect(html).toContain('Legal Reference Guidance (Internal only)');
    expect(html).toContain('Internal Legal Reference Guidance (Approved sources only)');
    expect(html).toContain('Staff must verify source and approval metadata before any client discussion.');
    expect(html).toContain('Warning:');
    expect(html).toContain('referenceType');
    expect(html).toContain('sectionOrSchedule');
    expect(html).toContain('legendComReference');
    expect(html).toContain('sourceDate');
    expect(html).toContain('Disclaimer');
    expect(html).toContain('Update C.L.E.A.R Notes');
    expect(html).not.toContain('Export');
    expect(html).not.toContain('Send Email');
    expect(html).not.toContain('Approve & Share');
    expect(html).not.toContain('Share with Client');
    expect(html).not.toContain('Client Outcome');
    expect(html).not.toContain('PDF');
    expect(html).not.toContain('Email');
  });

  it('read_only_reviewer can view clear tab but cannot mutate', async () => {
    mocks.findUniqueMock.mockResolvedValueOnce({
      id: 'sub-1', payload: {}, status: 'submitted', leadRating: null, leadRatingSuggested: null, leadRatingReason: null, leadRatingConfirmedAt: null, leadRatingConfirmedBy: null, leadRatingSuggestedAt: null,
      pointsSnapshots: [], riskFlags: [], documents: [], currentReviewState: null, clientCommunications: [], consultationBookings: [], auditEvents: [],
      clearReports: [{ id: 'cr-1', status: 'draft', reportVersion: 'clear-v1', createdAt: new Date(), updatedAt: new Date(), preparedByStaffUserId: null, preparedAt: null, reviewedAt: null, approvedByStaffUserId: null, approvedAt: null, approvalScope: null, requiresAustraliaReview: false, australiaReviewReason: null, australiaReviewedByStaffUserId: null, australiaReviewedAt: null, escalationReason: null, reviewNotes: null, reviewedByStaffUserId: null, sharedAt: null, staffNotes: 'a', clientFacingNotes: 'b', generatedSnapshotJson: {} }],
    });
    mocks.requirePermissionMock.mockImplementation(async (permission) => {
      if (permission === PERMISSIONS.GENERATE_CLEAR_REPORT) throw new Error('not allowed');
      if (permission === PERMISSIONS.PREPARE_CLEAR_REPORT) throw new Error('not allowed');
      if (permission === PERMISSIONS.EDIT_CLEAR_REPORT) throw new Error('not allowed');
    });
    const jsx = await IntakeReviewPage({ params: Promise.resolve({ submissionId: 'sub-1' }), searchParams: Promise.resolve({ tab: 'clear' }) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('C.L.E.A.R');
    expect(html).toContain('Draft generation is not available for your role.');
    expect(html).not.toContain('Generate C.L.E.A.R Draft');
    expect(html).not.toContain('Mark Prepared');
    expect(html).not.toContain('Update C.L.E.A.R Notes');
    expect(html).toContain('Read-only mode: you can view C.L.E.A.R notes but cannot edit them.');
  });

  it('clear notes edit action calls service for users with edit permission', async () => {
    const fd = new FormData();
    fd.set('submissionId', 'sub-1');
    fd.set('clearReportId', 'cr-1');
    fd.set('staffNotes', 'staff update');
    fd.set('clientFacingNotes', 'safe preliminary note');
    fd.set('internalReason', 'audit reason');
    await runUpdateClearReportNotesAction(fd);
    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.EDIT_CLEAR_REPORT);
    expect(mocks.updateClearReportNotesMock).toHaveBeenCalledWith(expect.objectContaining({
      clearReportId: 'cr-1',
      staffNotes: 'staff update',
      clientFacingNotes: 'safe preliminary note',
      reason: 'audit reason',
    }));
  });

  it('clear workflow actions call mapped services and require reason', async () => {
    const actions = [
      ['mark_prepared', mocks.markClearReportPreparedMock],
      ['approve_for_consultation', mocks.approveClearReportForConsultationMock],
      ['request_au_review', mocks.requestAustraliaClearReviewMock],
      ['complete_au_review', mocks.completeAustraliaClearReviewMock],
      ['boss_override_approve', mocks.overrideApproveClearReportMock],
    ] as const;
    for (const [action, fn] of actions) {
      const fd = new FormData(); fd.set('submissionId', 'sub-1'); fd.set('clearReportId', 'cr-1'); fd.set('action', action); fd.set('internalReason', 'internal note');
      await runClearWorkflowAction(fd);
      expect(fn).toHaveBeenCalled();
    }
    const missingReason = new FormData(); missingReason.set('submissionId', 'sub-1'); missingReason.set('clearReportId', 'cr-1'); missingReason.set('action', 'mark_prepared');
    await runClearWorkflowAction(missingReason);
    expect(mocks.markClearReportPreparedMock).toHaveBeenCalledTimes(1);
  });

  it('renders all tab labels and supports tab query parameter fallback', async () => {
    const jsx = await IntakeReviewPage({ params: Promise.resolve({ submissionId: 'sub-1' }), searchParams: Promise.resolve({ tab: 'unknown' }) });
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain('Overview');
    expect(html).toContain('Intake Details');
    expect(html).toContain('Documents');
    expect(html).toContain('Lead Rating');
    expect(html).toContain('Communications');
    expect(html).toContain('C.L.E.A.R');
    expect(html).toContain('Consultation');
    expect(html).toContain('Staff Tasks');
    expect(html).toContain('Audit Trail');
    expect(html).toContain('Internal Review Actions');
  });
});
