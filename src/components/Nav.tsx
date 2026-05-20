import Link from 'next/link';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/intake', label: 'Intake' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/enquiries', label: 'Enquiries' },
];

export function Nav() {
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
