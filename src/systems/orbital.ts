/**
 * Orbital mechanics — circular-orbit approximations.
 * Units: distances in km, mu in km^3/s^2, velocity in km/s, period in s.
 */
import { MU_EARTH_KM3_S2, EARTH_RADIUS_KM } from '../core/constants';

export function radiusFromAltitude(altitudeKm: number, bodyRadiusKm = EARTH_RADIUS_KM): number {
  return bodyRadiusKm + altitudeKm;
}

/** v = sqrt(mu / r). */
export function circularVelocityKmS(radiusKm: number, mu = MU_EARTH_KM3_S2): number {
  if (radiusKm <= 0) throw new Error('radiusKm must be > 0');
  return Math.sqrt(mu / radiusKm);
}

/** T = 2*pi*sqrt(r^3 / mu). Returns seconds. */
export function orbitalPeriodS(radiusKm: number, mu = MU_EARTH_KM3_S2): number {
  if (radiusKm <= 0) throw new Error('radiusKm must be > 0');
  return 2 * Math.PI * Math.sqrt(Math.pow(radiusKm, 3) / mu);
}

export interface OrbitReadout {
  altitudeKm: number;
  radiusKm: number;
  velocityKmS: number;
  velocityMS: number;
  periodS: number;
  periodMin: number;
}

/** Convenience readout for a circular Earth orbit at altitudeKm. */
export function orbitReadout(altitudeKm: number): OrbitReadout {
  const radiusKm = radiusFromAltitude(altitudeKm);
  const velocityKmS = circularVelocityKmS(radiusKm);
  const periodS = orbitalPeriodS(radiusKm);
  return {
    altitudeKm,
    radiusKm,
    velocityKmS,
    velocityMS: velocityKmS * 1000,
    periodS,
    periodMin: periodS / 60,
  };
}
