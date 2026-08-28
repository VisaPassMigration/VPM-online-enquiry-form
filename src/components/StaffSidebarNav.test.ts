import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { StaffSidebarNav } from './StaffSidebarNav';

const mocks = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock('next/navigation', () => ({ usePathname: mocks.usePathname }));

const anchorTagFor = (markup: string, href: string) => {
  const match = markup.match(new RegExp(`<a[^>]*href="${href.replace(/[/#?]/g, '\\$&')}"[^>]*>`));
  return match?.[0] ?? null;
};

describe('StaffSidebarNav', () => {
  beforeEach(() => {
    mocks.usePathname.mockReset();
  });

  it('lists all required staff destinations', () => {
    mocks.usePathname.mockReturnValue('/dashboard');
    const markup = renderToStaticMarkup(React.createElement(StaffSidebarNav, { canViewAuditTrail: true }));

    expect(markup).toContain('Dashboard');
    expect(anchorTagFor(markup, '/dashboard')).toBeTruthy();
    expect(markup).toContain('Enquiries');
    expect(anchorTagFor(markup, '/dashboard/enquiries')).toBeTruthy();
    expect(markup).toContain('Client Review');
    expect(anchorTagFor(markup, '/dashboard#submitted-enquiries')).toBeTruthy();
    expect(markup).toContain('Reports');
    expect(anchorTagFor(markup, '/dashboard/reports')).toBeTruthy();
    expect(markup).toContain('Audit Trail');
    expect(anchorTagFor(markup, '/admin/audit-log')).toBeTruthy();
    expect(markup).toContain('Sign out');
    expect(anchorTagFor(markup, '/api/auth/signout?callbackUrl=%2F')).toBeTruthy();
  });

  it('marks the Enquiries link active on nested enquiry pages but leaves Dashboard inactive', () => {
    mocks.usePathname.mockReturnValue('/dashboard/enquiries');
    const markup = renderToStaticMarkup(React.createElement(StaffSidebarNav, { canViewAuditTrail: true }));

    expect(anchorTagFor(markup, '/dashboard/enquiries')).toContain('staff-sidebar__link--active');
    expect(anchorTagFor(markup, '/dashboard')).not.toContain('staff-sidebar__link--active');
  });

  it('marks the Dashboard link active only on the exact dashboard root', () => {
    mocks.usePathname.mockReturnValue('/dashboard');
    const markup = renderToStaticMarkup(React.createElement(StaffSidebarNav, { canViewAuditTrail: true }));

    expect(anchorTagFor(markup, '/dashboard')).toContain('staff-sidebar__link--active');
  });

  it('does not mark Client Review active on the plain dashboard root, only inside an actual client workspace', () => {
    mocks.usePathname.mockReturnValue('/dashboard');
    const rootMarkup = renderToStaticMarkup(React.createElement(StaffSidebarNav, { canViewAuditTrail: true }));
    expect(anchorTagFor(rootMarkup, '/dashboard#submitted-enquiries')).not.toContain('staff-sidebar__link--active');

    mocks.usePathname.mockReturnValue('/dashboard/intakes/sub-1');
    const workspaceMarkup = renderToStaticMarkup(React.createElement(StaffSidebarNav, { canViewAuditTrail: true }));
    expect(anchorTagFor(workspaceMarkup, '/dashboard#submitted-enquiries')).toContain('staff-sidebar__link--active');
    expect(anchorTagFor(workspaceMarkup, '/dashboard')).not.toContain('staff-sidebar__link--active');
  });

  it('marks the Audit Trail link active when on the audit log page', () => {
    mocks.usePathname.mockReturnValue('/admin/audit-log');
    const markup = renderToStaticMarkup(React.createElement(StaffSidebarNav, { canViewAuditTrail: true }));

    expect(anchorTagFor(markup, '/admin/audit-log')).toContain('staff-sidebar__link--active');
  });

  it('renders Audit Trail as a disabled, non-navigable item when the staff member lacks permission', () => {
    mocks.usePathname.mockReturnValue('/dashboard');
    const markup = renderToStaticMarkup(React.createElement(StaffSidebarNav, { canViewAuditTrail: false }));

    expect(anchorTagFor(markup, '/admin/audit-log')).toBeNull();
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('Audit Trail');
  });
});
