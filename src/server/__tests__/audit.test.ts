import { describe, expect, it } from 'vitest';
import { prepareAuditEvent } from '../audit';

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
