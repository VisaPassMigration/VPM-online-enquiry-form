import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import IntakePage from './page';

describe('public registration form page', () => {
  it('uses client-facing VPM registration wording without internal lead-rating content', () => {
    const markup = renderToStaticMarkup(React.createElement(IntakePage));

    expect(markup).toContain('Visa Pass Migration: Client Registration Form');
    expect(markup).toContain('Please complete the sections below so Visa Pass Migration can complete a preliminary review');
    expect(markup).toContain('Submit Registration');
    expect(markup).toContain('form="client-registration-form"');
    expect(markup).toContain('Submit your registration to VPM');
    expect(markup).toContain('Thank you. Your registration has been submitted to Visa Pass Migration for preliminary review.');
    expect(markup).toContain('Clear saved draft');
    expect(markup).toContain('Jump to first missing section');
    expect(markup).not.toContain('intake questionnaire');
    expect(markup).not.toContain('Lead Rating');
    expect(markup).not.toContain('Hot leads');
    expect(markup).not.toContain('Warm leads');
    expect(markup).not.toContain('Cold leads');
    expect(markup).not.toContain('Escalate leads');
  });

  it('renames risk declarations and keeps document wording honest', () => {
    const markup = renderToStaticMarkup(React.createElement(IntakePage));

    expect(markup).toContain('Health/Character/Visa Refusal Declaration');
    expect(markup).toContain('Please disclose any health, character, visa refusal, cancellation, overstay, or removal history');
    expect(markup).toContain('Document upload selection is currently for preliminary review preparation only');
    expect(markup).toContain('VPM may request documents again through a confirmed secure channel if required');
    expect(markup).not.toContain('documents are securely stored');
    expect(markup).not.toContain('secure document storage');
  });

  it('shows human-readable preliminary points summary labels', () => {
    const markup = renderToStaticMarkup(React.createElement(IntakePage));

    expect(markup).toContain('Preliminary points estimate');
    expect(markup).toContain('Preliminary estimate only. Your final points position must be reviewed by VPM against current migration rules and supporting evidence');
    expect(markup).toContain('Overseas skilled employment');
    expect(markup).toContain('Australian skilled employment');
    expect(markup).toContain('Australian study');
    expect(markup).toContain('Regional study');
    expect(markup).toContain('Specialist education');
    expect(markup).toContain('Professional year');
    expect(markup).toContain('Community language / NAATI');
    expect(markup).toContain('State or regional nomination');
    expect(markup).not.toContain('overseasEmployment:');
    expect(markup).not.toContain('australianEmployment:');
    expect(markup).not.toContain('specialistQualification:');
  });
});
