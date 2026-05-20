import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  auth: vi.fn(),
  findMany: vi.fn(),
  createEnquiry: vi.fn(),
  draftEnquiryFaqEmail: vi.fn(),
  sendEnquiryFaqEmail: vi.fn(),
}));

vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/server/db', () => ({ db: { enquiry: { findMany: mocks.findMany } } }));
vi.mock('@/server/enquiryCommunications', () => ({ createEnquiry: mocks.createEnquiry, draftEnquiryFaqEmail: mocks.draftEnquiryFaqEmail, sendEnquiryFaqEmail: mocks.sendEnquiryFaqEmail }));

describe('dashboard enquiries page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'u1', staffUserId: 's1', roles: ['senior_staff'] } });
    mocks.findMany.mockResolvedValue([{ id: 'e1', firstName: 'Ann', lastName: 'Lee', email: 'a@b.com', phone: '1', enquirySource: 'Web', intendedPathway: 'Skilled', countryOfResidence: 'Kenya', createdAt: new Date('2026-05-19T00:00:00Z'), intakeSubmission: { id: 'sub1', status: 'submitted' }, communications: [{ id: 'c1', status: 'drafted_internal', type: 'faq_general_migration' }] }]);
  });

  it('renders enquiries page with required columns and internal note', async () => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page());
    expect(markup).toContain('Enquiries');
    expect(markup).toContain('Latest FAQ/pre-intake email status');
    expect(markup).toContain('FAQ / Pre-Intake emails are staff-controlled information emails only.');
    expect(markup).toContain('/dashboard/intakes/sub1');
  });

  it('template selector includes all six templates', async () => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page());
    expect(markup).toContain('General migration enquiry');
    expect(markup).toContain('Skilled migration enquiry');
    expect(markup).toContain('Student visa enquiry');
    expect(markup).toContain('Partner/family enquiry');
    expect(markup).toContain('Employer-sponsored enquiry');
    expect(markup).toContain('Not enough information / please complete questionnaire');
  });
});
