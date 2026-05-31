import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import HomePage from './page';

describe('public home page', () => {
  it('presents a premium VPM registration landing page without guaranteed outcome claims', () => {
    const markup = renderToStaticMarkup(HomePage());

    expect(markup).toContain('Visa Pass Migration Registration Platform');
    expect(markup).toContain('Start your migration journey with a structured VPM registration.');
    expect(markup).toContain('href="/intake"');
    expect(markup).toContain('Start Registration');
    expect(markup).toContain('href="#how-it-works"');
    expect(markup).toContain('id="book-consultation"');
    expect(markup).toContain('Learn How It Works');
    expect(markup).toContain('Complete the Registration Form');
    expect(markup).toContain('VPM completes a preliminary review');
    expect(markup).toContain('Receive clear next steps');
    expect(markup).toContain('Guided client registration');
    expect(markup).toContain('Preliminary pathway review');
    expect(markup).toContain('Client progress tracking');
    expect(markup).toContain('Supporting information readiness');
    expect(markup).toContain('Completing the registration form does not guarantee a visa outcome');
    expect(markup).not.toContain('Public Home Page Content');
    expect(markup).not.toContain('securely uploaded');
    expect(markup).not.toContain('guaranteed migration outcomes');
  });
});
