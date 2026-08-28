import React from 'react';
import Link from 'next/link';

type NavItem = { href: string; label: string; className?: string };

const publicNavItems: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/intake', label: 'Registration Form' },
  { href: '/#book-consultation', label: 'Book a Consultation', className: 'site-nav__consultation' },
  { href: '/dashboard', label: 'Staff Login', className: 'site-nav__staff-login' },
];

export function Nav() {
  return (
    <nav className="site-nav" aria-label="Main navigation">
      {publicNavItems.map((item) => (
        <Link key={item.href} href={item.href} className={item.className}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
