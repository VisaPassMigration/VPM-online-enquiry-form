import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  findMany: vi.fn(),
  staffTaskFindMany: vi.fn(),
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
  auth: vi.fn(),
}));

vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/server/db', () => ({ db: { intakeSubmission: { findMany: mocks.findMany }, staffTask: { findMany: mocks.staffTaskFindMany } } }));
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
vi.mock('@/auth', () => ({ auth: mocks.auth }));

describe('dashboard lead rating UI', () => {
  const submittedSectionOnly = (markup: string) => markup.slice(markup.indexOf('<h3>Submitted enquiries</h3>'));
  const taskSectionOnly = (markup: string) => markup.slice(markup.indexOf('<h3>Staff Task Operations</h3>'), markup.indexOf('<h3>Intake KPI snapshot</h3>'));
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T12:00:00.000Z'));
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
    mocks.auth.mockResolvedValue({ user: { staffUserId: 'staff-a' } });
    const now = new Date('2026-05-19T12:00:00.000Z');
    mocks.findMany.mockResolvedValue([
      { id: 'sub-cold', submittedAt: new Date('2026-05-19T01:00:00.000Z'), createdAt: now, payload: { firstName: 'Cold', lastName: 'Lead' }, pointsSnapshots: [], riskFlags: [], status: 'submitted', currentReviewState: null, updatedAt: now, leadRating: 'cold', leadRatingReason: null },
      { id: 'sub-none', submittedAt: new Date('2026-05-19T02:00:00.000Z'), createdAt: now, payload: { firstName: 'Not', lastName: 'Rated' }, pointsSnapshots: [], riskFlags: [], status: 'submitted', currentReviewState: null, updatedAt: now, leadRating: null, leadRatingReason: 'AI suggestion pending staff confirmation' },
      { id: 'sub-warm', submittedAt: new Date('2026-05-19T03:00:00.000Z'), createdAt: now, payload: { firstName: 'Warm', lastName: 'Lead' }, pointsSnapshots: [], riskFlags: [], status: 'submitted', currentReviewState: null, updatedAt: now, leadRating: 'warm', leadRatingReason: 'Some supporting docs missing' },
      { id: 'sub-hot', submittedAt: new Date('2026-05-19T04:00:00.000Z'), createdAt: now, payload: { firstName: 'Hot', lastName: 'Lead' }, pointsSnapshots: [], riskFlags: [], status: 'submitted', currentReviewState: null, updatedAt: now, leadRating: 'hot', leadRatingReason: 'High points and complete profile' },
      { id: 'sub-escalate', submittedAt: new Date('2026-05-19T05:00:00.000Z'), createdAt: now, payload: { firstName: 'Escalate', lastName: 'Lead' }, pointsSnapshots: [], riskFlags: [], status: 'submitted', currentReviewState: null, updatedAt: now, leadRating: 'escalate', leadRatingReason: 'Risk flag requires senior decision' },
    ]);
    mocks.staffTaskFindMany.mockResolvedValue([
      { id: 'task-1', title: 'Urgent overdue escalate', taskType: 'risk_review', priority: 'urgent', status: 'open', dueDate: new Date('2026-05-18T00:00:00.000Z'), assignedStaffName: 'A', assignedStaffUserId: 'staff-a', createdAt: new Date('2026-05-19T10:00:00.000Z'), submission: { id: 'sub-escalate', payload: { firstName: 'Escalate', lastName: 'Lead' }, leadRating: 'escalate' } },
      { id: 'task-2', title: 'High due today hot', taskType: 'follow_up', priority: 'high', status: 'in_progress', dueDate: new Date('2026-05-19T20:00:00.000Z'), assignedStaffName: 'B', assignedStaffUserId: 'staff-b', createdAt: new Date('2026-05-19T09:00:00.000Z'), submission: { id: 'sub-hot', payload: { firstName: 'Hot', lastName: 'Lead' }, leadRating: 'hot' } },
      { id: 'task-3', title: 'Normal due week', taskType: 'doc_check', priority: 'normal', status: 'in_progress', dueDate: new Date('2026-05-21T20:00:00.000Z'), assignedStaffName: 'C', assignedStaffUserId: 'staff-c', createdAt: new Date('2026-05-18T09:00:00.000Z'), submission: null },
      { id: 'task-4', title: 'Low no due unassigned', taskType: 'admin_check', priority: 'low', status: 'completed', dueDate: null, assignedStaffName: null, assignedStaffUserId: null, createdAt: new Date('2026-05-17T09:00:00.000Z'), submission: { id: 'sub-none', payload: { firstName: 'Not', lastName: 'Rated' }, leadRating: null } },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows rating counts, filter placeholder, and table column', async () => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('Hot leads');
    expect(markup).toContain('Warm leads');
    expect(markup).toContain('Cold leads');
    expect(markup).toContain('Escalate leads');
    expect(markup).toContain('Not Rated leads');
    expect(markup).toContain('Lead Rating');
    expect(markup).toContain('Lead Rating Reason');
    expect(markup).toContain('Next Action Hint');
    expect(markup).toContain('Hot');
    expect(markup).toContain('Clear filters');
    expect(markup).toContain('Active filter: All lead ratings');
    expect(markup).toContain('Lead ratings are internal triage classifications and are not client outcomes.');
    expect(markup).toContain('Lead rating and next-action hints are internal workflow aids only. They are not client outcomes.');
  });

  it('shows next action hints and rating reason previews', async () => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('Senior risk review required');
    expect(markup).toContain('Prioritise review / consultation pathway review');
    expect(markup).toContain('Check missing info or documents');
    expect(markup).toContain('Low priority review / confirm hold if appropriate');
    expect(markup).toContain('Generate/confirm rating');
    expect(markup).toContain('Some supporting docs missing');
    expect(markup).toContain('AI suggestion pending staff confirmation');
  });

  it('sorts enquiries by triage priority then newest submitted date', async () => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    const order = ['sub-escalate', 'sub-hot', 'sub-warm', 'sub-none', 'sub-cold'];
    const indices = order.map((id) => markup.indexOf(`/dashboard/intakes/${id}`));
    indices.forEach((index) => expect(index).toBeGreaterThan(-1));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  it.each([
    ['hot', 'Hot Lead', 'Warm Lead'],
    ['warm', 'Warm Lead', 'Cold Lead'],
    ['cold', 'Cold Lead', 'Escalate Lead'],
    ['escalate', 'Escalate Lead', 'Hot Lead'],
    ['not_rated', 'Not Rated', 'Hot Lead'],
  ])('filters rows for %s', async (filter, expectedName, unexpectedName) => {
    const page = (await import('./page')).default;
    const markup = submittedSectionOnly(renderToStaticMarkup(await page({ searchParams: Promise.resolve({ leadRating: filter }) })));
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

  it('renders staff task KPI cards and indicators', async () => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain('Staff Task Operations');
    expect(markup).toContain('My open tasks');
    expect(markup).toContain('Overdue tasks');
    expect(markup).toContain('Due today');
    expect(markup).toContain('Due this week');
    expect(markup).toContain('Urgent tasks');
    expect(markup).toContain('Tasks linked to Hot leads');
    expect(markup).toContain('Tasks linked to Escalate leads');
    expect(markup).toContain('Unassigned tasks');
    expect(markup).toContain('OVERDUE');
    expect(markup).toContain('DUE TODAY');
    expect(markup).toContain('URGENT');
    expect(markup).toContain('HOT LEAD');
    expect(markup).toContain('ESCALATE LEAD');
    expect(markup).toContain('They do not send client communications or create calendar events.');
  });
  it('renders staff workload summary table and counts by staff', async () => {
    const page = (await import('./page')).default;
    const markup = taskSectionOnly(renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) })));
    expect(markup).toContain('Staff member');
    expect(markup).toContain('<td>A</td><td>1</td><td>0</td><td>1</td><td>1</td><td>0</td><td>1</td><td>0</td><td>1</td>');
    expect(markup).toContain('<td>B</td><td>0</td><td>1</td><td>0</td><td>1</td><td>1</td><td>1</td><td>1</td><td>0</td>');
  });

  it('my tasks uses session staff user id where available and falls back safely', async () => {
    const page = (await import('./page')).default;
    const myTasks = taskSectionOnly(renderToStaticMarkup(await page({ searchParams: Promise.resolve({ taskView: 'my' }) })));
    expect(myTasks).toContain('Urgent overdue escalate');
    expect(myTasks).not.toContain('High due today hot');

    mocks.auth.mockResolvedValue({ user: {} });
    const fallback = taskSectionOnly(renderToStaticMarkup(await page({ searchParams: Promise.resolve({ taskView: 'my' }) })));
    expect(fallback).toContain('My Tasks view is unavailable because your staff session ID could not be resolved. Showing all tasks for safety.');
    expect(fallback).toContain('High due today hot');
  });

  it('keeps dashboard tasks read-only and does not trigger client communication', async () => {
    const page = (await import('./page')).default;
    const markup = taskSectionOnly(renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) })));
    expect(markup).not.toContain('Create task');
    expect(markup).not.toContain('Complete');
    expect(markup).not.toContain('Cancel');
    expect(markup).toContain('They do not send client communications or create calendar events.');
  });

  it('sorts tasks overdue first, then priority, then due soonest', async () => {
    const page = (await import('./page')).default;
    const markup = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    const order = ['Urgent overdue escalate', 'High due today hot', 'Normal due week'];
    const indices = order.map((label) => markup.indexOf(label));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  it('applies task status filter', async () => {
    const page = (await import('./page')).default;
    const markup = taskSectionOnly(renderToStaticMarkup(await page({ searchParams: Promise.resolve({ taskStatus: 'completed' }) })));
    expect(markup).toContain('Low no due unassigned');
    expect(markup).not.toContain('Urgent overdue escalate');
  });

  it('applies task priority filter', async () => {
    const page = (await import('./page')).default;
    const markup = taskSectionOnly(renderToStaticMarkup(await page({ searchParams: Promise.resolve({ taskPriority: 'high' }) })));
    expect(markup).toContain('High due today hot');
    expect(markup).not.toContain('Urgent overdue escalate');
  });

  it('applies overdue, due today, due this week, and no due date task filters', async () => {
    const page = (await import('./page')).default;
    const overdue = taskSectionOnly(renderToStaticMarkup(await page({ searchParams: Promise.resolve({ taskDueScope: 'overdue' }) })));
    const dueToday = taskSectionOnly(renderToStaticMarkup(await page({ searchParams: Promise.resolve({ taskDueScope: 'due_today' }) })));
    const dueThisWeek = taskSectionOnly(renderToStaticMarkup(await page({ searchParams: Promise.resolve({ taskDueScope: 'due_this_week' }) })));
    const noDueDate = taskSectionOnly(renderToStaticMarkup(await page({ searchParams: Promise.resolve({ taskDueScope: 'no_due_date' }) })));
    expect(overdue).toContain('Urgent overdue escalate');
    expect(dueToday).toContain('High due today hot');
    expect(dueThisWeek).toContain('Normal due week');
    expect(noDueDate).toContain('Low no due unassigned');
  });

  it('applies task lead rating and unassigned filters', async () => {
    const page = (await import('./page')).default;
    const leadRating = taskSectionOnly(renderToStaticMarkup(await page({ searchParams: Promise.resolve({ taskLeadRating: 'escalate' }) })));
    const unassigned = taskSectionOnly(renderToStaticMarkup(await page({ searchParams: Promise.resolve({ taskAssignee: 'unassigned' }) })));
    expect(leadRating).toContain('Urgent overdue escalate');
    expect(leadRating).not.toContain('High due today hot');
    expect(unassigned).toContain('Low no due unassigned');
    expect(unassigned).not.toContain('Urgent overdue escalate');
  });

  it('clear task filters resets task list and keeps communications internal-only', async () => {
    const page = (await import('./page')).default;
    const filtered = taskSectionOnly(renderToStaticMarkup(await page({ searchParams: Promise.resolve({ taskStatus: 'completed' }) })));
    expect(filtered).not.toContain('Urgent overdue escalate');
    expect(filtered).toContain('Clear Task Filters');
    const reset = taskSectionOnly(renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) })));
    expect(reset).toContain('Urgent overdue escalate');
    expect(reset).toContain('High due today hot');
    expect(reset).toContain('They do not send client communications or create calendar events.');
  });
});
