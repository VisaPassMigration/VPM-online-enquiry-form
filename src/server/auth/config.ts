import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

import { db } from '@/server/db';
import { getRoleKeysForStaffUser, normalizeRoleKeys } from '@/server/auth/permissions';

const credentialsSchema = z.object({ email: z.string().email() });

const authSecret =
  process.env.AUTH_SECRET?.trim() ||
  process.env.NEXTAUTH_SECRET?.trim();

const PRISMA_CONNECTIVITY_ERROR_CODES = new Set(['P1000', 'P1001', 'P1002', 'P1008', 'P1010', 'P1011', 'P1017']);

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export function isPrismaConnectivityError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code && PRISMA_CONNECTIVITY_ERROR_CODES.has(code)) return true;

  if (error instanceof Error) {
    return /Can't reach database server|Connection terminated|Timed out fetching a new connection/i.test(error.message);
  }

  return false;
}

export function logStaffLoginDatabaseError(error: unknown) {
  const code = getErrorCode(error) ?? 'unknown';
  const name = error instanceof Error ? error.name : typeof error;

  console.error('[auth] Staff login database connectivity failure.', { code, name });
}

export async function authorizeStaffCredentials(raw: Partial<Record<string, unknown>>) {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return null;

  const email = parsed.data.email.toLowerCase();

  try {
    const staff = await db.staffUser.findUnique({ where: { email } });
    if (!staff || !staff.isActive) return null;

    return { id: staff.authUserId, email: staff.email, name: staff.displayName ?? staff.email };
  } catch (error) {
    if (isPrismaConnectivityError(error)) {
      logStaffLoginDatabaseError(error);
      throw new Error('Staff login is temporarily unavailable. Please try again shortly.');
    }

    console.error('[auth] Staff login authorize() failed (non-connectivity).', {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      code: getErrorCode(error),
    });

    throw error;
  }
}

export const authConfig = {
  secret: authSecret,
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'Staff Email',
      credentials: { email: { label: 'Email', type: 'email' } },
      async authorize(raw) {
        return authorizeStaffCredentials(raw);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) {
        const staff = await db.staffUser.findUnique({ where: { email: user.email.toLowerCase() } });
        token.staffUserId = staff?.id;
        token.authUserId = staff?.authUserId;
        token.isActive = Boolean(staff?.isActive);
        token.roles = staff ? await getRoleKeysForStaffUser(staff.id) : [];
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = String(token.authUserId ?? token.sub ?? '');
      session.user.staffUserId = String(token.staffUserId ?? '');
      session.user.roles = normalizeRoleKeys(Array.isArray(token.roles) ? (token.roles as string[]) : []);
      session.user.isActive = Boolean(token.isActive);
      return session;
    },
  },
} satisfies NextAuthConfig;
