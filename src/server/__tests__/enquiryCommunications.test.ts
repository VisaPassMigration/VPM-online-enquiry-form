import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, hasPermission } from '@/server/auth/permissions';
import { buildEnquiryFaqEmailTemplate } from '@/server/email';

const mocks = vi.hoisted(() => ({
  dbMock: {
    enquiry: { findUnique: vi.fn(), create: vi.fn() },
    enquiryCommunication: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    staffTask: { create: vi.fn() },
  },
  recordAuditEvent: vi.fn(),
  sendEnquiryFaqEmail: vi.fn(),
}));

vi.mock('@/server/db', () => ({ db: mocks.dbMock }));
vi.mock('@/server/audit', () => ({ recordAuditEvent: mocks.recordAuditEvent }));
vi.mock('@/server/email', async () => {
  const actual = await vi.importActual<typeof import('@/server/email')>('@/server/email');
  return { ...actual, sendEnquiryFaqEmail: mocks.sendEnquiryFaqEmail };
});

import { draftEnquiryFaqEmail, markEnquiryFaqEmailFailed, sendEnquiryFaqEmail as sendService } from '@/server/enquiryCommunications';

const actor = { actorId: 'u1', actorRole: 'staff', actorStaffUserId: 's1', actorRoles: ['senior_staff'] as const };

describe('enquiry communications', () => {
  beforeEach(() => vi.clearAllMocks());
  it('templates include intake link placeholder and safe wording without prohibited words', () => {
    const prohibited = /\beligible\b|\bapproved\b|\bguaranteed\b|\bqualified\b|\bsuitable\b|\bstrong candidate\b/i;
    const types = ['faq_general_migration','faq_skilled_migration','faq_student_visa','faq_partner_family','faq_employer_sponsored','faq_insufficient_information'] as const;
    for (const type of types) {
      const tmpl = buildEnquiryFaqEmailTemplate({ type });
      expect(tmpl.bodyText).toContain('[INTAKE_FORM_LINK]');
      expect(tmpl.bodyText).toContain('Thank you for your enquiry');
      expect(tmpl.bodyText).not.toMatch(prohibited);
      expect(tmpl.bodyText).not.toMatch(/consultation|calendly|book a consultation/i);
    }
  });
  it('permission mapping grants send_enquiry_faq_email to allowed roles and not read_only_reviewer', () => {
    expect(hasPermission(['boss_admin'], PERMISSIONS.SEND_ENQUIRY_FAQ_EMAIL)).toBe(true);
    expect(hasPermission(['senior_staff'], PERMISSIONS.SEND_ENQUIRY_FAQ_EMAIL)).toBe(true);
    expect(hasPermission(['kenya_intake_staff'], PERMISSIONS.SEND_ENQUIRY_FAQ_EMAIL)).toBe(true);
    expect(hasPermission(['australia_migration_team'], PERMISSIONS.SEND_ENQUIRY_FAQ_EMAIL)).toBe(true);
    expect(hasPermission(['read_only_reviewer'], PERMISSIONS.SEND_ENQUIRY_FAQ_EMAIL)).toBe(false);
  });
  it('draft writes audit event', async () => {
    mocks.dbMock.enquiry.findUnique.mockResolvedValue({ id: 'e1', intakeSubmissionId: 'sub1' });
    mocks.dbMock.enquiryCommunication.create.mockResolvedValue({ id: 'c1', intakeSubmissionId: 'sub1', enquiryId: 'e1', type: 'faq_general_migration', status: 'drafted_internal' });
    await draftEnquiryFaqEmail({ enquiryId: 'e1', type: 'faq_general_migration', actor });
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'enquiry_faq_email_drafted' }));
  });
  it('send writes audit event and creates follow-up task', async () => {
    mocks.dbMock.enquiryCommunication.findUnique.mockResolvedValue({ id: 'c1', enquiryId: 'e1', intakeSubmissionId: 'sub1', subject: 's', bodyText: 'safe [INTAKE_FORM_LINK]', enquiry: { email: 'x@y.com' } });
    mocks.sendEnquiryFaqEmail.mockResolvedValue({ status: 'sent', provider: 'none' });
    mocks.dbMock.enquiryCommunication.update.mockResolvedValue({ id: 'c1', enquiryId: 'e1', intakeSubmissionId: 'sub1', type: 'faq_general_migration' });
    await sendService({ communicationId: 'c1', internalReason: 'Staff reviewed and approved info-only email', actor });
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'enquiry_faq_email_sent' }));
    expect(mocks.dbMock.staffTask.create).toHaveBeenCalled();
  });
  it('failed send writes audit event', async () => {
    mocks.dbMock.enquiryCommunication.update.mockResolvedValue({ id: 'c1', intakeSubmissionId: 'sub1' });
    await markEnquiryFaqEmailFailed({ communicationId: 'c1', failureReason: 'x', actor });
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'enquiry_faq_email_failed' }));
  });
});
