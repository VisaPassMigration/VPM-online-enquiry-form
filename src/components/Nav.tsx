'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const publicNavItems = [
  { href: '/', label: 'Home' },
  { href: '/intake', label: 'Registration Form' },
];

const staffNavItems = [
  { href: '/', label: 'Home' },
  { href: '/intake', label: 'Registration Form' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/enquiries', label: 'Enquiries' },
];

export function Nav() {
  const pathname = usePathname();
  const isStaffRoute = pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin');
  const navItems = isStaffRoute ? staffNavItems : publicNavItems;

  return (
    <nav className="site-nav" aria-label="Main navigation">
      {navItems.map((item) => (
        <Link key={item.href} href={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
