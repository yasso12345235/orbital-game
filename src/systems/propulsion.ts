/**
 * Propulsion — Tsiolkovsky rocket equation.
 * dv = Isp * g0 * ln(m0 / mf). Masses in kg, dv in m/s.
 */
import { G0 } from '../core/constants';

export function rocketDvMps(ispS: number, m0Kg: number, mfKg: number): number {
  if (ispS <= 0) throw new Error('ispS must be > 0');
  if (m0Kg <= 0 || mfKg <= 0) throw new Error('masses must be > 0');
  if (mfKg >= m0Kg) return 0; // no propellant (or invalid) => no dv
  return ispS * G0 * Math.log(m0Kg / mfKg);
}

/** Available dv for a spacecraft: m0 = dry + prop, mf = dry. */
export function availableDvMps(ispS: number, dryMassKg: number, propMassKg: number): number {
  if (dryMassKg <= 0) throw new Error('dryMassKg must be > 0');
  if (propMassKg < 0) throw new Error('propMassKg must be >= 0');
  if (propMassKg === 0) return 0;
  return rocketDvMps(ispS, dryMassKg + propMassKg, dryMassKg);
}

/** Propellant needed to achieve dvMps given Isp and dry mass. Inverse of rocket equation. */
export function propMassForDvKg(ispS: number, dryMassKg: number, dvMps: number): number {
  if (ispS <= 0 || dryMassKg <= 0) throw new Error('ispS and dryMassKg must be > 0');
  if (dvMps <= 0) return 0;
  const massRatio = Math.exp(dvMps / (ispS * G0));
  return dryMassKg * (massRatio - 1);
}

/** Remaining dv after burning propUsedKg. Pure function for sim ticks. */
export function dvAfterBurnMps(
  ispS: number,
  dryMassKg: number,
  propBeforeKg: number,
  propUsedKg: number,
): { propAfterKg: number; dvExpendedMps: number; dvRemainingMps: number } {
  const propAfterKg = Math.max(0, propBeforeKg - propUsedKg);
  const dvBefore = availableDvMps(ispS, dryMassKg, propBeforeKg);
  const dvAfter = availableDvMps(ispS, dryMassKg, propAfterKg);
  return { propAfterKg, dvExpendedMps: Math.max(0, dvBefore - dvAfter), dvRemainingMps: dvAfter };
}
