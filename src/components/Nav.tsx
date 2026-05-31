'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string; className?: string };

const publicNavItems: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/intake', label: 'Registration Form' },
  { href: '/#book-consultation', label: 'Book a Consultation', className: 'site-nav__consultation' },
  { href: '/api/auth/signin', label: 'Staff Login', className: 'site-nav__staff-login' },
];

const staffNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/enquiries', label: 'Enquiries' },
  { href: '/api/auth/signout', label: 'Sign out', className: 'site-nav__sign-out' },
];

export function Nav() {
  const pathname = usePathname();
  const isStaffRoute = pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin');
  const navItems = isStaffRoute ? staffNavItems : publicNavItems;

  return (
    <nav className="site-nav" aria-label="Main navigation">
      {navItems.map((item) => {
        const className = item.className;
        if (item.href.startsWith('/api/')) {
          return (
            <a key={item.href} href={item.href} className={className}>
              {item.label}
            </a>
          );
        }

        return (
          <Link key={item.href} href={item.href} className={className}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
