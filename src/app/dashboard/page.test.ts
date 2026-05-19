import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  findMany: vi.fn(),
  getConsultsBookedToday: vi.fn(),
  getConsultsBookedThisWeek: vi.fn(),
  getConsultsCompletedThisWeek: vi.fn(),
  getNoShowsThisWeek: vi.fn(),
  getCancellationsThisWeek: vi.fn(),
  getRemainingWeeklyCapacity: vi.fn(),
  getCompletedToCsaIssuedConversion: vi.fn(),
  getCsaIssuedToDepositPaidConversion: vi.fn(),
  getSeniorStaffCapacityRows: vi.fn(),
  getUpcomingConsultations: vi.fn(),
}));

vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/server/db', () => ({ db: { intakeSubmission: { findMany: mocks.findMany } } }));
vi.mock('@/server/consultationKpis', () => ({
  getConsultsBookedToday: mocks.getConsultsBookedToday,
  getConsultsBookedThisWeek: mocks.getConsultsBookedThisWeek,
  getConsultsCompletedThisWeek: mocks.getConsultsCompletedThisWeek,
  getNoShowsThisWeek: mocks.getNoShowsThisWeek,
  getCancellationsThisWeek: mocks.getCancellationsThisWeek,
  getRemainingWeeklyCapacity: mocks.getRemainingWeeklyCapacity,
  getCompletedToCsaIssuedConversion: mocks.getCompletedToCsaIssuedConversion,
  getCsaIssuedToDepositPaidConversion: mocks.getCsaIssuedToDepositPaidConversion,
  getSeniorStaffCapacityRows: mocks.getSeniorStaffCapacityRows,
  getUpcomingConsultations: mocks.getUpcomingConsultations,
}));

describe('dashboard lead rating UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getConsultsBookedToday.mockResolvedValue(0);
    mocks.getConsultsBookedThisWeek.mockResolvedValue(0);
    mocks.getConsultsCompletedThisWeek.mockResolvedValue(0);
    mocks.getNoShowsThisWeek.mockResolvedValue(0);
    mocks.getCancellationsThisWeek.mockResolvedValue(0);
    mocks.getRemainingWeeklyCapacity.mockResolvedValue(0);
    mocks.getCompletedToCsaIssuedConversion.mockResolvedValue({ conversionRate: 0, csaIssued: 0, completed: 0 });
    mocks.getCsaIssuedToDepositPaidConversion.mockResolvedValue({ conversionRate: 0, depositPaid: 0, csaIssued: 0 });
    mocks.getSeniorStaffCapacityRows.mockResolvedValue([]);
    mocks.getUpcomingConsultations.mockResolvedValue([]);
    mocks.findMany.mockResolvedValue([
      { id: 'sub-hot', submittedAt: new Date(), createdAt: new Date(), payload: { firstName: 'Hot', lastName: 'Lead' }, pointsSnapshots: [], riskFlags: [], status: 'submitted', currentReviewState: null, updatedAt: new Date(), leadRating: 'hot' },
      { id: 'sub-warm', submittedAt: new Date(), createdAt: new Date(), payload: { firstName: 'Warm', lastName: 'Lead' }, pointsSnapshots: [], riskFlags: [], status: 'submitted', currentReviewState: null, updatedAt: new Date(), leadRating: 'warm' },
      { id: 'sub-cold', submittedAt: new Date(), createdAt: new Date(), payload: { firstName: 'Cold', lastName: 'Lead' }, pointsSnapshots: [], riskFlags: [], status: 'submitted', currentReviewState: null, updatedAt: new Date(), leadRating: 'cold' },
      { id: 'sub-escalate', submittedAt: new Date(), createdAt: new Date(), payload: { firstName: 'Escalate', lastName: 'Lead' }, pointsSnapshots: [], riskFlags: [], status: 'submitted', currentReviewState: null, updatedAt: new Date(), leadRating: 'escalate' },
      { id: 'sub-none', submittedAt: new Date(), createdAt: new Date(), payload: { firstName: 'Not', lastName: 'Rated' }, pointsSnapshots: [], riskFlags: [], status: 'submitted', currentReviewState: null, updatedAt: new Date(), leadRating: null },
    ]);
  });

  it('shows rating counts, filter placeholder, and table column', async () => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('Hot leads');
    expect(markup).toContain('Warm leads');
    expect(markup).toContain('Cold leads');
    expect(markup).toContain('Escalate leads');
    expect(markup).toContain('Lead Rating');
    expect(markup).toContain('Hot');
    expect(markup).toContain('Clear filters');
    expect(markup).toContain('Active filter: All lead ratings');
    expect(markup).toContain('Lead ratings are internal triage classifications and are not client outcomes.');
  });

  it.each([
    ['hot', 'Hot Lead', 'Warm Lead'],
    ['warm', 'Warm Lead', 'Cold Lead'],
    ['cold', 'Cold Lead', 'Escalate Lead'],
    ['escalate', 'Escalate Lead', 'Not Rated'],
    ['not_rated', 'Not Rated', 'Hot Lead'],
  ])('filters rows for %s', async (filter, expectedName, unexpectedName) => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ leadRating: filter }) }));
    expect(markup).toContain(expectedName);
    expect(markup).not.toContain(unexpectedName);
  });

  it('clear filters resets view to all rows', async () => {
    const page = (await import('./page')).default;
    const filteredMarkup = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ leadRating: 'hot' }) }));
    expect(filteredMarkup).not.toContain('Warm Lead');

    const resetMarkup = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    expect(resetMarkup).toContain('Hot Lead');
    expect(resetMarkup).toContain('Warm Lead');
    expect(resetMarkup).toContain('Cold Lead');
    expect(resetMarkup).toContain('Escalate Lead');
    expect(resetMarkup).toContain('Not Rated');
  });
});
