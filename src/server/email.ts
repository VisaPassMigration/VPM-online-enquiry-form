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
export type ConsultationInvitationEmailInput = {
  to: string;
};

const SUBJECT = 'Thank you — your Initial Assessment Questionnaire has been received';
const REQUEST_MORE_INFORMATION_SUBJECT = 'Additional information requested for your enquiry';
const CONSULTATION_INVITATION_SUBJECT = 'Invitation to book a consultation';

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

export function buildConsultationInvitationEmailBody() {
  const bookingUrl = process.env.CONSULTATION_BOOKING_URL?.trim() || '[booking link placeholder]';
  return [
    'Thank you for the information provided so far.',
    '',
    'Based on our internal review, we invite you to book a consultation to discuss your circumstances and possible next steps.',
    '',
    'You can book a consultation using the link below:',
    bookingUrl,
    '',
    'A consultation is an information and planning session. Any pathway options depend on full assessment, supporting evidence, and applicable migration requirements.',
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

export async function sendConsultationInvitationEmail(input: ConsultationInvitationEmailInput): Promise<EmailSendResult> {
  const config = getEmailConfig();
  if (config.provider === 'none') {
    return { status: 'queued', provider: 'none' };
  }

  const text = buildConsultationInvitationEmailBody();

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
        subject: CONSULTATION_INVITATION_SUBJECT,
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
export { CONSULTATION_INVITATION_SUBJECT };


const ENQUIRY_FAQ_SUBJECTS = {
  faq_general_migration: 'General migration enquiry — next steps',
  faq_skilled_migration: 'Skilled migration enquiry — next steps',
  faq_student_visa: 'Student visa enquiry — next steps',
  faq_partner_family: 'Partner/family enquiry — next steps',
  faq_employer_sponsored: 'Employer-sponsored enquiry — next steps',
  faq_insufficient_information: 'More information needed before preliminary review',
} as const;

type EnquiryFaqType = keyof typeof ENQUIRY_FAQ_SUBJECTS;

function safeEnquiryBody(nextStep: string, intakeLink: string, docsHint: string) {
  return [
    'Thank you for your enquiry with Visa Pass Migration.',
    '',
    nextStep,
    '',
    'Please complete our preliminary questionnaire using this link:',
    intakeLink,
    '',
    docsHint,
    '',
    'Important: this preliminary process is informational only and does not confirm any migration outcome. Any future pathway discussion depends on full evidence checks and applicable legal requirements.',
    '',
    'Kind regards,',
    'Visa Pass Migration',
  ].join('\n');
}

export function buildEnquiryFaqEmailTemplate(input: { type: EnquiryFaqType; intakeLinkUrl?: string }) {
  const intakeLink = input.intakeLinkUrl?.trim() || '[INTAKE_FORM_LINK]';
  const templates: Record<EnquiryFaqType, { subject: string; bodyText: string }> = {
    faq_general_migration: { subject: ENQUIRY_FAQ_SUBJECTS.faq_general_migration, bodyText: safeEnquiryBody('Our team will begin a preliminary review after we receive your completed questionnaire.', intakeLink, 'Helpful items for preliminary review may include identification details, travel/residency history, and any prior visa correspondence.') },
    faq_skilled_migration: { subject: ENQUIRY_FAQ_SUBJECTS.faq_skilled_migration, bodyText: safeEnquiryBody('Our team will conduct a preliminary skilled migration review after your questionnaire is submitted.', intakeLink, 'Helpful items may include resume/CV, qualifications, employment evidence, and English test details (if available).') },
    faq_student_visa: { subject: ENQUIRY_FAQ_SUBJECTS.faq_student_visa, bodyText: safeEnquiryBody('Our team will complete a preliminary student visa review once your questionnaire is received.', intakeLink, 'Helpful items may include current study history, intended course details, financial planning information, and passport information.') },
    faq_partner_family: { subject: ENQUIRY_FAQ_SUBJECTS.faq_partner_family, bodyText: safeEnquiryBody('Our team will complete a preliminary partner/family review after questionnaire completion.', intakeLink, 'Helpful items may include relationship timeline notes, identity documents, and prior visa history for both parties where relevant.') },
    faq_employer_sponsored: { subject: ENQUIRY_FAQ_SUBJECTS.faq_employer_sponsored, bodyText: safeEnquiryBody('Our team will begin preliminary employer-sponsored pathway checks once your questionnaire is submitted.', intakeLink, 'Helpful items may include role details, employer information, occupation background, and employment evidence.') },
    faq_insufficient_information: { subject: ENQUIRY_FAQ_SUBJECTS.faq_insufficient_information, bodyText: safeEnquiryBody('We need additional details before we can start a preliminary review of your enquiry.', intakeLink, 'Please include as much detail as possible in the questionnaire so our team can complete a meaningful preliminary review.') },
  };
  return templates[input.type];
}

export async function sendEnquiryFaqEmail(input: { to: string; subject: string; bodyText: string }): Promise<EmailSendResult> {
  const config = getEmailConfig();
  if (config.provider === 'none') return { status: 'queued', provider: 'none' };
  if (config.provider === 'resend') {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: config.from, to: input.to, subject: input.subject, text: input.bodyText }) });
    if (!response.ok) throw new Error(`Resend send failed (${response.status}): ${await response.text()}`);
    const payload = (await response.json()) as { id?: string };
    return { status: 'sent', provider: 'resend', messageId: payload.id };
  }
  throw new Error('SMTP provider is configured but no SMTP transport is installed in this runtime. Use EMAIL_PROVIDER=resend for active delivery.');
}
