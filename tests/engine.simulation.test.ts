import { describe, it, expect } from 'vitest';
import { createSim, dispatchCommand, tickDays, applyEvent, COMMAND_PROP_COST_KG } from '../src/engine/simulation';
import { GAME_EVENTS } from '../src/engine/events';

describe('simulation state machine', () => {
  const base = () =>
    createSim({ missionId: 'cubesat', difficulty: 'normal', durationDays: 30, propKg: 100, batteryCapacityWh: 200, dvMps: 1000, scienceGoalGb: 50 });

  it('FIRE consumes propellant, refused at zero fuel', () => {
    const s = base();
    const ok = dispatchCommand(s, 'FIRE');
    expect(ok.accepted).toBe(true);
    expect(ok.state.propRemainingKg).toBe(100 - COMMAND_PROP_COST_KG);
    const empty = { ...s, propRemainingKg: 0 };
    expect(dispatchCommand(empty, 'FIRE').accepted).toBe(false);
  });
  it('SCAN stores data and drains battery; safe mode yields less', () => {
    const s = base();
    const a = dispatchCommand(s, 'SCAN');
    expect(a.state.dataStoredGb).toBeGreaterThan(0);
    const safe = dispatchCommand({ ...s, safeMode: true }, 'SCAN');
    expect(safe.state.dataStoredGb).toBeLessThan(a.state.dataStoredGb);
  });
  it('COM needs stored data and drains it into returned', () => {
    const s = base();
    expect(dispatchCommand(s, 'COM').accepted).toBe(false); // nothing stored
    const withData = dispatchCommand(s, 'SCAN').state;
    const com = dispatchCommand(withData, 'COM');
    expect(com.accepted).toBe(true);
    expect(com.state.dataReturnedGb).toBeGreaterThan(0);
  });
  it('SHLD toggles, WARP cycles 1->10->100->1', () => {
    let s = base();
    s = dispatchCommand(s, 'SHLD').state;
    expect(s.safeMode).toBe(true);
    s = dispatchCommand(s, 'WARP').state;
    expect(s.timeScale).toBe(10);
    s = dispatchCommand(s, 'WARP').state;
    expect(s.timeScale).toBe(100);
    s = dispatchCommand(s, 'WARP').state;
    expect(s.timeScale).toBe(1);
  });
  it('tickDays charges battery and completes at duration', () => {
    let s = { ...base(), batteryChargeWh: 10 };
    s = tickDays(s, 1, { solarChargeWhPerDay: 100, loadWhPerDay: 10 });
    expect(s.batteryChargeWh).toBeGreaterThan(10);
    s = tickDays(s, 30);
    expect(s.complete).toBe(true);
  });
  it('battery degradation shrinks capacity; debris with no fuel fails mission', () => {
    let s = base();
    const deg = GAME_EVENTS.find((e) => e.id === 'battery_degradation')!;
    s = applyEvent(s, deg);
    expect(s.batteryCapacityWh).toBeLessThan(200);
    const debris = GAME_EVENTS.find((e) => e.id === 'debris')!;
    const dead = applyEvent({ ...s, propRemainingKg: 0 }, debris);
    expect(dead.failed).toBe(true);
    expect(dead.failureReason).toMatch(/Debris/);
  });
  it('critical event drops WARP to x1', () => {
    let s = { ...base(), timeScale: 100 as 1 | 10 | 100 };
    const storm = GAME_EVENTS.find((e) => e.id === 'solar_storm')!;
    s = tickDays(s, 1, { forcedEvents: [storm] });
    expect(s.timeScale).toBe(1);
  });
});
