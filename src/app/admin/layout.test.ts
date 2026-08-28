import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({ requirePermissionMock: vi.fn() }));

vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermissionMock }));
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/audit-log' }));

import AdminLayout from './layout';

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermissionMock.mockResolvedValue(undefined);
  });

  it('wraps admin pages with the same persistent sidebar as the dashboard', async () => {
    const jsx = await AdminLayout({ children: React.createElement('p', null, 'admin content') });
    const markup = renderToStaticMarkup(jsx);

    expect(markup).toContain('staff-sidebar');
    expect(markup).toContain('staff-shell__content');
    expect(markup).toContain('admin content');
  });
});
