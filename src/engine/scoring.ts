/**
 * Scoring — Science 40 + Budget efficiency 25 + Safety/reliability 25 + Innovation 10 = 100.
 */
export interface ScoreInputs {
  scienceReturnedGb: number;
  scienceGoalGb: number;
  costTotal: number;
  budgetCap: number;
  reliability: number; // 0..1 predicted
  survived: boolean; // no critical failure
  innovationPoints: number; // 0..10 precomputed (new tech, assists, etc.)
  anomalyCount: number; // unmitigated events reduce safety score
}

export interface ScoreBreakdown {
  science: number; // /40
  budget: number; // /25
  safety: number; // /25
  innovation: number; // /10
  total: number; // /100
}

export function computeScore(inputs: ScoreInputs): ScoreBreakdown {
  const scienceFrac = inputs.scienceGoalGb > 0 ? Math.min(1, inputs.scienceReturnedGb / inputs.scienceGoalGb) : 0;
  const science = 40 * scienceFrac;

  const effFrac = inputs.budgetCap > 0 ? Math.max(0, Math.min(1, (inputs.budgetCap - inputs.costTotal) / inputs.budgetCap)) : 0;
  const budget = 25 * (inputs.costTotal <= inputs.budgetCap ? (inputs.survived ? effFrac * 0.7 + 0.3 * scienceFrac : effFrac * 0.5) : 0);

  const anomalyPenalty = Math.min(1, inputs.anomalyCount * 0.15);
  const safety = 25 * Math.max(0, inputs.reliability * (inputs.survived ? 1 : 0.3) - anomalyPenalty * 0.5);

  const innovation = Math.max(0, Math.min(10, inputs.innovationPoints));

  const total = science + budget + safety + innovation;
  return { science, budget, safety, innovation, total: Math.min(100, total) };
}

export function gradeForScore(total: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (total >= 90) return 'S';
  if (total >= 75) return 'A';
  if (total >= 60) return 'B';
  if (total >= 40) return 'C';
  return 'D';
}
