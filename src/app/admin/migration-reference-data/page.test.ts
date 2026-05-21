import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), requirePermission: vi.fn(), findMany: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/server/db', () => ({ db: { migrationReferenceDataset: { findMany: mocks.findMany } } }));

describe('migration reference admin page', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { roles: ['boss_admin'] } }); mocks.findMany.mockResolvedValue([]); });
  it('admin page renders', async () => { const page = (await import('./page')).default; const result = await page(); expect(result).toBeTruthy(); });
  it('permission-gated access', async () => { mocks.auth.mockResolvedValueOnce({ user: { roles: ['read_only_reviewer'] } }); const page = (await import('./page')).default; await page(); expect(mocks.requirePermission).toHaveBeenCalled(); });
});
