import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PERMISSIONS } from '@/server/auth/permissions';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  findUnique: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }),
}));

vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/server/db', () => ({ db: { enquiry: { findUnique: mocks.findUnique } } }));
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }), redirect: mocks.redirect }));

describe('enquiry detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({
      id: 'e1',
      firstName: 'Ann',
      lastName: 'Lee',
      email: 'a@b.com',
      phone: '0400 000 000',
      enquirySource: 'Website',
      enquiryMessage: 'Interested in skilled migration options.',
      intendedPathway: 'Skilled',
      countryOfResidence: 'Kenya',
      nationality: 'Kenyan',
      createdAt: new Date('2026-05-19T00:00:00Z'),
      updatedAt: new Date('2026-05-20T00:00:00Z'),
      communications: [
        { id: 'c1', type: 'faq_general_migration', status: 'sent', subject: 'General migration info', createdAt: new Date('2026-05-19T01:00:00Z'), sentAt: new Date('2026-05-19T02:00:00Z') },
      ],
    });
  });

  it('checks permission before querying the enquiry', async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error('blocked'));
    const page = (await import('./page')).default;
    await expect(page({ params: Promise.resolve({ enquiryId: 'e1' }) })).rejects.toThrow('blocked');
    expect(mocks.requirePermission).toHaveBeenCalledWith(PERMISSIONS.VIEW_DASHBOARD);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('redirects to the intake detail page instead of rendering stale enquiry-only state when an intake submission now exists', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'e1',
      firstName: 'Ann',
      lastName: 'Lee',
      email: 'a@b.com',
      phone: '0400 000 000',
      enquirySource: 'Website',
      enquiryMessage: 'Interested in skilled migration options.',
      intendedPathway: 'Skilled',
      countryOfResidence: 'Kenya',
      nationality: 'Kenyan',
      intakeSubmissionId: 'sub1',
      createdAt: new Date('2026-05-19T00:00:00Z'),
      updatedAt: new Date('2026-05-20T00:00:00Z'),
      communications: [],
    });
    const page = (await import('./page')).default;
    await expect(page({ params: Promise.resolve({ enquiryId: 'e1' }) })).rejects.toThrow('NEXT_REDIRECT:/dashboard/intakes/sub1');
  });

  it('renders the enquiry own fields and a clear not-yet-submitted label', async () => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ params: Promise.resolve({ enquiryId: 'e1' }) }));
    expect(markup).toContain('Ann Lee');
    expect(markup).toContain('a@b.com');
    expect(markup).toContain('0400 000 000');
    expect(markup).toContain('Website');
    expect(markup).toContain('Interested in skilled migration options.');
    expect(markup).toContain('Skilled');
    expect(markup).toContain('Kenya');
    expect(markup).toContain('This is an enquiry record only.');
    expect(markup).toContain('has not yet submitted the Registration Form');
  });

  it('has no tabs, workflow controls, lead rating, or C.L.E.A.R. tooling — only a plain-record note mentioning them', async () => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ params: Promise.resolve({ enquiryId: 'e1' }) }));
    expect(markup).not.toContain('Lead rating:');
    expect(markup).not.toContain('pill--');
    expect(markup).not.toContain('workflow-stage');
    expect(markup).not.toContain('review-tab');
    expect(markup).not.toContain('<form');
    expect(markup).not.toContain('<button');
    expect(markup).toContain('This is an enquiry record only.');
  });

  it('lists communications already sent for this enquiry', async () => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ params: Promise.resolve({ enquiryId: 'e1' }) }));
    expect(markup).toContain('General migration info');
    expect(markup).toContain('faq general migration');
    expect(markup).toContain('Sent');
  });

  it('shows an empty state when no communications exist yet', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'e2',
      firstName: 'Ben',
      lastName: 'Ng',
      email: 'b@c.com',
      phone: null,
      enquirySource: null,
      enquiryMessage: null,
      intendedPathway: null,
      countryOfResidence: null,
      nationality: null,
      createdAt: new Date('2026-05-19T00:00:00Z'),
      updatedAt: new Date('2026-05-19T00:00:00Z'),
      communications: [],
    });
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ params: Promise.resolve({ enquiryId: 'e2' }) }));
    expect(markup).toContain('No communications have been drafted or sent for this enquiry yet.');
  });
});
