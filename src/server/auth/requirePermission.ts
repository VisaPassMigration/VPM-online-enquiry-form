import { notFound } from 'next/navigation';

import { hasPermission, type PermissionKey, type RoleKey } from '@/server/auth/permissions';
import { requireStaffSession } from '@/server/auth/requireStaffSession';

export async function requirePermission(permission: PermissionKey) {
  const session = await requireStaffSession();
  const roles = (session.user.roles ?? []) as RoleKey[];
  if (!hasPermission(roles, permission)) notFound();
  return session;
}
