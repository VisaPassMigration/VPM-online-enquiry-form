import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  auth: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  createEnquiry: vi.fn(),
  draftEnquiryFaqEmail: vi.fn(),
  sendEnquiryFaqEmail: vi.fn(),
}));

vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/server/db', () => ({ db: { enquiry: { findMany: mocks.findMany, findUnique: mocks.findUnique } } }));
vi.mock('@/server/enquiryCommunications', () => ({ createEnquiry: mocks.createEnquiry, draftEnquiryFaqEmail: mocks.draftEnquiryFaqEmail, sendEnquiryFaqEmail: mocks.sendEnquiryFaqEmail }));

describe('dashboard enquiries page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'u1', staffUserId: 's1', roles: ['senior_staff'] } });
    mocks.findUnique.mockResolvedValue(null);
    mocks.findMany.mockResolvedValue([{ id: 'e1', firstName: 'Ann', lastName: 'Lee', email: 'a@b.com', phone: '1', enquirySource: 'Web', intendedPathway: 'Skilled', countryOfResidence: 'Kenya', createdAt: new Date('2026-05-19T00:00:00Z'), intakeSubmission: { id: 'sub1', status: 'submitted' }, communications: [{ id: 'c1', status: 'drafted_internal', type: 'faq_general_migration' }] }]);
  });

  it('renders enquiries page with required columns and internal note', async () => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('Enquiries');
    expect(markup).toContain('FAQ status');
    expect(markup).toContain('FAQ / Pre-Intake emails are staff-controlled information emails only.');
    expect(markup).toContain('/dashboard/intakes/sub1');
  });

  it('links the enquiry row and a view action to the linked intake detail page', async () => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('<a class="review-queue-client-link" href="/dashboard/intakes/sub1">Ann Lee</a>');
    expect(markup).toContain('View enquiry');
    expect(markup.match(/href="\/dashboard\/intakes\/sub1"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('links enquiries with no intake submission to their own enquiry detail page', async () => {
    mocks.findMany.mockResolvedValue([{ id: 'e2', firstName: 'Ben', lastName: 'Ng', email: 'b@c.com', phone: null, enquirySource: 'Referral', intendedPathway: null, countryOfResidence: null, createdAt: new Date('2026-05-19T00:00:00Z'), intakeSubmission: null, communications: [] }]);
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('<a class="review-queue-client-link" href="/dashboard/enquiries/e2">Ben Ng</a>');
    expect(markup).toContain('View enquiry');
    expect(markup.match(/href="\/dashboard\/enquiries\/e2"/g)?.length).toBeGreaterThanOrEqual(2);
  });


  it('prioritizes table columns, maps draft status clearly, and shows secondary details compactly', async () => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('<th>Name</th><th>Email</th><th>Phone</th><th>Intended pathway</th><th>Created</th><th>FAQ status</th><th>Intake status</th><th>Actions</th>');
    expect(markup).toContain('Draft prepared');
    expect(markup).toContain('Source: Web');
    expect(markup).toContain('Residence: Kenya');
    expect(markup).toContain('Intake submitted: submitted');
  });

  it('shows duplicate warning details when duplicate redirect param is present', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'e1', firstName: 'Ann', lastName: 'Lee', email: 'a@b.com', phone: '1', createdAt: new Date('2026-05-19T00:00:00Z') });
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ duplicateEnquiryId: 'e1' }) }));
    expect(markup).toContain('Possible duplicate: this email or phone already exists in enquiry records.');
    expect(markup).toContain('Create anyway after duplicate review');
  });

  it('template selector includes all six templates', async () => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('General migration enquiry');
    expect(markup).toContain('Skilled migration enquiry');
    expect(markup).toContain('Student visa enquiry');
    expect(markup).toContain('Partner/family enquiry');
    expect(markup).toContain('Employer-sponsored enquiry');
    expect(markup).toContain('Not enough information / please complete questionnaire');
  });
});
