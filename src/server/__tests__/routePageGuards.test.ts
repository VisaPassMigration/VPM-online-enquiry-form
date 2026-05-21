import { beforeEach, describe, expect, it, vi } from 'vitest';

import { canAccessPath } from '@/server/auth/routeAccess';
import { PERMISSIONS } from '@/server/auth/permissions';

const dashboardFindMany = vi.fn();
const intakeFindUnique = vi.fn();
const auditFindMany = vi.fn();
const migrationDatasetFindMany = vi.fn();
const legalReferenceFindMany = vi.fn();

const requirePermissionMock = vi.fn();

vi.mock('@/server/auth/requirePermission', () => ({
  requirePermission: requirePermissionMock,
}));


vi.mock('@/auth', () => ({
  auth: vi.fn(async () => null),
}));

vi.mock('@/server/db', () => ({
  db: {
    intakeSubmission: {
      findMany: dashboardFindMany,
      findUnique: intakeFindUnique,
    },
    auditEvent: {
      findMany: auditFindMany,
    },
    migrationReferenceDataset: {
      findMany: migrationDatasetFindMany,
    },
    legalReference: {
      findMany: legalReferenceFindMany,
    },
  },
}));

describe('protected staff page entry guards', () => {
  beforeEach(() => {
    vi.resetModules();
    requirePermissionMock.mockReset();
    dashboardFindMany.mockReset();
    intakeFindUnique.mockReset();
    auditFindMany.mockReset();
    migrationDatasetFindMany.mockReset();
    legalReferenceFindMany.mockReset();
  });

  it('dashboard requires view_dashboard before querying data', async () => {
    requirePermissionMock.mockRejectedValueOnce(new Error('blocked'));

    const page = (await import('@/app/dashboard/page')).default;

    await expect(page()).rejects.toThrow('blocked');
    expect(requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.VIEW_DASHBOARD);
    expect(dashboardFindMany).not.toHaveBeenCalled();
  });

  it('intake detail page requires view_intake_details before querying data', async () => {
    requirePermissionMock.mockRejectedValueOnce(new Error('blocked'));

    const page = (await import('@/app/dashboard/intakes/[submissionId]/page')).default;

    await expect(page({ params: Promise.resolve({ submissionId: 'sub-123' }) })).rejects.toThrow('blocked');
    expect(requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.VIEW_INTAKE_DETAILS);
    expect(intakeFindUnique).not.toHaveBeenCalled();
  });

  it('admin audit log requires view_admin_audit_log before querying data', async () => {
    requirePermissionMock.mockRejectedValueOnce(new Error('blocked'));

    const page = (await import('@/app/admin/audit-log/page')).default;

    await expect(page({ searchParams: Promise.resolve({}) })).rejects.toThrow('blocked');
    expect(requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.VIEW_ADMIN_AUDIT_LOG);
    expect(auditFindMany).not.toHaveBeenCalled();
  });

  it('migration reference data page requires view_migration_reference_data before querying data', async () => {
    requirePermissionMock.mockRejectedValueOnce(new Error('blocked'));

    const page = (await import('@/app/admin/migration-reference-data/page')).default;

    await expect(page()).rejects.toThrow('blocked');
    expect(requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.VIEW_MIGRATION_REFERENCE_DATA);
    expect(migrationDatasetFindMany).not.toHaveBeenCalled();
  });


  it('legal references page requires view_legal_reference before querying data', async () => {
    requirePermissionMock.mockRejectedValueOnce(new Error('blocked'));

    const page = (await import('@/app/admin/legal-references/page')).default;

    await expect(page({ searchParams: Promise.resolve({}) })).rejects.toThrow('blocked');
    expect(requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.VIEW_LEGAL_REFERENCE);
    expect(legalReferenceFindMany).not.toHaveBeenCalled();
  });

  it('/intake remains public in route access rules', () => {
    expect(canAccessPath('/intake', false, [])).toBe(true);
    expect(canAccessPath('/intake', true, ['read_only_reviewer'])).toBe(true);
  });

  it('protected namespace defaults stay protected for unknown sub-routes', () => {
    expect(canAccessPath('/dashboard/new-internal-page', false, [])).toBe(false);
    expect(canAccessPath('/admin/new-tool', true, ['senior_staff'])).toBe(false);
    expect(canAccessPath('/admin/new-tool', true, ['boss_admin'])).toBe(true);
  });
});
