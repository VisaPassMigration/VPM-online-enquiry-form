import { describe, expect, it } from 'vitest';

import { canAccessPath } from '@/server/auth/routeAccess';
import { hasPermission, normalizeRoleKeys, PERMISSIONS, resolveActorRole } from '@/server/auth/permissions';

describe('permission matrix', () => {
  it('boss_admin can view audit log', () => {
    expect(hasPermission(['boss_admin'], PERMISSIONS.VIEW_ADMIN_AUDIT_LOG)).toBe(true);
    expect(canAccessPath('/admin/audit-log', true, ['boss_admin'])).toBe(true);
  });

  it('read_only_reviewer cannot perform internal staff actions', () => {
    expect(hasPermission(['read_only_reviewer'], PERMISSIONS.PERFORM_INTERNAL_REVIEW_ACTIONS)).toBe(false);
  });

  it('/intake remains public', () => {
    expect(canAccessPath('/intake', false, [])).toBe(true);
    expect(canAccessPath('/intake', true, ['read_only_reviewer'])).toBe(true);
  });

  it('invalid role keys are ignored and grant no permissions', () => {
    const roles = normalizeRoleKeys(['senior_staff', 'staff', 'bad_role']);
    expect(roles).toEqual(['senior_staff']);
    expect(hasPermission(roles, PERMISSIONS.PERFORM_INTERNAL_REVIEW_ACTIONS)).toBe(true);
    expect(hasPermission(normalizeRoleKeys(['staff']), PERMISSIONS.VIEW_DASHBOARD)).toBe(false);
  });

  it('lead rating permissions are mapped by role', () => {
    expect(hasPermission(['boss_admin'], PERMISSIONS.CHANGE_CONFIRMED_LEAD_RATING)).toBe(true);
    expect(hasPermission(['senior_staff'], PERMISSIONS.CONFIRM_LEAD_RATING)).toBe(true);
    expect(hasPermission(['kenya_intake_staff'], PERMISSIONS.SUGGEST_LEAD_RATING)).toBe(true);
    expect(hasPermission(['kenya_intake_staff'], PERMISSIONS.CONFIRM_LEAD_RATING)).toBe(false);
    expect(hasPermission(['australia_migration_team'], PERMISSIONS.CONFIRM_LEAD_RATING)).toBe(true);
    expect(hasPermission(['australia_migration_team'], PERMISSIONS.CHANGE_CONFIRMED_LEAD_RATING)).toBe(false);
    expect(hasPermission(['read_only_reviewer'], PERMISSIONS.VIEW_LEAD_RATING)).toBe(true);
  });

  it('actor role resolves to safe unknown value when no canonical role exists', () => {
    expect(resolveActorRole(['staff'])).toBe('unknown_staff_role');
  });

  it('boss_admin has all clear report and reference data permissions', () => {
    expect(hasPermission(['boss_admin'], PERMISSIONS.GENERATE_CLEAR_REPORT)).toBe(true);
    expect(hasPermission(['boss_admin'], PERMISSIONS.EDIT_CLEAR_REPORT)).toBe(true);
    expect(hasPermission(['boss_admin'], PERMISSIONS.REVIEW_CLEAR_REPORT)).toBe(true);
    expect(hasPermission(['boss_admin'], PERMISSIONS.SHARE_CLEAR_REPORT)).toBe(true);
    expect(hasPermission(['boss_admin'], PERMISSIONS.VIEW_CLEAR_REPORT)).toBe(true);
    expect(hasPermission(['boss_admin'], PERMISSIONS.MANAGE_MIGRATION_REFERENCE_DATA)).toBe(true);
    expect(hasPermission(['boss_admin'], PERMISSIONS.APPROVE_MIGRATION_REFERENCE_DATA)).toBe(true);
    expect(hasPermission(['boss_admin'], PERMISSIONS.VIEW_MIGRATION_REFERENCE_DATA)).toBe(true);
  });

  it('senior_staff can review clear reports', () => {
    expect(hasPermission(['senior_staff'], PERMISSIONS.REVIEW_CLEAR_REPORT)).toBe(true);
  });

  it('read_only_reviewer cannot mutate clear reports or reference data', () => {
    expect(hasPermission(['read_only_reviewer'], PERMISSIONS.GENERATE_CLEAR_REPORT)).toBe(false);
    expect(hasPermission(['read_only_reviewer'], PERMISSIONS.EDIT_CLEAR_REPORT)).toBe(false);
    expect(hasPermission(['read_only_reviewer'], PERMISSIONS.REVIEW_CLEAR_REPORT)).toBe(false);
    expect(hasPermission(['read_only_reviewer'], PERMISSIONS.SHARE_CLEAR_REPORT)).toBe(false);
    expect(hasPermission(['read_only_reviewer'], PERMISSIONS.MANAGE_MIGRATION_REFERENCE_DATA)).toBe(false);
    expect(hasPermission(['read_only_reviewer'], PERMISSIONS.APPROVE_MIGRATION_REFERENCE_DATA)).toBe(false);
    expect(hasPermission(['read_only_reviewer'], PERMISSIONS.PREPARE_CLEAR_REPORT)).toBe(false);
    expect(hasPermission(['read_only_reviewer'], PERMISSIONS.APPROVE_STANDARD_CLEAR_REPORT)).toBe(false);
  });

  it('C.L.E.A.R approval-gate permissions are mapped by role', () => {
    expect(hasPermission(['kenya_intake_staff'], PERMISSIONS.PREPARE_CLEAR_REPORT)).toBe(true);
    expect(hasPermission(['kenya_intake_staff'], PERMISSIONS.APPROVE_STANDARD_CLEAR_REPORT)).toBe(false);
    expect(hasPermission(['senior_staff'], PERMISSIONS.APPROVE_STANDARD_CLEAR_REPORT)).toBe(true);
    expect(hasPermission(['senior_staff'], PERMISSIONS.REQUEST_AUSTRALIA_CLEAR_REVIEW)).toBe(true);
    expect(hasPermission(['australia_migration_team'], PERMISSIONS.COMPLETE_AUSTRALIA_CLEAR_REVIEW)).toBe(true);
    expect(hasPermission(['boss_admin'], PERMISSIONS.OVERRIDE_CLEAR_REPORT_APPROVAL)).toBe(true);
  });

  it('migration reference data permissions exist and are mapped as expected', () => {
    expect(PERMISSIONS.MANAGE_MIGRATION_REFERENCE_DATA).toBe('manage_migration_reference_data');
    expect(PERMISSIONS.APPROVE_MIGRATION_REFERENCE_DATA).toBe('approve_migration_reference_data');
    expect(PERMISSIONS.VIEW_MIGRATION_REFERENCE_DATA).toBe('view_migration_reference_data');
    expect(hasPermission(['australia_migration_team'], PERMISSIONS.MANAGE_MIGRATION_REFERENCE_DATA)).toBe(true);
    expect(hasPermission(['senior_staff'], PERMISSIONS.MANAGE_MIGRATION_REFERENCE_DATA)).toBe(false);
    expect(hasPermission(['senior_staff'], PERMISSIONS.VIEW_MIGRATION_REFERENCE_DATA)).toBe(true);
  });
});
