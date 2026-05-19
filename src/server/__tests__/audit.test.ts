import { beforeEach, describe, expect, it, vi } from 'vitest';

const { auditCreateMock, txAuditCreateMock } = vi.hoisted(() => ({
  auditCreateMock: vi.fn(),
  txAuditCreateMock: vi.fn(),
}));

vi.mock('../db', () => ({
  db: {
    auditEvent: {
      create: auditCreateMock,
    },
  },
}));

import { prepareAuditEvent, recordAuditEvent } from '../audit';

describe('prepareAuditEvent', () => {
  it('prepareAuditEvent requires event type', () => {
    expect(() =>
      prepareAuditEvent({
        eventType: '' as never,
        actorId: 'actor-1',
        actorRole: 'staff',
        submissionId: 'sub-1',
      }),
    ).toThrow();
  });

  it('prepareAuditEvent includes actor id, actor role, submission id, metadata, and timestamp', () => {
    const ts = new Date('2026-01-02T00:00:00.000Z');
    const event = prepareAuditEvent({
      eventType: 'submission_created',
      actorId: ' actor-1 ',
      actorRole: 'reviewer',
      submissionId: ' sub-1 ',
      metadata: { source: 'unit-test' },
      timestamp: ts,
    });

    expect(event.actorId).toBe('actor-1');
    expect(event.actorRole).toBe('reviewer');
    expect(event.submissionId).toBe('sub-1');
    expect(event.metadata).toEqual({ source: 'unit-test' });
    expect(event.eventAt).toBe(ts.toISOString());
  });
});

describe('recordAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditCreateMock.mockImplementation(async ({ data }) => ({ id: 'audit-1', ...data }));
    txAuditCreateMock.mockImplementation(async ({ data }) => ({ id: 'audit-tx-1', ...data }));
  });

  it('uses db client by default', async () => {
    await recordAuditEvent({ submissionId: 'sub-1', eventType: 'submission_updated' });
    expect(auditCreateMock).toHaveBeenCalledTimes(1);
    expect(txAuditCreateMock).not.toHaveBeenCalled();
  });

  it('uses tx client when provided', async () => {
    await recordAuditEvent({
      submissionId: 'sub-1',
      eventType: 'submission_updated',
      tx: { auditEvent: { create: txAuditCreateMock } } as never,
    });
    expect(txAuditCreateMock).toHaveBeenCalledTimes(1);
    expect(auditCreateMock).not.toHaveBeenCalled();
  });

  it('recordAuditEvent creates valid audit payload', async () => {
    await recordAuditEvent({
      submissionId: 'sub-1',
      eventType: 'submission_updated',
      actorId: 'staff-1',
      actorRole: 'staff',
      reason: 'updated notes',
    });

    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          submissionId: 'sub-1',
          eventType: 'submission_updated',
          actorId: 'staff-1',
          actorRole: 'staff',
          reason: 'updated notes',
        }),
      }),
    );
  });

  it('missing eventType fails', async () => {
    await expect(
      recordAuditEvent({
        submissionId: 'sub-1',
        eventType: '' as never,
      }),
    ).rejects.toThrow('eventType is required.');
  });

  it('missing actorId fails for staff/user actions', async () => {
    await expect(
      recordAuditEvent({
        submissionId: 'sub-1',
        eventType: 'submission_updated',
        actorRole: 'staff',
      }),
    ).rejects.toThrow('actorId is required for actorRole staff.');
  });

  it('related entity fields are preserved', async () => {
    await recordAuditEvent({
      submissionId: 'sub-1',
      eventType: 'submission_updated',
      relatedEntityType: 'consultation_booking',
      relatedEntityId: 'booking-1',
    });

    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          relatedEntityType: 'consultation_booking',
          relatedEntityId: 'booking-1',
        }),
      }),
    );
  });

  it('fromValue/toValue are preserved', async () => {
    await recordAuditEvent({
      submissionId: 'sub-1',
      eventType: 'submission_updated',
      fromValue: { status: 'draft' },
      toValue: { status: 'submitted' },
    });

    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromValue: { status: 'draft' },
          toValue: { status: 'submitted' },
        }),
      }),
    );
  });

  it('internalNote is preserved', async () => {
    await recordAuditEvent({
      submissionId: 'sub-1',
      eventType: 'submission_updated',
      internalNote: 'Only visible to staff',
    });

    expect(auditCreateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ internalNote: 'Only visible to staff' }) }));
  });

  it('metadata is preserved', async () => {
    await recordAuditEvent({
      submissionId: 'sub-1',
      eventType: 'submission_updated',
      metadata: { source: 'unit-test', correlationId: 'corr-1' },
    });

    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ metadata: { source: 'unit-test', correlationId: 'corr-1' } }),
      }),
    );
  });

  it('actorStaffUserId is preserved as first-class field', async () => {
    await recordAuditEvent({
      submissionId: 'sub-1',
      eventType: 'submission_updated',
      actorStaffUserId: 'staff-user-1',
    });

    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorStaffUserId: 'staff-user-1' }),
      }),
    );
  });
});
