import { describe, expect, it } from 'vitest';
import { computeRiskFlags, type IntakeRiskInput } from '../riskFlags';

const baseInput = (): IntakeRiskInput => ({
  previousRefusal: 'No', previousCancellation: 'No', overstayRemoval: 'No', criminalHistory: 'No', healthCondition: 'No',
});

describe('computeRiskFlags', () => {
  it('no disclosures creates no risk flags', () => {
    expect(computeRiskFlags(baseInput(), 0)).toEqual([]);
  });
  it('refusal disclosure creates risk flag', () => {
    expect(computeRiskFlags({ ...baseInput(), previousRefusal: 'Yes' }).some((f) => f.key === 'previous_refusal_declared')).toBe(true);
  });
  it('cancellation/overstay disclosure creates risk flag', () => {
    expect(computeRiskFlags({ ...baseInput(), previousCancellation: 'Yes' }).some((f) => f.key === 'status_history_declared')).toBe(true);
  });
  it('criminal disclosure creates risk flag', () => {
    expect(computeRiskFlags({ ...baseInput(), criminalHistory: 'Yes' }).some((f) => f.key === 'criminal_history_declared')).toBe(true);
  });
  it('health disclosure creates risk flag', () => {
    expect(computeRiskFlags({ ...baseInput(), healthCondition: 'Yes' }).some((f) => f.key === 'health_condition_declared')).toBe(true);
  });
  it('low/incomplete preliminary points creates internal flag if implemented', () => {
    const flags = computeRiskFlags({ ...baseInput(), preliminaryPoints: 40, missingItems: ['English test evidence'] }, 65);
    expect(flags.some((f) => f.key === 'preliminary_points_low')).toBe(true);
    expect(flags.some((f) => f.key === 'preliminary_points_incomplete')).toBe(true);
  });
});
