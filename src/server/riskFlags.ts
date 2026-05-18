/**
 * Internal backend-only risk flag service.
 * Wording stays internal and neutral/safe.
 */

export type IntakeRiskInput = {
  previousRefusal: 'Yes' | 'No';
  previousCancellation: 'Yes' | 'No';
  overstayRemoval: 'Yes' | 'No';
  criminalHistory: 'Yes' | 'No';
  healthCondition: 'Yes' | 'No';
  preliminaryPoints?: number;
  missingItems?: string[];
};

export type InternalRiskFlag = {
  key: string;
  severity: 'low' | 'medium' | 'high';
  note: string;
};

export function computeRiskFlags(input: IntakeRiskInput, threshold = 65): InternalRiskFlag[] {
  const flags: InternalRiskFlag[] = [];

  if (input.previousRefusal === 'Yes') flags.push({ key: 'previous_refusal_declared', severity: 'medium', note: 'Prior refusal disclosure requires consultant review context.' });
  if (input.previousCancellation === 'Yes' || input.overstayRemoval === 'Yes') flags.push({ key: 'status_history_declared', severity: 'high', note: 'Cancellation/overstay/removal disclosure requires senior review.' });
  if (input.criminalHistory === 'Yes') flags.push({ key: 'criminal_history_declared', severity: 'high', note: 'Criminal history disclosure requires controlled legal review.' });
  if (input.healthCondition === 'Yes') flags.push({ key: 'health_condition_declared', severity: 'medium', note: 'Health disclosure requires medical evidence review.' });
  if ((input.preliminaryPoints ?? 0) < threshold) flags.push({ key: 'preliminary_points_low', severity: 'medium', note: 'Preliminary points may be below common invitation benchmarks.' });
  if ((input.missingItems?.length ?? 0) > 0) flags.push({ key: 'preliminary_points_incomplete', severity: 'low', note: 'Points estimate has missing items that may change review outcome.' });

  return flags;
}
