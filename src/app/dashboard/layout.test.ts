import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({ requirePermissionMock: vi.fn() }));

vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermissionMock }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));

import DashboardLayout from './layout';

describe('DashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermissionMock.mockResolvedValue(undefined);
  });

  it('wraps staff dashboard pages with the persistent sidebar', async () => {
    const jsx = await DashboardLayout({ children: React.createElement('p', null, 'page content') });
    const markup = renderToStaticMarkup(jsx);

    expect(markup).toContain('staff-sidebar');
    expect(markup).toContain('staff-shell__content');
    expect(markup).toContain('page content');
  });
});
