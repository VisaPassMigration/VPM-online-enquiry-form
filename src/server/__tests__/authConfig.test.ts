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
