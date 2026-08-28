'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type SidebarLink = { href: string; label: string; isActive: (pathname: string) => boolean };

const primaryLinks: SidebarLink[] = [
  { href: '/dashboard', label: 'Dashboard', isActive: (pathname) => pathname === '/dashboard' },
  { href: '/dashboard/enquiries', label: 'Enquiries', isActive: (pathname) => pathname.startsWith('/dashboard/enquiries') },
  // No standalone Client Review page exists -- this opens the dashboard's client
  // selection queue, but it's "active" whenever staff are actually inside a
  // client's review workspace.
  { href: '/dashboard#submitted-enquiries', label: 'Client Review', isActive: (pathname) => pathname.startsWith('/dashboard/intakes') },
  { href: '/dashboard/reports', label: 'Reports', isActive: (pathname) => pathname.startsWith('/dashboard/reports') },
];

const auditTrailLink: SidebarLink = {
  href: '/admin/audit-log',
  label: 'Audit Trail',
  isActive: (pathname) => pathname.startsWith('/admin/audit-log'),
};

export function StaffSidebarNav({ canViewAuditTrail }: { canViewAuditTrail: boolean }) {
  const pathname = usePathname() ?? '';

  return (
    <nav className="staff-sidebar__nav" aria-label="Staff navigation">
      {primaryLinks.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          className={`staff-sidebar__link${link.isActive(pathname) ? ' staff-sidebar__link--active' : ''}`}
        >
          {link.label}
        </Link>
      ))}
      {canViewAuditTrail ? (
        <Link
          href={auditTrailLink.href}
          className={`staff-sidebar__link${auditTrailLink.isActive(pathname) ? ' staff-sidebar__link--active' : ''}`}
        >
          {auditTrailLink.label}
        </Link>
      ) : (
        <span className="staff-sidebar__link staff-sidebar__link--disabled" aria-disabled="true">
          {auditTrailLink.label}
        </span>
      )}
      <a href="/api/auth/signout?callbackUrl=%2F" className="staff-sidebar__link staff-sidebar__signout">
        Sign out
      </a>
    </nav>
  );
}
