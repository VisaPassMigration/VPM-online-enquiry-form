import { calculateEstimatedSkilledMigrationPoints, type PointsCalculatorInput } from '@/lib/pointsCalculator';

export function generatePointsSnapshot(input: PointsCalculatorInput, calculatorVersion = 'v1') {
  const result = calculateEstimatedSkilledMigrationPoints(input);

  return {
    calculatorVersion,
    inputPayload: input,
    totalPoints: result.estimatedTotalPoints,
    pointsBreakdown: result.breakdown,
    missingItems: result.missingItems,
    generatedAt: new Date().toISOString(),
    preliminaryLabel: 'Preliminary only; subject to human review.',
  };
}
