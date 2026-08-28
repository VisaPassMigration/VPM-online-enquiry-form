import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({ requirePermissionMock: vi.fn() }));

vi.mock('@/server/auth/requirePermission', () => ({ requirePermission: mocks.requirePermissionMock }));

import { PERMISSIONS } from '@/server/auth/permissions';
import ReportsPage from './page';

describe('Reports placeholder page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermissionMock.mockResolvedValue(undefined);
  });

  it('is gated behind VIEW_DASHBOARD and renders placeholder content', async () => {
    const jsx = await ReportsPage();
    const markup = renderToStaticMarkup(jsx);

    expect(mocks.requirePermissionMock).toHaveBeenCalledWith(PERMISSIONS.VIEW_DASHBOARD);
    expect(markup).toContain('Reports');
    expect(markup).toContain('not built yet');
  });
});
