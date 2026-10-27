/**
 * Power model — simplified but dimensionally correct.
 * P = area * efficiency * flux * cos(angle).
 * Battery must cover eclipse loads with a safety margin.
 */
import { SOLAR_FLUX_W_M2 } from './constants';

export type FluxBody = keyof typeof SOLAR_FLUX_W_M2;

export function solarFluxAt(target: FluxBody | string): number {
  const key = (target as FluxBody) in SOLAR_FLUX_W_M2 ? (target as FluxBody) : 'earth';
  return SOLAR_FLUX_W_M2[key];
}

/** Peak sun-pointed generation in W. angleDeg=0 means face-on. */
export function solarPowerW(areaM2: number, efficiency: number, fluxWm2: number, angleDeg = 0): number {
  if (areaM2 < 0 || efficiency < 0 || fluxWm2 < 0) throw new Error('power inputs must be >= 0');
  const eff = Math.min(1, Math.max(0, efficiency));
  const cos = Math.max(0, Math.cos((angleDeg * Math.PI) / 180));
  return areaM2 * eff * fluxWm2 * cos;
}

/** Eclipse fraction per orbit (0..1). Simplified anchors by mission class. */
export function eclipseFraction(orbitClass: 'leo' | 'gto' | 'deep'): number {
  switch (orbitClass) {
    case 'leo':
      return 0.35; // ~35% of LEO spent in shadow (simplified)
    case 'gto':
      return 0.15;
    case 'deep':
      return 0.02; // cruise: rare eclipses except planetary shadow
  }
}

/**
 * Required battery to survive eclipse: energy = load * eclipseTime, plus margin.
 * orbitPeriodS in seconds, loadW in W. Returns Wh.
 */
export function requiredBatteryWh(loadW: number, orbitPeriodS: number, eclipseFrac: number, margin = 1.2): number {
  if (loadW < 0) throw new Error('loadW must be >= 0');
  const eclipseHours = ((orbitPeriodS * eclipseFrac) / 3600);
  return loadW * eclipseHours * margin;
}

export interface PowerBalance {
  generationW: number;
  loadW: number;
  netW: number; // + surplus, - deficit
  eclipseSurvivable: boolean;
  requiredBatteryWh: number;
}

export function powerBalance(
  generationW: number,
  loadW: number,
  batteryWh: number,
  orbitPeriodS: number,
  eclipseFrac: number,
  margin = 1.2,
): PowerBalance {
  const required = requiredBatteryWh(loadW, orbitPeriodS, eclipseFrac, margin);
  return {
    generationW,
    loadW,
    netW: generationW - loadW,
    eclipseSurvivable: batteryWh >= required,
    requiredBatteryWh: required,
  };
}
