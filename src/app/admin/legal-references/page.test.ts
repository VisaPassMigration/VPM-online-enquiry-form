import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requirePermission: vi.fn(),
  findMany: vi.fn(),
  createLegalReference: vi.fn(),
  updateLegalReference: vi.fn(),
  markLegalReferenceReviewed: vi.fn(),
  approveLegalReference: vi.fn(),
  markLegalReferenceStale: vi.fn(),
  archiveLegalReference: vi.fn(),
  requireStaffSession: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/server/db', () => ({ db: { legalReference: { findMany: mocks.findMany } } }));
vi.mock('@/server/legalReferences', () => ({
  createLegalReference: mocks.createLegalReference,
  updateLegalReference: mocks.updateLegalReference,
  markLegalReferenceReviewed: mocks.markLegalReferenceReviewed,
  approveLegalReference: mocks.approveLegalReference,
  markLegalReferenceStale: mocks.markLegalReferenceStale,
  archiveLegalReference: mocks.archiveLegalReference,
}));
vi.mock('@/server/auth/requireStaffSession', () => ({ requireStaffSession: mocks.requireStaffSession }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { roles: ['boss_admin'] } });
  mocks.requireStaffSession.mockResolvedValue({ user: { staffUserId: 'staff-1', name: 'Staff One', email: 'staff@example.com', roles: ['boss_admin'] } });
  mocks.findMany.mockResolvedValue([{ id: 'l1', jurisdiction: 'AU', summary: 'sum', sectionOrSchedule: 's48', referenceType: 'act_section', topic: 'section_48_bar', status: 'draft', sourceUrl: 'https://example.com', sourceDate: new Date('2026-05-20T00:00:00Z'), legendComReference: 'LEG-1', reviewedByStaffUserId: 's1', reviewedAt: new Date('2026-05-20T01:00:00Z'), approvedByStaffUserId: 's2', approvedAt: new Date('2026-05-20T02:00:00Z') }]);
});

describe('legal references admin page', () => {
  it('renders governance warnings', async () => {
    const page = (await import('./page')).default;
    const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('Legal references are internal guidance only');
    expect(html).toContain('Do not paste large LEGENDcom or policy extracts');
  });

  it('renders create/update forms for authorised manage users', async () => {
    const page = (await import('./page')).default;
    const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('Create Legal Reference');
    expect(html).toContain('Update Legal Reference');
    expect(html).toContain('Create legal reference');
    expect(html).toContain('Update legal reference');
  });

  it('renders lifecycle forms for authorised users and approve only for approve permission', async () => {
    const page = (await import('./page')).default;
    let html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('Mark reviewed');
    expect(html).toContain('Mark stale');
    expect(html).toContain('Archive');
    expect(html).toContain('Approve');

    mocks.auth.mockResolvedValue({ user: { roles: ['australia_migration_team'] } });
    html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    expect(html).not.toContain('Approve');
  });

  it('read_only_reviewer cannot see mutation forms', async () => {
    const page = (await import('./page')).default;
    mocks.auth.mockResolvedValue({ user: { roles: ['read_only_reviewer'] } });
    const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    expect(html).not.toContain('Create Legal Reference');
    expect(html).not.toContain('Update Legal Reference');
    expect(html).not.toContain('Lifecycle Actions');
  });

  it('requires view permission', async () => {
    const page = (await import('./page')).default;
    await page({ searchParams: Promise.resolve({}) });
    expect(mocks.requirePermission).toHaveBeenCalled();
  });

  it('invalid URL filter values safely fall back to no filter', async () => {
    const page = (await import('./page')).default;
    await page({ searchParams: Promise.resolve({ topic: 'invalid', referenceType: 'bad', status: 'wat' }) });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('create action calls createLegalReference', async () => {
    const { runMutationAction } = await import('./page');
    const form = new FormData();
    form.set('action', 'create_legal_reference');
    form.set('reason', 'internal reason');
    form.set('referenceType', 'act_section'); form.set('jurisdiction', 'AU'); form.set('sectionOrSchedule', 's48'); form.set('topic', 'section_48_bar'); form.set('summary', 'summary');
    await runMutationAction(form);
    expect(mocks.createLegalReference).toHaveBeenCalled();
  });

  it('update action calls updateLegalReference', async () => {
    const { runMutationAction } = await import('./page');
    const form = new FormData();
    form.set('action', 'update_legal_reference'); form.set('legalReferenceId', 'l1'); form.set('reason', 'internal reason');
    form.set('referenceType', 'act_section'); form.set('jurisdiction', 'AU'); form.set('sectionOrSchedule', 's48'); form.set('topic', 'section_48_bar'); form.set('summary', 'summary');
    await runMutationAction(form);
    expect(mocks.updateLegalReference).toHaveBeenCalled();
  });

  it('review/approve/stale/archive actions call corresponding services', async () => {
    const { runMutationAction } = await import('./page');
    for (const action of ['mark_reviewed', 'approve', 'mark_stale', 'archive']) {
      const form = new FormData();
      form.set('action', action); form.set('legalReferenceId', 'l1'); form.set('reason', 'internal reason');
      await runMutationAction(form);
    }
    expect(mocks.markLegalReferenceReviewed).toHaveBeenCalled();
    expect(mocks.approveLegalReference).toHaveBeenCalled();
    expect(mocks.markLegalReferenceStale).toHaveBeenCalled();
    expect(mocks.archiveLegalReference).toHaveBeenCalled();
  });

  it('missing internal reason is blocked', async () => {
    mocks.createLegalReference.mockRejectedValueOnce(new Error('Internal note/reason is required.'));
    const { runMutationAction } = await import('./page');
    const form = new FormData();
    form.set('action', 'create_legal_reference');
    form.set('referenceType', 'act_section'); form.set('jurisdiction', 'AU'); form.set('sectionOrSchedule', 's48'); form.set('topic', 'section_48_bar'); form.set('summary', 'summary');
    await expect(runMutationAction(form)).rejects.toThrow('Internal note/reason is required.');
  });

  it('does not introduce scraping/live fetch/legal advice/client exposure text', async () => {
    const page = (await import('./page')).default;
    const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('No LEGENDcom scraping');
    expect(html).toContain('no live policy fetching');
    expect(html).toContain('No client-facing sharing');
  });
});
