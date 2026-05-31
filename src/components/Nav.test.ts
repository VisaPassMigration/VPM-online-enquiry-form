import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Nav } from './Nav';

const mocks = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock('next/navigation', () => ({ usePathname: mocks.usePathname }));

describe('navigation visibility', () => {
  beforeEach(() => {
    mocks.usePathname.mockReset();
  });

  it('shows only public links on public pages', () => {
    mocks.usePathname.mockReturnValue('/');
    const markup = renderToStaticMarkup(React.createElement(Nav));

    expect(markup).toContain('Home');
    expect(markup).toContain('Registration Form');
    expect(markup).toContain('href="/intake"');
    expect(markup).toContain('Book a Consultation');
    expect(markup).toContain('href="/#book-consultation"');
    expect(markup).toContain('Staff Login');
    expect(markup).toContain('href="/api/auth/signin"');
    expect(markup).not.toContain('Dashboard');
    expect(markup).not.toContain('Enquiries');
    expect(markup).not.toContain('Admin');
  });

  it('keeps staff links on staff pages', () => {
    mocks.usePathname.mockReturnValue('/dashboard');
    const markup = renderToStaticMarkup(React.createElement(Nav));

    expect(markup).toContain('Dashboard');
    expect(markup).toContain('Enquiries');
    expect(markup).toContain('Sign out');
    expect(markup).toContain('href="/api/auth/signout"');
    expect(markup).not.toContain('Staff Login');
    expect(markup).not.toContain('Admin');
  });
});
