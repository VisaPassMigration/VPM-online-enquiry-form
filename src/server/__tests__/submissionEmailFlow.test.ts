import { describe, expect, it, vi } from 'vitest';

import { sendClientConfirmationEmailWithAudit } from '@/server/intakeApi';

describe('submission email flow helper', () => {
  it('does not fail submission flow when email send fails and audits failure', async () => {
    const recordAudit = vi.fn().mockResolvedValue(undefined);

    const result = await sendClientConfirmationEmailWithAudit({
      sendEmail: vi.fn().mockRejectedValue(new Error('smtp timeout')),
      recordAudit,
    });

    expect(result.ok).toBe(false);
    expect(recordAudit).toHaveBeenCalledTimes(1);
    expect(recordAudit.mock.calls[0][1]).toMatchObject({
      emailEvent: 'client_confirmation_email_failed',
    });
  });
});
