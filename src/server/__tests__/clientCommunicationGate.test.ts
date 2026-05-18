import { describe, expect, it } from 'vitest';
import { validateClientCommunicationRelease } from '../clientCommunicationGate';

const baseInput = () => ({
  submission: { id: 'sub_1' },
  communicationType: 'request_more_information',
  internalNote: 'Need updated employment reference.',
  actorId: 'staff_1',
  actorRole: 'staff',
  riskFlags: [],
  reviewState: { state: 'triage_complete', decision: 'pending' },
  existingCommunications: [],
});

describe('validateClientCommunicationRelease', () => {
  it('request more information allowed with staff actor and note', () => {
    const result = validateClientCommunicationRelease(baseInput());
    expect(result.allowed).toBe(true);
    expect(result.auditEventType).toBe('client_communication_release_validated');
  });

  it('release blocked when actor is not staff', () => {
    const result = validateClientCommunicationRelease({
      ...baseInput(),
      actorRole: 'client',
    });

    expect(result.allowed).toBe(false);
    expect(result.requiredChecks.staffActionRequired).toBe(false);
  });

  it('release blocked when internal note is missing', () => {
    const result = validateClientCommunicationRelease({
      ...baseInput(),
      internalNote: ' ',
    });

    expect(result.allowed).toBe(false);
    expect(result.requiredChecks.internalNoteRequired).toBe(false);
  });

  it('consultation invitation blocked when high/critical risk is unresolved', () => {
    const result = validateClientCommunicationRelease({
      ...baseInput(),
      communicationType: 'consultation_invitation',
      reviewState: { state: 'consultation_ready' },
      riskFlags: [
        { key: 'status_history_declared', severity: 'high', status: 'under_review' },
      ],
    });

    expect(result.allowed).toBe(false);
    expect(result.requiredChecks.consultationRiskClear).toBe(false);
  });

  it('consultation invitation blocked when review is not consultation-ready', () => {
    const result = validateClientCommunicationRelease({
      ...baseInput(),
      communicationType: 'consultation_invitation',
      reviewState: { state: 'triage_complete', decision: 'more_info_needed' },
    });

    expect(result.allowed).toBe(false);
    expect(result.requiredChecks.consultationReady).toBe(false);
  });

  it('duplicate release blocked without resend reason', () => {
    const result = validateClientCommunicationRelease({
      ...baseInput(),
      existingCommunications: [
        { type: 'request_more_information', status: 'released' },
      ],
    });

    expect(result.allowed).toBe(false);
    expect(result.requiredChecks.duplicateReleaseGuard).toBe(false);
  });

  it('not progressing/hold allowed only with staff actor and note', () => {
    const allowed = validateClientCommunicationRelease({
      ...baseInput(),
      communicationType: 'not_progressing_hold',
    });

    const blocked = validateClientCommunicationRelease({
      ...baseInput(),
      communicationType: 'not_progressing_hold',
      actorRole: 'client',
      internalNote: '',
    });

    expect(allowed.allowed).toBe(true);
    expect(blocked.allowed).toBe(false);
  });

  it('system/automated actor cannot release client communication', () => {
    const result = validateClientCommunicationRelease({
      ...baseInput(),
      actorRole: 'system',
    });

    expect(result.allowed).toBe(false);
    expect(result.requiredChecks.noAutomaticOrSystemRelease).toBe(false);
  });

  it('consultation invitation is allowed when review state is client_summary_ready and risk is clear', () => {
    const result = validateClientCommunicationRelease({
      ...baseInput(),
      communicationType: 'consultation_invitation',
      reviewState: { state: 'client_summary_ready', decision: 'pending' },
      riskFlags: [{ key: 'health_declared', severity: 'medium', status: 'open' }],
    });

    expect(result.allowed).toBe(true);
    expect(result.requiredChecks.consultationReady).toBe(true);
  });

});
