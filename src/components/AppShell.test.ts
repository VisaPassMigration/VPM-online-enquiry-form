import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock('next/navigation', () => ({ usePathname: mocks.usePathname }));

import { AppShell } from './AppShell';

describe('AppShell', () => {
  beforeEach(() => {
    mocks.usePathname.mockReset();
  });

  it('renders the public top-nav header, unchanged, for public routes', () => {
    mocks.usePathname.mockReturnValue('/');
    const markup = renderToStaticMarkup(React.createElement(AppShell, {}, React.createElement('p', null, 'public content')));

    expect(markup).toContain('site-header');
    expect(markup).toContain('site-nav');
    expect(markup).toContain('class="page"');
    expect(markup).toContain('public content');
  });

  it('renders staff routes bare, with no top header, so the staff layout can provide the sidebar', () => {
    mocks.usePathname.mockReturnValue('/dashboard');
    const markup = renderToStaticMarkup(React.createElement(AppShell, {}, React.createElement('p', null, 'staff content')));

    expect(markup).not.toContain('site-header');
    expect(markup).not.toContain('site-nav');
    expect(markup).toContain('staff content');
  });

  it('also treats /admin as a staff route with no top header', () => {
    mocks.usePathname.mockReturnValue('/admin/audit-log');
    const markup = renderToStaticMarkup(React.createElement(AppShell, {}, React.createElement('p', null, 'audit content')));

    expect(markup).not.toContain('site-header');
    expect(markup).toContain('audit content');
  });
});
