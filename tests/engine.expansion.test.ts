/**
 * Expansion pack (v1.1) — new destinations (Venus / Eros / Titan),
 * nuclear RTG power, and the super-heavy launcher.
 */
import { describe, it, expect } from 'vitest';
import { TRANSFER_DV_FROM_LEO_MPS, SOLAR_FLUX_W_M2, TARGET_DISTANCE_KM } from '../src/engine/constants';
import { missionDistanceKm, lightDelayS, dataRateMbps } from '../src/engine/comms';
import { resolveDesign } from '../src/engine/validation';
import { lookupTables, MISSIONS } from '../src/engine/data';
import type { SpacecraftDesign } from '../src/engine/types';

const tables = lookupTables();

function baseDesign(overrides: Partial<SpacecraftDesign> = {}): SpacecraftDesign {
  return {
    missionId: 'titan_explorer',
    launcherId: 'super_heavy',
    components: {
      bus: 'bus_heavy',
      power: 'pow_rtg',
      propulsion: 'prop_hydrolox',
      comms: 'com_ka',
      payload: 'pay_radar',
      thermal: 'thm_deep',
    },
    redundancy: { bus: false, power: false, propulsion: false, comms: false, payload: false, thermal: false },
    propellantMassKg: 5900,
    ...overrides,
  };
}

describe('expansion — new destinations', () => {
  it('solar flux anchors follow the inverse-square law ordering', () => {
    expect(SOLAR_FLUX_W_M2.venus).toBeGreaterThan(SOLAR_FLUX_W_M2.earth);
    expect(SOLAR_FLUX_W_M2.venus).toBeGreaterThan(SOLAR_FLUX_W_M2.mars);
    expect(SOLAR_FLUX_W_M2.eros).toBeGreaterThan(SOLAR_FLUX_W_M2.jupiter);
    expect(SOLAR_FLUX_W_M2.titan).toBeLessThan(SOLAR_FLUX_W_M2.jupiter);
    expect(SOLAR_FLUX_W_M2.titan).toBeLessThan(20);
  });

  it('delta-v anchors increase with distance from Earth', () => {
    const dv = TRANSFER_DV_FROM_LEO_MPS;
    expect(dv.venus).toBeGreaterThan(dv.moon);
    expect(dv.eros).toBeGreaterThan(dv.mars);
    expect(dv.titan).toBeGreaterThan(dv.europa);
  });

  it('light delay to Titan is over one hour one-way; Venus is minutes', () => {
    const dist = missionDistanceKm('titan');
    expect(dist).toBe(TARGET_DISTANCE_KM.titan_avg);
    expect(lightDelayS(dist)).toBeGreaterThan(3600);
    expect(lightDelayS(missionDistanceKm('venus'))).toBeLessThan(7 * 60);
    expect(missionDistanceKm('eros')).toBe(TARGET_DISTANCE_KM.eros_avg);
  });

  it('the three new missions exist and are tech-gated by default', () => {
    for (const id of ['venus_climate', 'eros_rendezvous', 'titan_explorer']) {
      const m = MISSIONS.find((x) => x.id === id);
      expect(m, id).toBeTruthy();
      expect(m!.lockedByDefault).toBe(true);
    }
  });
});

describe('expansion — nuclear power (RTG)', () => {
  it('RTG generation is flux-independent: same watts at Venus and at Titan', () => {
    const atVenus = resolveDesign(baseDesign({ missionId: 'venus_climate' }), tables, 5_000_000);
    const atTitan = resolveDesign(baseDesign({ missionId: 'titan_explorer' }), tables, 5_000_000);
    expect(atVenus.budget.generationW).toBeCloseTo(300, 5);
    expect(atTitan.budget.generationW).toBeCloseTo(300, 5);
  });

  it('solar power collapses with distance but nuclear does not', () => {
    const solar = baseDesign({ components: { ...baseDesign().components, power: 'pow_xl' } });
    const venus = resolveDesign({ ...solar, missionId: 'venus_climate' }, tables, 5_000_000);
    const titan = resolveDesign({ ...solar, missionId: 'titan_explorer' }, tables, 5_000_000);
    expect(venus.budget.generationW).toBeGreaterThan(titan.budget.generationW * 100);
    // big solar cannot close the power gate at Titan; the RTG can
    expect(titan.checks.find((c) => c.id === 'power')!.pass).toBe(false);
    expect(resolveDesign(baseDesign(), tables, 5_000_000).checks.find((c) => c.id === 'power')!.pass).toBe(true);
  });

  it('the reference Titan design passes dv, power and mass gates', () => {
    const r = resolveDesign(baseDesign(), tables, 5_000_000);
    expect(r.checks.find((c) => c.id === 'mass')!.pass).toBe(true);
    expect(r.checks.find((c) => c.id === 'dv')!.pass).toBe(true);
    expect(r.checks.find((c) => c.id === 'power')!.pass).toBe(true);
    expect(r.go).toBe(true);
  });
});

describe('expansion — deep links', () => {
  it('the optical comms unit materially out-rates Ka-band at Titan', () => {
    const laser = tables.components['com_laser'];
    const ka = tables.components['com_ka'];
    const dist = missionDistanceKm('titan');
    const rateLaser = dataRateMbps({ txPowerW: laser.txPowerW!, antennaGain: laser.antennaGain!, distanceKm: dist });
    const rateKa = dataRateMbps({ txPowerW: ka.txPowerW!, antennaGain: ka.antennaGain!, distanceKm: dist });
    expect(rateLaser).toBeGreaterThan(rateKa * 2);
    expect(rateLaser).toBeGreaterThan(0);
  });

  it('the super-heavy launcher carries the reference Titan stack', () => {
    const launcher = tables.launchers['super_heavy'];
    expect(launcher.capacityToLeoKg).toBeGreaterThan(tables.launchers['falcon_heavy'].capacityToLeoKg);
  });
});
