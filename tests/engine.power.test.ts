import { describe, it, expect } from 'vitest';
import { solarPowerW, solarFluxAt, requiredBatteryWh, powerBalance } from '../src/engine/power';

describe('power model', () => {
  it('P = A*eff*flux at face-on (2 m², 30%, Earth)', () => {
    expect(solarPowerW(2, 0.3, 1361, 0)).toBeCloseTo(816.6, 1);
  });
  it('60° incidence halves output (cos law)', () => {
    const face = solarPowerW(1, 0.3, 1361, 0);
    const tilted = solarPowerW(1, 0.3, 1361, 60);
    expect(tilted).toBeCloseTo(face * 0.5, 1);
  });
  it('Mars flux is weaker than Earth, Jupiter weakest', () => {
    expect(solarFluxAt('mars')).toBeLessThan(solarFluxAt('earth'));
    expect(solarFluxAt('jupiter')).toBeLessThan(solarFluxAt('mars'));
    expect(solarFluxAt('mars')).toBeCloseTo(590, 0);
    expect(solarFluxAt('jupiter')).toBeCloseTo(50, 0);
  });
  it('battery sizes for LEO eclipse (~65 Wh for 100 W load)', () => {
    const need = requiredBatteryWh(100, 5554, 0.35, 1.2);
    expect(need).toBeCloseTo(64.8, 0);
  });
  it('powerBalance flags eclipse survival', () => {
    const ok = powerBalance(500, 200, 200, 5554, 0.35);
    expect(ok.netW).toBe(300);
    expect(ok.eclipseSurvivable).toBe(true);
    const bad = powerBalance(100, 200, 5, 5554, 0.35);
    expect(bad.netW).toBe(-100);
    expect(bad.eclipseSurvivable).toBe(false);
  });
});
