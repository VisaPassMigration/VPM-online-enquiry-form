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
    mocks.findMany.mockResolvedValue([{ id: 'sub-1', submittedAt: new Date(), createdAt: new Date(), payload: { firstName: 'A', lastName: 'B' }, pointsSnapshots: [], riskFlags: [], status: 'submitted', currentReviewState: null, updatedAt: new Date(), leadRating: 'hot' }]);
  });

  it('shows rating counts, filter placeholder, and table column', async () => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page());

    expect(markup).toContain('Hot leads');
    expect(markup).toContain('Warm leads');
    expect(markup).toContain('Cold leads');
    expect(markup).toContain('Escalate leads');
    expect(markup).toContain('Lead Rating');
    expect(markup).toContain('Hot');
  });
});
