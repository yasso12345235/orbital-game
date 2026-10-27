/**
 * Reliability — series system with optional redundancy.
 * Base: P(success) = Π Ri (incl. launcher).
 * Redundant unit: R' = 1 - (1 - R)^2 (one cold spare, independent failures).
 */
export function redundantReliability(r: number, redundant: boolean): number {
  if (r < 0 || r > 1) throw new Error('reliability must be 0..1');
  if (!redundant) return r;
  return 1 - Math.pow(1 - r, 2);
}

export function systemReliability(subsystemR: number[], launcherR: number): number {
  const all = [...subsystemR, launcherR];
  for (const r of all) {
    if (r < 0 || r > 1) throw new Error('reliability must be 0..1');
  }
  return all.reduce((acc, r) => acc * r, 1);
}

/** Failure probability complement. */
export function failureProbability(reliability: number): number {
  return 1 - reliability;
}
