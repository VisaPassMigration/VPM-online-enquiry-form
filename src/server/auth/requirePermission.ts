import { notFound } from 'next/navigation';

import { hasPermission, normalizeRoleKeys, type PermissionKey } from '@/server/auth/permissions';
import { requireStaffSession } from '@/server/auth/requireStaffSession';

export async function requirePermission(permission: PermissionKey) {
  const session = await requireStaffSession();
  const roles = normalizeRoleKeys(session.user.roles ?? []);
  if (!hasPermission(roles, permission)) notFound();
  return session;
}
