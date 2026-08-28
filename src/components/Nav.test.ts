import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Nav } from './Nav';

describe('navigation visibility', () => {
  it('shows public links on the Home page after sign-out returns to /', () => {
    const markup = renderToStaticMarkup(React.createElement(Nav));

    expect(markup).toContain('Home');
    expect(markup).toContain('Registration Form');
    expect(markup).toContain('href="/intake"');
    expect(markup).toContain('Book a Consultation');
    expect(markup).toContain('href="/#book-consultation"');
    expect(markup).toContain('Staff Login');
    expect(markup).toContain('href="/dashboard"');
    expect(markup).not.toContain('Dashboard');
    expect(markup).not.toContain('Enquiries');
    expect(markup).not.toContain('Admin');
  });
});
