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
    expect(markup).toContain('Files you attach here are uploaded and stored privately when you submit');
    expect(markup).toContain('only accessible to authorised VPM staff for review');
    expect(markup).toContain('VPM may request documents again later if needed');
    expect(markup).not.toContain('bank-level');
    expect(markup).not.toContain('fully secure');
    expect(markup).not.toContain('guaranteed');
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
  it('balances the hero and keeps progress cards linked to sections', () => {
    const markup = renderToStaticMarkup(React.createElement(IntakePage));

    expect(markup).toContain('Before you start');
    expect(markup).toContain('Allow around 10–15 minutes to complete the form');
    expect(markup).toContain('Progress is saved in this browser while you complete it');
    expect(markup).toContain('Submit your registration for VPM’s preliminary review');
    expect(markup).toContain('VPM will contact you with the appropriate next steps, which may include a consultation booking link');
    expect(markup).not.toContain('Save progress');
    expect(markup).not.toContain('consultation is guaranteed');
    expect(markup).toContain('href="#client-details"');
    expect(markup).toContain('href="#migration-goal"');
    expect(markup).toContain('href="#risk-screening"');
    expect(markup).toContain('sections look complete or okay for now');
  });

  it('uses clearer migration timeframe options', () => {
    const markup = renderToStaticMarkup(React.createElement(IntakePage));

    expect(markup).toContain('When would you like to start or progress this migration pathway?');
    expect(markup).toContain('Not sure yet');
    expect(markup).toContain('As soon as possible');
    expect(markup).toContain('I am ready to start now, but not urgent');
    expect(markup).toContain('Within the next 3–6 months');
    expect(markup).toContain('Within the next 6–12 months');
    expect(markup).toContain('I am planning for the future');
    expect(markup).not.toContain('Preferred timeframe');
  });

  it('starts fresh registrations with neutral non-scoring points defaults', () => {
    const markup = renderToStaticMarkup(React.createElement(IntakePage));

    expect(markup).toContain('<p class="points-total">0</p>');
    expect(markup).toContain('Indicative range:</strong> Not enough information yet');
    expect(markup).toContain('<option value="Not selected" selected="">Not selected</option>');
    expect(markup).toContain('Age bracket');
    expect(markup).toContain('Highest qualification level');
    expect(markup).not.toContain('<p class="points-total">45</p>');
  });

  it('presents a spaced final submit summary with primary and secondary actions', () => {
    const markup = renderToStaticMarkup(React.createElement(IntakePage));

    expect(markup).toContain('Final registration summary');
    expect(markup).toContain('Registration readiness');
    expect(markup).toContain('Missing sections/items');
    expect(markup).toContain('Current preliminary points estimate:');
    expect(markup).toContain('class="primary-btn final-submit-button"');
    expect(markup).toContain('Submit Registration');
    expect(markup).toContain('Jump to first missing section');
  });

});
