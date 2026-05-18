import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

import { db } from '@/server/db';
import { getRoleKeysForStaffUser } from '@/server/auth/permissions';

const credentialsSchema = z.object({ email: z.string().email() });

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'Staff Email',
      credentials: { email: { label: 'Email', type: 'email' } },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const staff = await db.staffUser.findUnique({ where: { email } });
        if (!staff || !staff.isActive) return null;

        return { id: staff.authUserId, email: staff.email, name: staff.displayName ?? staff.email };
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
      session.user.roles = Array.isArray(token.roles) ? (token.roles as string[]) : [];
      session.user.isActive = Boolean(token.isActive);
      return session;
    },
  },
});
