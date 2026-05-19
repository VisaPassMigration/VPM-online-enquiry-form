import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  gate: vi.fn(),
  db: {
    clientCommunication: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    intakeSubmission: { findUnique: vi.fn() },
    riskFlag: { findMany: vi.fn() },
    submissionReviewState: { findUnique: vi.fn() },
  },
  sendEmail: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock('../clientCommunicationGate', () => ({
  validateClientCommunicationRelease: mocks.gate,
}));

vi.mock('../db', () => ({ db: mocks.db }));
vi.mock('../email', () => ({ sendClientIntakeReceivedEmail: vi.fn(), sendRequestMoreInformationEmail: mocks.sendEmail, sendConsultationInvitationEmail: mocks.sendEmail }));
vi.mock('../audit', () => ({ recordAuditEvent: mocks.recordAuditEvent }));

import {
  createClientCommunicationDraft,
  requestClientCommunicationRelease,
  releaseRequestMoreInformationCommunication,
  releaseConsultationInvitationCommunication,
} from '../clientCommunications';

const baseInput = {
  submissionId: 'sub_1',
  communicationType: 'request_more_information' as const,
  subject: 'Need two missing records',
  bodyText: 'Please provide two missing records.',
  internalReason: 'Records are missing.',
  actorId: 'staff_1',
  actorRole: 'staff' as const,
  actorStaffUserId: 'staff-user-1',
};

describe('clientCommunications service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.db.clientCommunication.create.mockResolvedValue({ id: 'comm_1', status: 'drafted_internal' });
    mocks.db.clientCommunication.update.mockResolvedValue({ id: 'comm_1', status: 'pending_staff_release' });
    mocks.db.clientCommunication.findMany.mockResolvedValue([]);
    mocks.recordAuditEvent.mockResolvedValue({ id: 'audit_1' });
    mocks.db.intakeSubmission.findUnique.mockResolvedValue({ id: 'sub_1' });
    mocks.db.riskFlag.findMany.mockResolvedValue([]);
    mocks.db.submissionReviewState.findUnique.mockResolvedValue({ currentStage: 'triage_complete', lastDecision: 'pending' });
    mocks.gate.mockReturnValue({ allowed: true, requiredChecks: {}, auditEventType: 'client_communication_release_validated' });
  });

  it('draft creation stores required data shape', async () => {
    await createClientCommunicationDraft(baseInput);
    expect(mocks.db.clientCommunication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          submissionId: 'sub_1',
          type: 'request_more_information',
          subject: baseInput.subject,
          bodyText: baseInput.bodyText,
          internalReason: baseInput.internalReason,
        }),
      }),
    );
    expect(mocks.recordAuditEvent).toHaveBeenCalled();
  });

  it('release request is allowed when gate passes', async () => {
    const result = await requestClientCommunicationRelease({ ...baseInput, communicationId: 'comm_1' });
    expect(result.status).toBe('pending_staff_release');
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'client_comm_release_requested', actorStaffUserId: 'staff-user-1' }));
  });

  it('release request is blocked when gate fails', async () => {
    mocks.gate.mockReturnValue({ allowed: false, blockedReason: 'staffActionRequired', requiredChecks: { staffActionRequired: false }, auditEventType: 'client_communication_release_blocked' });

    await expect(requestClientCommunicationRelease({ ...baseInput, communicationId: 'comm_1' })).rejects.toThrow(/blocked/);
    expect(mocks.db.clientCommunication.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'blocked' } }));
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'client_comm_release_blocked' }));
  });

  it('consultation invitation is blocked by unresolved high/critical risk', async () => {
    mocks.db.riskFlag.findMany.mockResolvedValue([
      { riskCode: 'risk_1', severity: 'high', resolutionStatus: 'open' },
    ]);
    mocks.db.submissionReviewState.findUnique.mockResolvedValue({ currentStage: 'consultation_ready', lastDecision: 'consultation_invite' });
    mocks.gate.mockReturnValue({ allowed: false, blockedReason: 'consultationRiskClear', requiredChecks: { consultationRiskClear: false }, auditEventType: 'client_communication_release_blocked' });

    await expect(
      requestClientCommunicationRelease({
        ...baseInput,
        communicationId: 'comm_1',
        communicationType: 'consultation_invitation',
      }),
    ).rejects.toThrow(/consultationRiskClear/);
  });

  it('missing internal reason fails', async () => {
    await expect(createClientCommunicationDraft({ ...baseInput, internalReason: '   ' })).rejects.toThrow(/internalReason is required/);
  });

  it('does not call any email send function', async () => {
    await createClientCommunicationDraft(baseInput);
    await requestClientCommunicationRelease({ ...baseInput, communicationId: 'comm_1' });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('releases and sends request more information email when gate allows', async () => {
    mocks.db.intakeSubmission.findUnique.mockResolvedValue({ id: 'sub_1', payload: { email: 'client@example.com' } });
    mocks.db.clientCommunication.update.mockResolvedValue({ id: 'comm_1', status: 'released' });
    mocks.sendEmail.mockResolvedValue({ status: 'sent', provider: 'resend', messageId: 'msg_1' });

    const result = await releaseRequestMoreInformationCommunication({ ...baseInput, communicationId: 'comm_1' });
    expect(result.status).toBe('released');
    expect(mocks.sendEmail).toHaveBeenCalled();
  });

  it('marks failed if request-more-information email send fails', async () => {
    mocks.db.intakeSubmission.findUnique.mockResolvedValue({ id: 'sub_1', payload: { email: 'client@example.com' } });
    mocks.sendEmail.mockRejectedValue(new Error('smtp down'));
    mocks.db.clientCommunication.update.mockResolvedValue({ id: 'comm_1', status: 'failed' });

    const result = await releaseRequestMoreInformationCommunication({ ...baseInput, communicationId: 'comm_1' });
    expect(result.status).toBe('failed');
    expect(mocks.db.clientCommunication.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }));
  });

  it('release blocks consultation invite if review state is not consultation-ready', async () => {
    mocks.db.intakeSubmission.findUnique.mockResolvedValue({ id: 'sub_1', payload: { email: 'client@example.com' } });
    mocks.db.submissionReviewState.findUnique.mockResolvedValue({ currentStage: 'intake_triage', lastDecision: 'pending' });
    mocks.gate.mockReturnValue({ allowed: false, blockedReason: 'consultationReady', requiredChecks: { consultationReady: false }, auditEventType: 'client_communication_release_blocked' });

    await expect(releaseConsultationInvitationCommunication({ ...baseInput, communicationId: 'comm_1', communicationType: 'consultation_invitation' })).rejects.toThrow(/consultationReady/);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('release succeeds for consultation invite when gate passes', async () => {
    mocks.db.intakeSubmission.findUnique.mockResolvedValue({ id: 'sub_1', payload: { email: 'client@example.com' } });
    mocks.db.clientCommunication.update.mockResolvedValue({ id: 'comm_1', status: 'released' });
    mocks.sendEmail.mockResolvedValue({ status: 'sent', provider: 'resend', messageId: 'msg_1' });

    const result = await releaseConsultationInvitationCommunication({ ...baseInput, communicationId: 'comm_1', communicationType: 'consultation_invitation' });
    expect(result.status).toBe('released');
    expect(mocks.sendEmail).toHaveBeenCalled();
  });

  it('send failure marks consultation invite communication as failed', async () => {
    mocks.db.intakeSubmission.findUnique.mockResolvedValue({ id: 'sub_1', payload: { email: 'client@example.com' } });
    mocks.sendEmail.mockRejectedValue(new Error('provider down'));
    mocks.db.clientCommunication.update.mockResolvedValue({ id: 'comm_1', status: 'failed' });

    const result = await releaseConsultationInvitationCommunication({ ...baseInput, communicationId: 'comm_1', communicationType: 'consultation_invitation' });
    expect(result.status).toBe('failed');
    expect(mocks.db.clientCommunication.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }));
  });

  it('does not create calendar events during consultation invite release', async () => {
    mocks.db.intakeSubmission.findUnique.mockResolvedValue({ id: 'sub_1', payload: { email: 'client@example.com' } });
    mocks.db.clientCommunication.update.mockResolvedValue({ id: 'comm_1', status: 'released' });
    mocks.sendEmail.mockResolvedValue({ status: 'sent', provider: 'resend', messageId: 'msg_1' });

    await releaseConsultationInvitationCommunication({ ...baseInput, communicationId: 'comm_1', communicationType: 'consultation_invitation' });
    expect(Object.keys(mocks.db)).not.toContain('calendarEvent');
  });
});
