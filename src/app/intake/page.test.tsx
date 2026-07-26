import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import IntakePage from './page';

describe('public intake page', () => {
  it('does not expose lead rating content', () => {
    const markup = renderToStaticMarkup(<IntakePage />);

    expect(markup).not.toContain('Lead Rating');
    expect(markup).not.toContain('Hot leads');
    expect(markup).not.toContain('Warm leads');
    expect(markup).not.toContain('Cold leads');
    expect(markup).not.toContain('Escalate leads');
    expect(markup).not.toContain('Lead Rating Reason');
    expect(markup).not.toContain('Next Action Hint');
    expect(markup).not.toContain('Lead rating and next-action hints are internal workflow aids only.');
  });
});
