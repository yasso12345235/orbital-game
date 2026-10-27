import { describe, it, expect } from 'vitest';
import { circularVelocityKmS, orbitalPeriodS, orbitReadout } from '../src/engine/orbital';

describe('orbital mechanics', () => {
  it('LEO 400km velocity ~7.67 km/s (known value)', () => {
    const v = circularVelocityKmS(6371 + 400);
    expect(v).toBeCloseTo(7.67, 1); // tolerance 0.05
  });
  it('LEO 400km period ~92.6 min (5550 s)', () => {
    const T = orbitalPeriodS(6371 + 400);
    expect(T).toBeCloseTo(5554, -2); // within ~100 s
    expect(T / 60).toBeCloseTo(92.6, 0);
  });
  it('GEO period is one sidereal day (~86164 s)', () => {
    const T = orbitalPeriodS(6371 + 35786);
    expect(T).toBeCloseTo(86164, -3); // within 1000 s
  });
  it('higher orbit is slower and longer', () => {
    const leo = orbitReadout(400);
    const geo = orbitReadout(35786);
    expect(geo.velocityKmS).toBeLessThan(leo.velocityKmS);
    expect(geo.periodS).toBeGreaterThan(leo.periodS);
  });
  it('rejects non-positive radius', () => {
    expect(() => circularVelocityKmS(0)).toThrow();
    expect(() => orbitalPeriodS(-5)).toThrow();
  });
});
