import { describe, expect, it } from 'vitest';

import { canAccessPath } from '@/server/auth/routeAccess';
import { hasPermission, PERMISSIONS } from '@/server/auth/permissions';

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
});
