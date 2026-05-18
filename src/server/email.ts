export type EmailProvider = 'resend' | 'smtp' | 'none';

export type IntakeReceivedEmailInput = {
  to: string;
  submissionId: string;
  clientName?: string | null;
};

export type EmailSendResult = {
  status: 'sent' | 'queued' | 'disabled';
  provider: EmailProvider;
  messageId?: string;
};

export type RequestMoreInformationEmailInput = {
  to: string;
  checklistOrReason: string;
};

const SUBJECT = 'Thank you — your Initial Assessment Questionnaire has been received';
const REQUEST_MORE_INFORMATION_SUBJECT = 'Additional information requested for your enquiry';

export function buildClientIntakeReceivedEmailBody(_params: { submissionId: string; clientName?: string | null }) {
  return [
    'Thank you for completing your Initial Assessment Questionnaire with Visa Pass Migration.',
    '',
    'We have received your submission and it is now pending preliminary review by our team.',
    '',
    'Please note that submission of this questionnaire does not confirm eligibility for any visa or migration pathway. Our team will review the information provided and contact you if further information is required or if there are suitable next steps to discuss.',
    '',
    'Kind regards,',
    'Visa Pass Migration',
  ].join('\n');
}

export function buildRequestMoreInformationEmailBody(input: RequestMoreInformationEmailInput) {
  return [
    'Thank you for your submission.',
    '',
    'Our team has reviewed the information provided and requires additional documents or details before we can continue the preliminary review.',
    '',
    'Please provide the following information:',
    input.checklistOrReason,
    '',
    'This request forms part of our preliminary review process and does not confirm eligibility for any visa or migration pathway.',
    '',
    'Once received, our team will continue reviewing your enquiry and contact you regarding any suitable next steps.',
    '',
    'Kind regards,',
    'Visa Pass Migration',
  ].join('\n');
}

function getEmailConfig() {
  const provider = (process.env.EMAIL_PROVIDER ?? 'none').toLowerCase() as EmailProvider;
  const from = process.env.EMAIL_FROM;

  if (!from && provider !== 'none') throw new Error('EMAIL_FROM is required when EMAIL_PROVIDER is enabled.');

  if (provider === 'resend' && !process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend.');
  }

  if (provider === 'smtp') {
    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS are required when EMAIL_PROVIDER=smtp.');
    }
  }

  return { provider, from };
}

export async function sendClientIntakeReceivedEmail(input: IntakeReceivedEmailInput): Promise<EmailSendResult> {
  const config = getEmailConfig();
  if (config.provider === 'none') {
    return { status: 'queued', provider: 'none' };
  }

  const text = buildClientIntakeReceivedEmailBody({ submissionId: input.submissionId, clientName: input.clientName });

  if (config.provider === 'resend') {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.from,
        to: input.to,
        subject: SUBJECT,
        text,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Resend send failed (${response.status}): ${details}`);
    }

    const payload = (await response.json()) as { id?: string };
    return { status: 'sent', provider: 'resend', messageId: payload.id };
  }

  throw new Error('SMTP provider is configured but no SMTP transport is installed in this runtime. Use EMAIL_PROVIDER=resend for active delivery.');
}

export async function sendRequestMoreInformationEmail(input: RequestMoreInformationEmailInput): Promise<EmailSendResult> {
  const config = getEmailConfig();
  if (config.provider === 'none') {
    return { status: 'queued', provider: 'none' };
  }

  const text = buildRequestMoreInformationEmailBody(input);

  if (config.provider === 'resend') {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.from,
        to: input.to,
        subject: REQUEST_MORE_INFORMATION_SUBJECT,
        text,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Resend send failed (${response.status}): ${details}`);
    }

    const payload = (await response.json()) as { id?: string };
    return { status: 'sent', provider: 'resend', messageId: payload.id };
  }

  throw new Error('SMTP provider is configured but no SMTP transport is installed in this runtime. Use EMAIL_PROVIDER=resend for active delivery.');
}

export { SUBJECT as CLIENT_INTAKE_RECEIVED_SUBJECT };
export { REQUEST_MORE_INFORMATION_SUBJECT };
