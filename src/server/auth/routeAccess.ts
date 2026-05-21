import { hasPermission, PERMISSIONS, type RoleKey } from './permissions';

export function canAccessPath(pathname: string, isActiveStaff: boolean, roles: RoleKey[]): boolean {
  if (pathname.startsWith('/intake')) return true;
  if (pathname.startsWith('/dashboard/intakes/')) return isActiveStaff && hasPermission(roles, PERMISSIONS.VIEW_INTAKE_DETAILS);
  if (pathname.startsWith('/dashboard')) return isActiveStaff && hasPermission(roles, PERMISSIONS.VIEW_DASHBOARD);
  if (pathname.startsWith('/admin/audit-log')) return isActiveStaff && hasPermission(roles, PERMISSIONS.VIEW_ADMIN_AUDIT_LOG);
  if (pathname.startsWith('/admin/migration-reference-data')) return isActiveStaff && hasPermission(roles, PERMISSIONS.VIEW_MIGRATION_REFERENCE_DATA);
  if (pathname.startsWith('/admin')) return isActiveStaff && roles.includes('boss_admin');
  return true;
}
