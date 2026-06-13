import { afterEach, describe, expect, it, vi } from 'vitest';

const originalAuthSecret = process.env.AUTH_SECRET;
const originalNextAuthSecret = process.env.NEXTAUTH_SECRET;

function restoreEnv(name: 'AUTH_SECRET' | 'NEXTAUTH_SECRET', value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

describe('Auth.js configuration', () => {
  afterEach(() => {
    vi.resetModules();
    restoreEnv('AUTH_SECRET', originalAuthSecret);
    restoreEnv('NEXTAUTH_SECRET', originalNextAuthSecret);
  });

  it('uses AUTH_SECRET when configured', async () => {
    process.env.AUTH_SECRET = 'auth-secret-for-test';
    process.env.NEXTAUTH_SECRET = 'nextauth-secret-for-test';
    vi.resetModules();

    const { authConfig } = await import('@/server/auth/config');

    expect(authConfig.secret).toBe('auth-secret-for-test');
  });

  it('falls back to NEXTAUTH_SECRET to avoid production runtime sign-in failures during Auth.js migration', async () => {
    delete process.env.AUTH_SECRET;
    process.env.NEXTAUTH_SECRET = 'legacy-nextauth-secret-for-test';
    vi.resetModules();

    const { authConfig } = await import('@/server/auth/config');

    expect(authConfig.secret).toBe('legacy-nextauth-secret-for-test');
  });

  it.each(['', '   '])(
    'falls back to NEXTAUTH_SECRET when AUTH_SECRET is blank or whitespace-only (%j)',
    async (blankAuthSecret) => {
      process.env.AUTH_SECRET = blankAuthSecret;
      process.env.NEXTAUTH_SECRET = 'legacy-nextauth-secret-for-test';
      vi.resetModules();

      const { authConfig } = await import('@/server/auth/config');

      expect(authConfig.secret).toBe('legacy-nextauth-secret-for-test');
    },
  );
});

describe('staff credentials authorize', () => {
  const dbMocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
    getRoleKeysForStaffUser: vi.fn(),
    normalizeRoleKeys: vi.fn((roles: string[]) => roles),
  }));

  vi.mock('@/server/db', () => ({ db: { staffUser: { findUnique: dbMocks.findUnique } } }));
  vi.mock('@/server/auth/permissions', () => ({
    getRoleKeysForStaffUser: dbMocks.getRoleKeysForStaffUser,
    normalizeRoleKeys: dbMocks.normalizeRoleKeys,
  }));

  async function authorize(raw: Partial<Record<string, unknown>>) {
    const { authorizeStaffCredentials } = await import('@/server/auth/config');

    return authorizeStaffCredentials(raw);
  }

  afterEach(() => {
    vi.resetModules();
    dbMocks.findUnique.mockReset();
    dbMocks.getRoleKeysForStaffUser.mockReset();
    dbMocks.normalizeRoleKeys.mockClear();
    vi.restoreAllMocks();
  });

  it('returns null for invalid staff email without weakening staff checks', async () => {
    dbMocks.findUnique.mockResolvedValue(null);

    await expect(authorize({ email: 'missing@example.com' })).resolves.toBeNull();
    expect(dbMocks.findUnique).toHaveBeenCalledWith({ where: { email: 'missing@example.com' } });
  });

  it('returns null for inactive staff users', async () => {
    dbMocks.findUnique.mockResolvedValue({ id: 'staff-1', authUserId: 'auth-1', email: 'inactive@example.com', displayName: 'Inactive Staff', isActive: false });

    await expect(authorize({ email: 'inactive@example.com' })).resolves.toBeNull();
  });

  it('returns the same staff identity for active staff users', async () => {
    dbMocks.findUnique.mockResolvedValue({ id: 'staff-1', authUserId: 'auth-1', email: 'active@example.com', displayName: 'Active Staff', isActive: true });

    await expect(authorize({ email: 'ACTIVE@example.com' })).resolves.toEqual({ id: 'auth-1', email: 'active@example.com', name: 'Active Staff' });
    expect(dbMocks.findUnique).toHaveBeenCalledWith({ where: { email: 'active@example.com' } });
  });

  it('handles Prisma database connectivity failures separately from invalid credentials', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = Object.assign(new Error("Can't reach database server at `example.neon.tech:5432`"), { code: 'P1001' });
    dbMocks.findUnique.mockRejectedValue(error);

    await expect(authorize({ email: 'active@example.com' })).rejects.toThrow('Staff login is temporarily unavailable. Please try again shortly.');
    expect(consoleError).toHaveBeenCalledWith('[auth] Staff login database connectivity failure.', { code: 'P1001', name: 'Error' });
  });
});
