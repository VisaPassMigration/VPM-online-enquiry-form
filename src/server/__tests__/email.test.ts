import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildClientIntakeReceivedEmailBody, buildRequestMoreInformationEmailBody, sendClientIntakeReceivedEmail } from '@/server/email';

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
  vi.restoreAllMocks();
});

describe('email service', () => {
  it('builds required intake-received email body', () => {
    const body = buildClientIntakeReceivedEmailBody({ submissionId: 'sub-1', clientName: 'Jane Doe' });
    expect(body).toContain('Thank you for completing your Initial Assessment Questionnaire with Visa Pass Migration.');
    expect(body).toContain('pending preliminary review by our team.');
    expect(body).toContain('does not confirm eligibility for any visa or migration pathway.');
    expect(body).toContain('Kind regards,\nVisa Pass Migration');
  });

  it('builds neutral request-more-information body', () => {
    const body = buildRequestMoreInformationEmailBody({ to: 'client@example.com', checklistOrReason: 'Passport copy and CV' });
    expect(body).toContain('Thank you for your submission.');
    expect(body).toContain('Please provide the following information:\nPassport copy and CV');
    expect(body).toContain('does not confirm eligibility for any visa or migration pathway.');
    expect(body).toContain('Kind regards,\nVisa Pass Migration');
  });

  it('throws for missing resend config', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.EMAIL_FROM = 'no-reply@example.com';
    delete process.env.RESEND_API_KEY;

    await expect(sendClientIntakeReceivedEmail({ to: 'client@example.com', submissionId: 'sub-1', clientName: 'Jane' })).rejects.toThrow(/RESEND_API_KEY/);
  });

  it('returns queued status when email provider is none', async () => {
    process.env.EMAIL_PROVIDER = 'none';

    await expect(sendClientIntakeReceivedEmail({ to: 'client@example.com', submissionId: 'sub-1', clientName: 'Jane' })).resolves.toEqual({
      status: 'queued',
      provider: 'none',
    });
  });
});
