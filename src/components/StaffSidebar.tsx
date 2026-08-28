import React from 'react';
import { PERMISSIONS } from '@/server/auth/permissions';
import { requirePermission } from '@/server/auth/requirePermission';
import { StaffSidebarNav } from '@/components/StaffSidebarNav';

/**
 * Server component so the Audit Trail link can respect the same
 * VIEW_ADMIN_AUDIT_LOG permission the /admin/audit-log page itself enforces.
 * This is a display-only check -- the page's own requirePermission call is
 * still what actually protects it.
 */
export async function StaffSidebar() {
  let canViewAuditTrail = true;
  try {
    await requirePermission(PERMISSIONS.VIEW_ADMIN_AUDIT_LOG);
  } catch {
    canViewAuditTrail = false;
  }

  return (
    <aside className="staff-sidebar" aria-label="Staff navigation sidebar">
      <div className="staff-sidebar__brand">Visa Pass Migration</div>
      <StaffSidebarNav canViewAuditTrail={canViewAuditTrail} />
    </aside>
  );
}
