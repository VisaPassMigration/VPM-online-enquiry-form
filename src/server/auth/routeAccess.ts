import { hasPermission, PERMISSIONS, type RoleKey } from './permissions';

export function canAccessPath(pathname: string, isActiveStaff: boolean, roles: RoleKey[]): boolean {
  if (pathname.startsWith('/intake')) return true;
  if (pathname.startsWith('/dashboard/intakes/')) return isActiveStaff && hasPermission(roles, PERMISSIONS.VIEW_INTAKE_DETAILS);
  if (pathname.startsWith('/dashboard')) return isActiveStaff && hasPermission(roles, PERMISSIONS.VIEW_DASHBOARD);
  if (pathname.startsWith('/admin/audit-log')) return isActiveStaff && hasPermission(roles, PERMISSIONS.VIEW_ADMIN_AUDIT_LOG);
  return true;
}
