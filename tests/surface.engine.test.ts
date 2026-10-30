/**
 * surface.engine — planetary expedition simulation.
 * Pure functions only: no DOM, no three.js, no randomness beyond the seed.
 */
import { describe, it, expect } from 'vitest';
import {
  atBase,
  buildModule,
  collectNode,
  createSurface,
  hasModule,
  moveSurvivor,
  suitEffects,
  tickSurface,
  upgradeSuit,
  repairSuit,
  resupply,
  scoutDrone,
  unlockRover,
  levelOf,
  solOf,
  type SurfaceState,
} from '../src/game/surface/engine';
import { surfaceNodes } from '../src/game/surface/nodes';
import {
  ROVER_COST,
  SCOUT_DRONE_COST,
  SCOUT_DRONE_DURATION_HOURS,
  surfaceProfileFor,
} from '../src/game/surface/model';

const fresh = (over: Partial<SurfaceState> = {}): SurfaceState => ({
  ...createSurface({ target: 'mars', seed: 42 }),
  ...over,
});

describe('surface — creation', () => {
  it('starts a full suit and a base log entry', () => {
    const s = createSurface({ target: 'mars', seed: 1, callsign: 'nova' });
    expect(s.o2).toBe(100);
    expect(s.integrity).toBe(100);
    expect(s.status).toBe('active');
    expect(s.callsign).toBe('nova');
    expect(s.log.length).toBe(1);
    expect(Object.values(s.inventory).some((n) => n > 0)).toBe(true);
    expect(s.modules).toEqual([]);
  });

  it('falls back to Earth for orbital targets', () => {
    expect(surfaceProfileFor('leo').target).toBe('earth');
    expect(surfaceProfileFor('mars').target).toBe('mars');
    expect(surfaceProfileFor('nonsense').target).toBe('earth');
  });

  it('generates a deterministic, de-duplicated resource field', () => {
    const a = surfaceNodes(42, 'mars');
    const b = surfaceNodes(42, 'mars');
    const c = surfaceNodes(43, 'mars');
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.length).toBeGreaterThan(20);
    expect(new Set(a.map((n) => n.id)).size).toBe(a.length);
    for (const n of a) expect(Math.hypot(n.x, n.z)).toBeGreaterThan(12);
  });
});

describe('surface — survival tick', () => {
  it('drains oxygen and water over time', () => {
    const before = fresh();
    const { state } = tickSurface(before, 12);
    expect(state.o2).toBeLessThan(before.o2);
    expect(state.water).toBeLessThan(before.water);
    expect(state.hours).toBe(12);
  });

  it('counts the base as safe ground only inside the radius', () => {
    expect(atBase(fresh({ x: 0, z: 0 }))).toBe(true);
    expect(atBase(fresh({ x: 40, z: 0 }))).toBe(false);
  });

  it('an O₂ generator holds the line at base but not in the field', () => {
    const built = { ...fresh(), modules: [{ kind: 'o2gen' as const, slot: 0 }] };
    const base = tickSurface(built, 24).state;
    const field = tickSurface({ ...built, x: 30, z: 30 }, 24).state;
    expect(base.o2).toBeGreaterThan(field.o2);
  });

  it('thermal upgrades slow heat loss', () => {
    const plain = tickSurface(fresh(), 10).state;
    const upgraded = tickSurface(fresh({ upgrades: { ...fresh().upgrades, thermal: 3 } }), 10).state;
    expect(upgraded.warmth).toBeGreaterThan(plain.warmth);
  });

  it('radiation liners reduce the accumulated dose', () => {
    const plain = tickSurface(fresh(), 20).state;
    const lined = tickSurface(fresh({ upgrades: { ...fresh().upgrades, shield: 3 } }), 20).state;
    expect(lined.radiation).toBeLessThan(plain.radiation);
  });

  it('marks the team rescued when oxygen runs out', () => {
    const { state, events } = tickSurface(fresh({ o2: 0.2 }), 2);
    expect(state.status).toBe('rescued');
    expect(state.o2).toBe(0);
    expect(events.length).toBeGreaterThan(0);
    // A rescued team cannot keep ticking.
    expect(tickSurface(state, 1).state.status).toBe('rescued');
  });

  it('never pushes a meter outside 0–100', () => {
    const { state } = tickSurface(fresh({ o2: 99, warmth: 99, radiation: 99, charge: 99 }), 30);
    for (const key of ['o2', 'water', 'food', 'warmth', 'radiation', 'integrity', 'charge'] as const) {
      expect(state[key]).toBeGreaterThanOrEqual(0);
      expect(state[key]).toBeLessThanOrEqual(100);
    }
  });
});

describe('surface — gathering, building, upgrading', () => {
  it('collects a deposit once and adds the yield', () => {
    const s = fresh();
    const node = surfaceNodes(s.seed, s.target)[0];
    const first = collectNode(s, node);
    expect(first.ok).toBe(true);
    expect(first.state.inventory[node.kind]).toBeGreaterThan(s.inventory[node.kind]);
    expect(first.state.taken).toContain(node.id);
    expect(first.state.xp).toBeGreaterThan(s.xp);

    const again = collectNode(first.state, node);
    expect(again.ok).toBe(false);
    expect(again.state.inventory[node.kind]).toBe(first.state.inventory[node.kind]);
  });

  it('refuses to gather when the cargo rig is full', () => {
    const s = fresh({ inventory: { ice: 120, regolith: 0, ore: 0, crystal: 0, biomass: 0 } });
    const node = surfaceNodes(s.seed, s.target)[1];
    const res = collectNode(s, node);
    expect(res.ok).toBe(false);
  });

  it('builds a module, pays its cost and only once', () => {
    const s = fresh({ inventory: { ice: 40, regolith: 40, ore: 40, crystal: 40, biomass: 40 } });
    const res = buildModule(s, 'o2gen');
    expect(res.ok).toBe(true);
    expect(hasModule(res.state, 'o2gen')).toBe(true);
    expect(res.state.inventory.ice).toBe(s.inventory.ice - 8);
    expect(buildModule(res.state, 'o2gen').ok).toBe(false);
  });

  it('blocks a build the survivor cannot afford', () => {
    const s = fresh({ inventory: { ice: 0, regolith: 0, ore: 0, crystal: 0, biomass: 0 } });
    const res = buildModule(s, 'heater');
    expect(res.ok).toBe(false);
    expect(res.state.modules).toEqual([]);
  });

  it('upgrades a suit track to its cap', () => {
    let s = fresh({ inventory: { ice: 400, regolith: 400, ore: 400, crystal: 400, biomass: 400 } });
    for (let i = 0; i < 3; i++) {
      const res = upgradeSuit(s, 'o2');
      expect(res.ok).toBe(true);
      s = res.state;
    }
    expect(s.upgrades.o2).toBe(3);
    expect(upgradeSuit(s, 'o2').ok).toBe(false);
    expect(suitEffects(s).o2Drain).toBeLessThan(suitEffects(fresh()).o2Drain);
  });

  it('repairs and resupplies only with materials, resupply only at base', () => {
    const s = fresh({ integrity: 40, o2: 20 });
    expect(repairSuit(s).ok).toBe(true);
    expect(repairSuit(s).state.integrity).toBeGreaterThan(40);

    const away = fresh({ x: 40, z: 0 });
    expect(resupply(away).ok).toBe(false);
    expect(resupply(s).state.o2).toBe(100);
  });

  it('keeps the survivor inside the playable radius', () => {
    const moved = moveSurvivor(fresh(), 500, 0);
    expect(Math.hypot(moved.x, moved.z)).toBeLessThanOrEqual(90);
    expect(moved.walked).toBeGreaterThan(0);
  });
});

describe('surface — rover, scout drone and progress', () => {
  it('unlocks the rover once at base and deducts the cost', () => {
    const s = fresh({ inventory: { ice: 40, regolith: 40, ore: 40, crystal: 40, biomass: 40 } });
    const res = unlockRover(s);
    expect(res.ok).toBe(true);
    expect(res.state.roverUnlocked).toBe(true);
    expect(res.state.inventory.regolith).toBe(s.inventory.regolith - (ROVER_COST.regolith ?? 0));
    expect(unlockRover(res.state).ok).toBe(false);
  });

  it('refuses the rover without materials', () => {
    const poor = fresh({ inventory: { ice: 0, regolith: 0, ore: 0, crystal: 0, biomass: 0 } });
    expect(unlockRover(poor).ok).toBe(false);
  });

  it('scout drone marks the nearest free deposit and charges the cost', () => {
    const s = fresh({ inventory: { ice: 40, regolith: 40, ore: 40, crystal: 40, biomass: 40 } });
    const res = scoutDrone(s);
    expect(res.ok).toBe(true);
    const target = res.state.scoutDroneTarget;
    expect(target).not.toBeNull();
    expect(res.state.scoutDroneExpiresAt).toBe(s.hours + SCOUT_DRONE_DURATION_HOURS);
    expect(res.state.inventory.regolith).toBe(s.inventory.regolith - (SCOUT_DRONE_COST.regolith ?? 0));

    const free = surfaceNodes(s.seed, s.target).filter((n) => !s.taken.includes(n.id));
    const nearest = free.reduce((best, n) => {
      const d = Math.hypot(n.x - s.x, n.z - s.z);
      const bd = Math.hypot(best.x - s.x, best.z - s.z);
      return d < bd ? n : best;
    });
    expect(target?.id).toBe(nearest.id);
  });

  it('scout drone needs materials and an unclaimed deposit', () => {
    const poor = fresh({ inventory: { ice: 0, regolith: 0, ore: 0, crystal: 0, biomass: 0 } });
    expect(scoutDrone(poor).ok).toBe(false);
    const allTaken = fresh({
      inventory: { ice: 40, regolith: 40, ore: 40, crystal: 40, biomass: 40 },
      taken: surfaceNodes(fresh().seed, fresh().target).map((n) => n.id),
    });
    expect(scoutDrone(allTaken).ok).toBe(false);
  });

  it('derives level and sol from state', () => {
    const s = fresh({ xp: 250, hours: 30 });
    expect(levelOf(s)).toBe(1 + Math.floor(250 / 120));
    expect(solOf(s)).toBe(2);
  });
});
