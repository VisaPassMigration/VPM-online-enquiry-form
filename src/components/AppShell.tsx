'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Nav } from '@/components/Nav';

/**
 * Staff routes (/dashboard, /admin) get their persistent left sidebar from
 * their own layout.tsx, so this shell renders them bare -- no top header.
 * Public routes keep the existing top-nav header unchanged.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStaffRoute = pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin');

  if (isStaffRoute) return <>{children}</>;

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <strong>Visa Pass Migration</strong>
          <Nav />
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
