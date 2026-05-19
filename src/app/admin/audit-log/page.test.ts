import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('@/server/db', () => ({ db: { auditEvent: { findMany: mocks.findMany } } }));

describe('admin audit log filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
  });

  it('supports actorStaffUserId filter', async () => {
    const page = (await import('./page')).default;
    await page({ searchParams: Promise.resolve({ actorStaffUserId: 'staff-1' }) });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actorStaffUserId: { equals: 'staff-1', mode: 'insensitive' },
        }),
      }),
    );
  });
});
