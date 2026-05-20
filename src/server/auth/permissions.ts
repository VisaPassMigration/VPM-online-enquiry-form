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
  REVIEW_SUBMISSION_DOCUMENTS: 'review_submission_documents',
  VIEW_ADMIN_AUDIT_LOG: 'view_admin_audit_log',
  EXPORT_ADMIN_AUDIT_LOG: 'export_admin_audit_log',
  SUGGEST_LEAD_RATING: 'suggest_lead_rating',
  CONFIRM_LEAD_RATING: 'confirm_lead_rating',
  CHANGE_CONFIRMED_LEAD_RATING: 'change_confirmed_lead_rating',
  VIEW_LEAD_RATING: 'view_lead_rating',
  SEND_ENQUIRY_FAQ_EMAIL: 'send_enquiry_faq_email',
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];
export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const UNKNOWN_STAFF_ROLE = 'unknown_staff_role' as const;

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
    PERMISSIONS.REVIEW_SUBMISSION_DOCUMENTS,
    PERMISSIONS.SUGGEST_LEAD_RATING,
    PERMISSIONS.CONFIRM_LEAD_RATING,
    PERMISSIONS.CHANGE_CONFIRMED_LEAD_RATING,
    PERMISSIONS.VIEW_LEAD_RATING,
    PERMISSIONS.SEND_ENQUIRY_FAQ_EMAIL,
  ],
  kenya_intake_staff: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_INTAKE_DETAILS,
    PERMISSIONS.PERFORM_INTERNAL_REVIEW_ACTIONS,
    PERMISSIONS.PREPARE_CLIENT_COMMUNICATION,
    PERMISSIONS.RELEASE_REQUEST_MORE_INFO,
    PERMISSIONS.REVIEW_SUBMISSION_DOCUMENTS,
    PERMISSIONS.SUGGEST_LEAD_RATING,
    PERMISSIONS.VIEW_LEAD_RATING,
    PERMISSIONS.SEND_ENQUIRY_FAQ_EMAIL,
  ],
  australia_migration_team: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_INTAKE_DETAILS,
    PERMISSIONS.PREPARE_CLIENT_COMMUNICATION,
    PERMISSIONS.RELEASE_CONSULTATION_INVITE,
    PERMISSIONS.MANAGE_CONSULTATION_BOOKINGS,
    PERMISSIONS.MARK_CSA_ISSUED,
    PERMISSIONS.MARK_DEPOSIT_PAID,
    PERMISSIONS.REVIEW_SUBMISSION_DOCUMENTS,
    PERMISSIONS.SUGGEST_LEAD_RATING,
    PERMISSIONS.CONFIRM_LEAD_RATING,
    PERMISSIONS.VIEW_LEAD_RATING,
    PERMISSIONS.SEND_ENQUIRY_FAQ_EMAIL,
  ],
  read_only_reviewer: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_INTAKE_DETAILS, PERMISSIONS.VIEW_LEAD_RATING],
};

export function getPermissionsForRoles(roles: RoleKey[]): Set<PermissionKey> {
  return new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []));
}

export function hasPermission(roles: RoleKey[], permission: PermissionKey): boolean {
  return getPermissionsForRoles(roles).has(permission);
}

export function isCanonicalRoleKey(value: string): value is RoleKey {
  return Object.values(ROLES).includes(value as RoleKey);
}

export function normalizeRoleKeys(rawRoles: string[]): RoleKey[] {
  return rawRoles.filter(isCanonicalRoleKey);
}

export function resolveActorRole(rawRoles: string[]): RoleKey | typeof UNKNOWN_STAFF_ROLE {
  const [firstRole] = normalizeRoleKeys(rawRoles);
  return firstRole ?? UNKNOWN_STAFF_ROLE;
}

export async function getRoleKeysForStaffUser(staffUserId: string): Promise<RoleKey[]> {
  const { db } = await import('@/server/db');
  const rows = await db.staffUserRole.findMany({
    where: { staffUserId, revokedAt: null },
    include: { staffRole: true },
  });
  const rawRoleKeys = rows.map((row) => row.staffRole.key);
  const canonicalRoleKeys = normalizeRoleKeys(rawRoleKeys);
  if (canonicalRoleKeys.length !== rawRoleKeys.length) {
    console.warn(
      `[auth] Staff user ${staffUserId} has invalid role keys that were ignored. Please audit staff_role assignments.`,
    );
  }
  return canonicalRoleKeys;
}
