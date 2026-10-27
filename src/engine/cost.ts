/** Cost model: total = design + hardware + launcher + ops*duration. All in credits. */
export interface CostInputs {
  designCost: number;
  hardwareCost: number; // sum of components incl. redundancy
  launcherCost: number;
  opsPerMonth: number;
  durationDays: number;
}

export interface CostBreakdown {
  design: number;
  hardware: number;
  launcher: number;
  operations: number;
  total: number;
}

export function computeCost(inputs: CostInputs): CostBreakdown {
  const months = inputs.durationDays / 30;
  const operations = inputs.opsPerMonth * months;
  const total = inputs.designCost + inputs.hardwareCost + inputs.launcherCost + operations;
  return {
    design: inputs.designCost,
    hardware: inputs.hardwareCost,
    launcher: inputs.launcherCost,
    operations,
    total,
  };
}

/** Budget efficiency 0..1: 1 = far under budget, 0 = at/over. Used for scoring. */
export function budgetEfficiency(total: number, budgetCap: number): number {
  if (budgetCap <= 0) throw new Error('budgetCap must be > 0');
  if (total >= budgetCap) return 0;
  return Math.min(1, (budgetCap - total) / budgetCap);
}
