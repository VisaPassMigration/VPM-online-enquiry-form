import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({ requirePermissionMock: vi.fn() }));

vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermissionMock }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));

import { PERMISSIONS } from '@/server/auth/permissions';
import { StaffSidebar } from './StaffSidebar';

describe('StaffSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks the same permission the audit log page enforces, and shows the link when granted', async () => {
    mocks.requirePermissionMock.mockResolvedValue(undefined);
    const jsx = await StaffSidebar();
    const markup = renderToStaticMarkup(jsx);

    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.VIEW_ADMIN_AUDIT_LOG);
    expect(markup).toContain('href="/admin/audit-log"');
    expect(markup).toContain('Visa Pass Migration');
  });

  it('hides the Audit Trail link (without throwing) when permission is denied', async () => {
    mocks.requirePermissionMock.mockRejectedValue(new Error('denied'));
    const jsx = await StaffSidebar();
    const markup = renderToStaticMarkup(jsx);

    expect(markup).not.toContain('href="/admin/audit-log"');
    expect(markup).toContain('aria-disabled="true"');
  });
});
