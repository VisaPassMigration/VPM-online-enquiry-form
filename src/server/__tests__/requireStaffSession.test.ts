import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

describe('requireStaffSession', () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.redirect.mockClear();
  });

  it('redirects unauthenticated staff entry to sign in with a dashboard callback', async () => {
    mocks.auth.mockResolvedValue(null);
    const { requireStaffSession } = await import('@/server/auth/requireStaffSession');

    await expect(requireStaffSession()).rejects.toThrow('redirect:/api/auth/signin?callbackUrl=%2Fdashboard');
    expect(mocks.redirect).toHaveBeenCalledWith('/api/auth/signin?callbackUrl=%2Fdashboard');
  });

  it('returns active staff sessions without redirecting', async () => {
    const session = { user: { staffUserId: 'staff-1', isActive: true } };
    mocks.auth.mockResolvedValue(session);
    const { requireStaffSession } = await import('@/server/auth/requireStaffSession');

    await expect(requireStaffSession()).resolves.toBe(session);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
