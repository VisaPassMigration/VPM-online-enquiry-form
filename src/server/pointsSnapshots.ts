import { calculateEstimatedSkilledMigrationPoints, type PointsCalculatorInput } from '@/lib/pointsCalculator';

/**
 * Internal backend-only points snapshot service.
 * This does not send any client outcome; human review remains mandatory.
 */

export type PointsSnapshotRecord = {
  calculatorVersion: string;
  inputPayload: PointsCalculatorInput;
  pointsBreakdown: Record<string, number>;
  estimatedTotal: number;
  potentialRange: string;
  missingItems: string[];
  generatedAt: string;
  generatedBy: string;
};

export function preparePointsSnapshot(input: {
  pointsInput: PointsCalculatorInput;
  calculatorVersion?: string;
  generatedBy: string;
  generatedAt?: Date;
}): PointsSnapshotRecord {
  const result = calculateEstimatedSkilledMigrationPoints(input.pointsInput);

  return {
    calculatorVersion: input.calculatorVersion ?? 'v1',
    inputPayload: input.pointsInput,
    pointsBreakdown: result.breakdown,
    estimatedTotal: result.estimatedTotalPoints,
    potentialRange: result.potentialRange,
    missingItems: result.missingItems,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    generatedBy: input.generatedBy,
  };
}
