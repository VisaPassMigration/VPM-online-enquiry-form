import { describe, expect, it } from 'vitest';
import { canTransition, validateWorkflowTransition } from '../workflow';

describe('workflow', () => {
  it('allowed normal transitions pass', () => {
    expect(canTransition('draft', 'submitted')).toBe(true);
    expect(() => validateWorkflowTransition('submitted', 'intake_triage_in_progress')).not.toThrow();
  });

  it('disallowed transitions fail', () => {
    expect(canTransition('draft', 'closed')).toBe(false);
    expect(() => validateWorkflowTransition('draft', 'closed')).toThrow(/Unsafe transition/);
  });

  it('client-facing outcome transition fails without humanReviewComplete', () => {
    expect(() =>
      validateWorkflowTransition('ready_for_client_summary', 'client_summary_sent', {
        humanOutcomeReleaseAllowed: true,
        reviewerId: 'rev-1',
      }),
    ).toThrow(/completed human review/);
  });

  it('client-facing outcome transition fails without humanOutcomeReleaseAllowed', () => {
    expect(() =>
      validateWorkflowTransition('ready_for_client_summary', 'client_summary_sent', {
        humanReviewComplete: true,
        reviewerId: 'rev-1',
      }),
    ).toThrow(/release approval/);
  });

  it('client-facing outcome transition fails without reviewerId', () => {
    expect(() =>
      validateWorkflowTransition('ready_for_client_summary', 'client_summary_sent', {
        humanReviewComplete: true,
        humanOutcomeReleaseAllowed: true,
      }),
    ).toThrow(/Named reviewer/);
  });

  it('automated action cannot release client-facing outcome', () => {
    expect(() =>
      validateWorkflowTransition('ready_for_client_summary', 'client_summary_sent', {
        humanReviewComplete: true,
        humanOutcomeReleaseAllowed: true,
        reviewerId: 'rev-1',
        isAutomatedAction: true,
      }),
    ).toThrow(/Automatic client-facing outcome release/);
  });
});
