export const ROLES = {
  BOSS_ADMIN: 'boss_admin',
  SENIOR_STAFF: 'senior_staff',
  KENYA_INTAKE_STAFF: 'kenya_intake_staff',
  AUSTRALIA_MIGRATION_TEAM: 'australia_migration_team',
  READ_ONLY_REVIEWER: 'read_only_reviewer',
} as const;

export const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_INTAKE_DETAILS: 'view_intake_details',
  PERFORM_INTERNAL_REVIEW_ACTIONS: 'perform_internal_review_actions',
  PREPARE_CLIENT_COMMUNICATION: 'prepare_client_communication',
  RELEASE_REQUEST_MORE_INFO: 'release_request_more_info',
  RELEASE_CONSULTATION_INVITE: 'release_consultation_invite',
  MANAGE_CONSULTATION_BOOKINGS: 'manage_consultation_bookings',
  MARK_CSA_ISSUED: 'mark_csa_issued',
  MARK_DEPOSIT_PAID: 'mark_deposit_paid',
  VIEW_ADMIN_AUDIT_LOG: 'view_admin_audit_log',
  EXPORT_ADMIN_AUDIT_LOG: 'export_admin_audit_log',
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];
export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  boss_admin: Object.values(PERMISSIONS),
  senior_staff: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_INTAKE_DETAILS,
    PERMISSIONS.PERFORM_INTERNAL_REVIEW_ACTIONS,
    PERMISSIONS.PREPARE_CLIENT_COMMUNICATION,
    PERMISSIONS.RELEASE_REQUEST_MORE_INFO,
    PERMISSIONS.RELEASE_CONSULTATION_INVITE,
    PERMISSIONS.MANAGE_CONSULTATION_BOOKINGS,
    PERMISSIONS.MARK_CSA_ISSUED,
    PERMISSIONS.MARK_DEPOSIT_PAID,
  ],
  kenya_intake_staff: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_INTAKE_DETAILS,
    PERMISSIONS.PERFORM_INTERNAL_REVIEW_ACTIONS,
    PERMISSIONS.PREPARE_CLIENT_COMMUNICATION,
    PERMISSIONS.RELEASE_REQUEST_MORE_INFO,
  ],
  australia_migration_team: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_INTAKE_DETAILS,
    PERMISSIONS.PREPARE_CLIENT_COMMUNICATION,
    PERMISSIONS.RELEASE_CONSULTATION_INVITE,
    PERMISSIONS.MANAGE_CONSULTATION_BOOKINGS,
    PERMISSIONS.MARK_CSA_ISSUED,
    PERMISSIONS.MARK_DEPOSIT_PAID,
  ],
  read_only_reviewer: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_INTAKE_DETAILS],
};

export function getPermissionsForRoles(roles: RoleKey[]): Set<PermissionKey> {
  return new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []));
}

export function hasPermission(roles: RoleKey[], permission: PermissionKey): boolean {
  return getPermissionsForRoles(roles).has(permission);
}

export async function getRoleKeysForStaffUser(staffUserId: string): Promise<RoleKey[]> {
  const { db } = await import('@/server/db');
  const rows = await db.staffUserRole.findMany({
    where: { staffUserId, revokedAt: null },
    include: { staffRole: true },
  });
  return rows.map((row) => row.staffRole.key as RoleKey);
}
