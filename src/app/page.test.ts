import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import HomePage from './page';

describe('public home page', () => {
  it('presents a premium VPM landing page without guaranteed outcome claims', () => {
    const markup = renderToStaticMarkup(HomePage());

    expect(markup).toContain('Start your migration journey with a structured VPM intake.');
    expect(markup).toContain('href="/intake"');
    expect(markup).toContain('Start intake');
    expect(markup).toContain('href="/dashboard"');
    expect(markup).toContain('Staff dashboard');
    expect(markup).toContain('Guided client intake');
    expect(markup).toContain('Preliminary eligibility review');
    expect(markup).toContain('Staff workflow tracking');
    expect(markup).toContain('Document-ready process');
    expect(markup).toContain('Completing the intake form does not guarantee a visa outcome');
    expect(markup).not.toContain('securely uploaded');
    expect(markup).not.toContain('guaranteed migration outcomes');
  });
});
