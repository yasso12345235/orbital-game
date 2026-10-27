import { describe, it, expect } from 'vitest';
import {
  MISSIONS, COMPONENTS, LAUNCHERS, DIFFICULTIES, GAME_EVENTS_DATA,
  lookupTables, validateDataIntegrity, budgetCapFor,
} from '../src/engine/data';
import { resolveDesign } from '../src/engine/validation';

describe('game data integrity (step 2)', () => {
  it('has the full mission roster (7 + 2 historical)', () => {
    expect(MISSIONS.length).toBeGreaterThanOrEqual(9);
    for (const id of ['cubesat_imaging', 'comsat_gto', 'polar_climate', 'lunar_probe', 'mars_orbiter', 'jupiter_probe', 'europa_mission']) {
      expect(MISSIONS.some((m) => m.id === id), id).toBe(true);
    }
  });
  it('has 5 launchers from Electron to Heavy with ordered capacities', () => {
    expect(LAUNCHERS.length).toBeGreaterThanOrEqual(5);
    const caps = [...LAUNCHERS].sort((a, b) => a.capacityToLeoKg - b.capacityToLeoKg).map((l) => l.capacityToLeoKg);
    expect(caps[0]).toBeLessThanOrEqual(300);
    expect(caps[caps.length - 1]).toBeGreaterThanOrEqual(60000);
  });
  it('covers all 6 builder slots with multiple options', () => {
    for (const cat of ['bus', 'power', 'propulsion', 'comms', 'payload', 'thermal'] as const) {
      expect(COMPONENTS.filter((c) => c.category === cat).length).toBeGreaterThanOrEqual(2);
    }
    expect(COMPONENTS.length).toBeGreaterThanOrEqual(18);
  });
  it('every number carries a source note + simplification flag', () => {
    for (const c of COMPONENTS) expect(c.source, c.id).toBeTruthy();
    for (const l of LAUNCHERS) expect(l.source, l.id).toBeTruthy();
    for (const m of MISSIONS) expect(m.source, m.id).toBeTruthy();
  });
  it('bilingual labels present (Arabic + English)', () => {
    for (const m of MISSIONS) {
      expect(m.name, m.id).toBeTruthy();
      expect(m.nameAr, m.id).toBeTruthy();
      expect(m.descriptionAr, m.id).toBeTruthy();
    }
    expect(GAME_EVENTS_DATA.every((e) => e.nameAr && e.mitigationAr)).toBe(true);
    expect(DIFFICULTIES.every((d) => d.nameAr)).toBe(true);
  });
  it('validateDataIntegrity reports zero errors', () => {
    expect(validateDataIntegrity()).toEqual([]);
  });
  it('difficulty budget caps match engine contract', () => {
    expect(budgetCapFor('tutorial')).toBe(5_000_000);
    expect(budgetCapFor('normal')).toBe(2_500_000);
    expect(budgetCapFor('engineer')).toBe(1_500_000);
    expect(budgetCapFor('director')).toBe(900_000);
  });
});

describe('real-data mission feasibility', () => {
  const tables = lookupTables();
  const designFor = (missionId: string, launcherId: string, compIds: Record<string, string>, propKg: number) => ({
    missionId, launcherId,
    components: compIds as any,
    redundancy: { bus: false, power: false, propulsion: false, comms: false, payload: false, thermal: false } as any,
    propellantMassKg: propKg,
  });

  it('CubeSat on Electron goes (tutorial)', () => {
    const r = resolveDesign(
      designFor('cubesat_imaging', 'electron',
        { bus: 'bus_cubesat', power: 'pow_body', propulsion: 'prop_monoprop', comms: 'com_uhf', payload: 'pay_cam', thermal: 'thm_passive' }, 30),
      tables, budgetCapFor('tutorial'),
    );
    expect(r.go).toBe(true);
    expect(r.budget.costTotal).toBeLessThan(budgetCapFor('tutorial'));
  });
  it('Mars orbiter needs Falcon-class mass and Ka link (normal)', () => {
    const good = resolveDesign(
      designFor('mars_orbiter', 'falcon9',
        { bus: 'bus_medium', power: 'pow_large', propulsion: 'prop_biprop', comms: 'com_ka', payload: 'pay_multispec', thermal: 'thm_active' }, 1550),
      tables, budgetCapFor('normal'),
    );
    expect(good.checks.find((c) => c.id === 'mass')?.pass).toBe(true);
    expect(good.checks.find((c) => c.id === 'dv')?.pass).toBe(true);
    // Same spacecraft on Electron must fail mass
    const tiny = resolveDesign(
      designFor('mars_orbiter', 'electron',
        { bus: 'bus_medium', power: 'pow_large', propulsion: 'prop_biprop', comms: 'com_ka', payload: 'pay_multispec', thermal: 'thm_active' }, 1300),
      tables, budgetCapFor('normal'),
    );
    expect(tiny.checks.find((c) => c.id === 'mass')?.pass).toBe(false);
  });
  it('Europa is only feasible heavy (mass + dv gate)', () => {
    const heavy = resolveDesign(
      designFor('europa_mission', 'falcon_heavy',
        { bus: 'bus_heavy', power: 'pow_xl', propulsion: 'prop_hydrolox', comms: 'com_ka', payload: 'pay_radar', thermal: 'thm_deep' }, 5600),
      tables, budgetCapFor('tutorial'),
    );
    expect(heavy.checks.find((c) => c.id === 'mass')?.pass).toBe(true);
    // Cold-gas on Europa must fail dv badly
    const weak = resolveDesign(
      designFor('europa_mission', 'falcon_heavy',
        { bus: 'bus_heavy', power: 'pow_xl', propulsion: 'prop_coldgas', comms: 'com_ka', payload: 'pay_radar', thermal: 'thm_deep' }, 20),
      tables, budgetCapFor('tutorial'),
    );
    expect(weak.checks.find((c) => c.id === 'dv')?.pass).toBe(false);
  });
});
