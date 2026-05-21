import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), requirePermission: vi.fn(), findMany: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/server/db', () => ({ db: { migrationReferenceDataset: { findMany: mocks.findMany } } }));

const datasetRow = {
  id: 'ds_1',
  datasetVersion: 'v2026.05',
  status: 'draft',
  sourceSummary: 'Dept source',
  importedAt: new Date('2026-05-20T10:00:00.000Z'),
  reviewedByStaffUserId: 'staff-1',
  reviewedAt: new Date('2026-05-20T11:00:00.000Z'),
  approvedByStaffUserId: 'staff-2',
  approvedAt: new Date('2026-05-20T12:00:00.000Z'),
  staleAt: new Date('2026-05-20T13:00:00.000Z'),
  notes: 'notes',
  occupationReferences: [],
  costReferences: [],
};

describe('migration reference admin page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { roles: ['boss_admin'] } });
    mocks.findMany.mockResolvedValue([datasetRow]);
  });

  it('renders all clarity sections and mutation forms for authorised staff', async () => {
    const page = (await import('./page')).default;
    const html = renderToStaticMarkup(await page());
    ['Dataset Overview', 'Dataset Lifecycle Actions', 'Occupation References', 'Cost References', 'Governance Notes'].forEach((t) => expect(html).toContain(t));
    ['Create dataset', 'Mark reviewed', 'Approve dataset', 'Mark stale', 'Archive dataset', 'Add occupation reference', 'Add cost reference'].forEach((t) => expect(html).toContain(t));
    expect(html).toContain('Required internal reason/note');
    expect(html).toContain('does not scrape, auto-sync, or verify live government data');
  });

  it('renders status badges', async () => {
    const page = (await import('./page')).default;
    const html = renderToStaticMarkup(await page());
    expect(html).toContain('status-chip status-chip-draft');
    expect(html).toContain('draft');
  });

  it('read_only_reviewer cannot see mutation forms', async () => {
    mocks.auth.mockResolvedValueOnce({ user: { roles: ['read_only_reviewer'] } });
    const page = (await import('./page')).default;
    const html = renderToStaticMarkup(await page());
    expect(html).not.toContain('Create dataset');
    expect(html).not.toContain('Add occupation reference');
    expect(html).not.toContain('Add cost reference');
  });

  it('permission-gated access remains enforced', async () => {
    const page = (await import('./page')).default;
    await page();
    expect(mocks.requirePermission).toHaveBeenCalled();
  });
});
