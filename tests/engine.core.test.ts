import { describe, it, expect } from 'vitest';
import { computeCost, budgetEfficiency } from '../src/engine/cost';
import { systemReliability, redundantReliability } from '../src/engine/reliability';
import { computeScore } from '../src/engine/scoring';
import { rollDailyEvents, eventProbabilityPerDay } from '../src/engine/events';
import { canPlace, firstFit } from '../src/engine/builder';
import { isKnownCommand } from '../src/engine/commands';

describe('cost model', () => {
  it('total = design + hardware + launcher + ops*months', () => {
    const c = computeCost({ designCost: 100, hardwareCost: 200, launcherCost: 300, opsPerMonth: 50, durationDays: 60 });
    expect(c.operations).toBeCloseTo(100, 6);
    expect(c.total).toBeCloseTo(700, 6);
  });
  it('budget efficiency 1 when free, 0 when over', () => {
    expect(budgetEfficiency(0, 1000)).toBe(1);
    expect(budgetEfficiency(1000, 1000)).toBe(0);
    expect(budgetEfficiency(1500, 1000)).toBe(0);
  });
});

describe('reliability model', () => {
  it('series product incl. launcher (0.9*0.8*0.95=0.684)', () => {
    expect(systemReliability([0.9, 0.8], 0.95)).toBeCloseTo(0.684, 6);
  });
  it('redundancy improves 0.9 -> 0.99', () => {
    expect(redundantReliability(0.9, true)).toBeCloseTo(0.99, 6);
    expect(redundantReliability(0.9, false)).toBe(0.9);
  });
});

describe('scoring', () => {
  it('perfect mission scores 100', () => {
    const s = computeScore({
      scienceReturnedGb: 100, scienceGoalGb: 100,
      costTotal: 0, budgetCap: 1000,
      reliability: 1, survived: true, innovationPoints: 10, anomalyCount: 0,
    });
    expect(s.total).toBeCloseTo(100, 6);
    expect(s.science).toBe(40);
    expect(s.innovation).toBe(10);
  });
  it('no science + over budget + failure scores poorly', () => {
    const s = computeScore({
      scienceReturnedGb: 0, scienceGoalGb: 100,
      costTotal: 2000, budgetCap: 1000,
      reliability: 0.4, survived: false, innovationPoints: 0, anomalyCount: 5,
    });
    expect(s.total).toBeLessThan(15);
  });
});

describe('events', () => {
  it('safe mode cuts mitigatable probability to 25%', () => {
    const base = eventProbabilityPerDay(0.02, 1, false, true);
    const safe = eventProbabilityPerDay(0.02, 1, true, true);
    expect(safe).toBeCloseTo(base * 0.25, 9);
  });
  it('deterministic rolls: rng=1 triggers nothing, rng=0 triggers all', () => {
    expect(rollDailyEvents(false, 1, () => 1)).toHaveLength(0);
    expect(rollDailyEvents(false, 1, () => 0).length).toBeGreaterThan(0);
  });
  it('tutorial difficulty has zero rate', () => {
    expect(eventProbabilityPerDay(0.02, 0, false, false)).toBe(0);
  });
});

describe('builder grid', () => {
  it('rejects out-of-bounds placement on 7x5', () => {
    expect(canPlace([], 6, 4, 2, 2)).toBe(false);
    expect(canPlace([], 0, 0, 7, 5)).toBe(true);
  });
  it('rejects overlap', () => {
    const parts = [{ componentId: 'a', x: 0, y: 0, w: 2, h: 2, rotated: false }];
    expect(canPlace(parts, 1, 1, 2, 2)).toBe(false);
    expect(canPlace(parts, 2, 0, 2, 2)).toBe(true);
  });
  it('firstFit finds a free cell', () => {
    expect(firstFit([], 1, 1)).toEqual({ x: 0, y: 0 });
    expect(firstFit([{ componentId: 'a', x: 0, y: 0, w: 7, h: 5, rotated: false }], 1, 1)).toBeNull();
  });
});

describe('command catalog', () => {
  it('knows core commands, rejects fakes', () => {
    expect(isKnownCommand('FIRE')).toBe(true);
    expect(isKnownCommand('WARP')).toBe(true);
    expect(isKnownCommand('SELF_DESTRUCT')).toBe(false);
  });
});
