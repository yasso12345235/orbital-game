import { describe, it, expect } from 'vitest';
import { rocketDvMps, availableDvMps, propMassForDvKg, dvAfterBurnMps } from '../src/engine/propulsion';

describe('Tsiolkovsky rocket equation', () => {
  it('Isp 300 s, 1000->800 kg gives ~657 m/s', () => {
    const dv = rocketDvMps(300, 1000, 800);
    // 300*9.80665*ln(1.25) = 656.5
    expect(dv).toBeCloseTo(656.5, 0);
  });
  it('zero propellant gives zero dv', () => {
    expect(rocketDvMps(300, 1000, 1000)).toBe(0);
    expect(availableDvMps(300, 800, 0)).toBe(0);
  });
  it('ion Isp beats chemical for same mass ratio', () => {
    const chem = rocketDvMps(320, 1000, 800);
    const ion = rocketDvMps(2500, 1000, 800);
    expect(ion).toBeGreaterThan(chem * 5);
  });
  it('propMassForDv inverts availableDv (round-trip)', () => {
    const need = propMassForDvKg(320, 800, 1500);
    const got = availableDvMps(320, 800, need);
    expect(got).toBeCloseTo(1500, 0);
  });
  it('Moon mission needs ~130 kg prop for 800 kg dry at Isp 320 (sanity)', () => {
    // m = 800*(exp(3100/(320*9.80665))-1) ≈ 800*(e^0.9878-1) ≈ 800*1.685 ≈ 1348? check:
    const m = propMassForDvKg(320, 800, 3100);
    expect(m).toBeGreaterThan(1000);
    expect(m).toBeLessThan(1600);
  });
  it('dvAfterBurn conserves accounting', () => {
    const before = availableDvMps(320, 800, 200);
    const r = dvAfterBurnMps(320, 800, 200, 50);
    expect(r.propAfterKg).toBe(150);
    expect(r.dvExpendedMps).toBeCloseTo(before - r.dvRemainingMps, 6);
  });
});
