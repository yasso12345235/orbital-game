import { describe, it, expect } from 'vitest';
import { resolveDesign, type LookupTables } from '../src/engine/validation';
import type { ComponentSpec, LauncherSpec, MissionSpec } from '../src/engine/types';

/** Minimal inline fixtures (JSON data lands in build step 2; engine stays data-driven). */
function fixtures(): LookupTables {
  const bus: ComponentSpec = { id: 'bus_s', name: 'Bus', category: 'bus', massKg: 100, powerW: 20, cost: 50000, reliability: 0.98 };
  const panels: ComponentSpec = {
    id: 'pow_a', name: 'Panels', category: 'power', massKg: 40, powerW: 5,
    cost: 30000, reliability: 0.97, solarAreaM2: 4, solarEfficiency: 0.3, batteryCapacityWh: 300,
  };
  const chem: ComponentSpec = {
    id: 'prop_chem', name: 'Biprop', category: 'propulsion', massKg: 60, powerW: 10,
    cost: 80000, reliability: 0.95, ispS: 320, thrustN: 500, propCapacityKg: 600,
  };
  const comm: ComponentSpec = {
    id: 'com_x', name: 'X-band', category: 'comms', massKg: 25, powerW: 40,
    cost: 40000, reliability: 0.96, txPowerW: 20, antennaGain: 100,
  };
  const cam: ComponentSpec = { id: 'pay_cam', name: 'Imager', category: 'payload', massKg: 30, powerW: 25, cost: 60000, reliability: 0.94, sciencePower: 1 };
  const therm: ComponentSpec = { id: 'thm_a', name: 'Radiators', category: 'thermal', massKg: 20, powerW: 5, cost: 15000, reliability: 0.99 };
  const f9: LauncherSpec = { id: 'falcon9', name: 'Falcon 9 (proxy)', capacityToLeoKg: 17000, cost: 500000, reliability: 0.98 };
  const electron: LauncherSpec = { id: 'electron', name: 'Electron (proxy)', capacityToLeoKg: 300, cost: 100000, reliability: 0.9 };
  const leo: MissionSpec = {
    id: 'cubesat', name: 'CubeSat imaging', target: 'leo', altitudeKm: 500, inclinationDeg: 97.4,
    durationDays: 180, opsCostPerMonth: 10000, designCost: 50000, requiredDvMps: 100,
    scienceGoalGb: 50, difficultyStars: 1, description: 'test',
  };
  return {
    components: { bus_s: bus, pow_a: panels, prop_chem: chem, com_x: comm, pay_cam: cam, thm_a: therm },
    launchers: { falcon9: f9, electron: electron },
    missions: { cubesat: leo },
  };
}

const goodDesign = {
  missionId: 'cubesat',
  launcherId: 'falcon9',
  components: { bus: 'bus_s', power: 'pow_a', propulsion: 'prop_chem', comms: 'com_x', payload: 'pay_cam', thermal: 'thm_a' },
  redundancy: { bus: false, power: false, propulsion: false, comms: false, payload: false, thermal: false },
  propellantMassKg: 200,
} as const;

describe('validation', () => {
  it('valid LEO design gets GO with margins', () => {
    const r = resolveDesign({ ...goodDesign, components: { ...goodDesign.components }, redundancy: { ...goodDesign.redundancy } } as any, fixtures(), 5_000_000);
    expect(r.go).toBe(true);
    expect(r.budget.availableDvMps).toBeGreaterThan(r.budget.requiredDvMps);
    expect(r.checks.find((c) => c.id === 'mass')?.pass).toBe(true);
  });
  it('overweight design fails mass with a numeric shortfall', () => {
    const r = resolveDesign({ ...goodDesign, components: { ...goodDesign.components }, redundancy: { ...goodDesign.redundancy }, launcherId: 'electron', propellantMassKg: 600 } as any, fixtures(), 5_000_000);
    const mass = r.checks.find((c) => c.id === 'mass')!;
    expect(r.go).toBe(false);
    expect(mass.pass).toBe(false);
    expect(mass.margin).toBeLessThan(0);
    expect(mass.message).toMatch(/exceeds|Too heavy/);
  });
  it('zero propellant fails dv and names the shortfall in m/s', () => {
    const r = resolveDesign({ ...goodDesign, components: { ...goodDesign.components }, redundancy: { ...goodDesign.redundancy }, propellantMassKg: 0 } as any, fixtures(), 5_000_000);
    const dv = r.checks.find((c) => c.id === 'dv')!;
    expect(dv.pass).toBe(false);
    expect(dv.message).toMatch(/m\/s/);
  });
  it('over-budget hurts score messaging but not GO (soft gate)', () => {
    const r = resolveDesign({ ...goodDesign, components: { ...goodDesign.components }, redundancy: { ...goodDesign.redundancy } } as any, fixtures(), 100);
    const cost = r.checks.find((c) => c.id === 'cost')!;
    expect(cost.margin).toBeLessThan(0);
    expect(r.go).toBe(true); // cost is soft
  });
  it('redundancy raises reliability number', () => {
    const t = fixtures();
    const a = resolveDesign({ ...goodDesign, components: { ...goodDesign.components }, redundancy: { ...goodDesign.redundancy } } as any, t, 5_000_000);
    const b = resolveDesign(
      { ...goodDesign, components: { ...goodDesign.components }, redundancy: { bus: true, power: true, propulsion: true, comms: true, payload: true, thermal: true } } as any, t, 5_000_000);
    expect(b.budget.reliability).toBeGreaterThan(a.budget.reliability);
  });
});
