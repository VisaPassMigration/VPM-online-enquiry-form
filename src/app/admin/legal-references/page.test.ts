import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), findMany: vi.fn() }));
vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/server/db', () => ({ db: { legalReference: { findMany: mocks.findMany } } }));

beforeEach(() => { vi.clearAllMocks(); mocks.findMany.mockResolvedValue([{ id: 'l1', sectionOrSchedule: 's48', referenceType: 'act_section', topic: 'section_48_bar', status: 'approved', sourceUrl: 'https://example.com', sourceDate: new Date('2026-05-20T00:00:00Z'), legendComReference: 'LEG-1', reviewedByStaffUserId: 's1', reviewedAt: new Date('2026-05-20T01:00:00Z'), approvedByStaffUserId: 's2', approvedAt: new Date('2026-05-20T02:00:00Z') }]); });

describe('legal references admin page', () => {
  it('renders read-only list and governance warning', async () => { const page = (await import('./page')).default; const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) })); expect(html).toContain('Legal Reference Library is internal guidance only'); expect(html).toContain('Apply filters'); expect(html).toContain('type/topic/status'); expect(html).toContain('reviewedBy/At'); expect(html).toContain('approvedBy/At'); });
  it('requires view permission', async () => { const page = (await import('./page')).default; await page({ searchParams: Promise.resolve({}) }); expect(mocks.requirePermission).toHaveBeenCalled(); });
  it('invalid URL filter values safely fall back to no filter', async () => {
    const page = (await import('./page')).default;
    await page({ searchParams: Promise.resolve({ topic: 'invalid', referenceType: 'bad', status: 'wat' }) });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});
