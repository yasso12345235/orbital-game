/**
 * tickMission — the operational game loop: power, science accrual, storage cap,
 * auto-downlink, random events, warp auto-drop and end states.
 */
import { describe, it, expect } from 'vitest';
import { createSim, tickMission, type TickMissionOptions } from '../src/engine/simulation';

const base = () =>
  createSim({
    missionId: 'cubesat',
    difficulty: 'normal',
    durationDays: 100,
    propKg: 100,
    batteryCapacityWh: 500,
    dvMps: 1200,
    scienceGoalGb: 60,
  });

const opts = (over: Partial<TickMissionOptions> = {}): TickMissionOptions => ({
  solarChargeWhPerDay: 120,
  loadWhPerDay: 60,
  scienceRatePerDay: 2,
  storageCapGb: 24,
  autoDownlinkFracPerDay: 0.1,
  eventRate: 0,
  rng: () => 0.99,
  ...over,
});

describe('tickMission — operations loop', () => {
  it('advances the clock and charges the battery within capacity', () => {
    const s = tickMission({ ...base(), batteryChargeWh: 100 }, 5, opts());
    expect(s.elapsedDays).toBe(5);
    // 100 + (120-60)*5 = 400
    expect(s.batteryChargeWh).toBeCloseTo(400, 5);
  });

  it('clamps battery at capacity and does not go below zero silently', () => {
    const full = tickMission({ ...base(), batteryChargeWh: 490 }, 5, opts());
    expect(full.batteryChargeWh).toBe(500);
    const net = opts({ solarChargeWhPerDay: 0, loadWhPerDay: 100 });
    const drained = tickMission({ ...base(), batteryChargeWh: 30 }, 1, net);
    expect(drained.batteryChargeWh).toBe(0);
  });

  it('accrues science, caps storage and warns when science is lost', () => {
    // 2 Gb/day × 10 days = 20 Gb vs cap 12 → 8 Gb lost
    const s = tickMission(base(), 10, opts({ autoDownlinkFracPerDay: 0, storageCapGb: 12 }));
    expect(s.dataStoredGb).toBeCloseTo(12, 5);
    const lost = s.eventLog.find((e) => e.kind === 'storage');
    expect(lost).toBeTruthy();
    expect(lost!.severity).toBe('warn');
    expect(lost!.message).toMatch(/lost/i);
  });

  it('auto-downlinks a fraction of stored data each day', () => {
    const s = tickMission(base(), 10, opts()); // 10% per day over 10 days
    expect(s.dataReturnedGb).toBeGreaterThan(8);
    expect(s.dataStoredGb).toBeLessThan(4);
    expect(s.dataReturnedGb + s.dataStoredGb).toBeLessThanOrEqual(24 + 0.001);
  });

  it('safe mode halves the load and cuts science accrual', () => {
    const normal = tickMission({ ...base(), batteryChargeWh: 100 }, 1, opts({ autoDownlinkFracPerDay: 0 }));
    const safe = tickMission({ ...base(), batteryChargeWh: 100, safeMode: true }, 1, opts({ autoDownlinkFracPerDay: 0 }));
    expect(safe.batteryChargeWh).toBeGreaterThan(normal.batteryChargeWh);
    expect(safe.dataStoredGb).toBeLessThan(normal.dataStoredGb);
  });

  it('produces no random anomaly events at tutorial event rate 0', () => {
    const s = tickMission(base(), 60, opts({ eventRate: 0, rng: () => 0 }));
    const eventKinds = ['solar_storm', 'debris', 'battery_degradation', 'comms_loss', 'fuel_leak', 'overheating'];
    expect(s.eventLog.filter((e) => eventKinds.includes(e.kind))).toHaveLength(0);
    expect(s.eventLog.some((e) => e.severity === 'critical')).toBe(false);
    expect(s.failed).toBe(false);
  });

  it('critical anomalies auto-drop time acceleration to ×1', () => {
    // first roll triggers solar_storm (2% per day at rate 1), the rest miss
    let first = true;
    const rng = () => {
      if (first) {
        first = false;
        return 0.001;
      }
      return 0.99;
    };
    const s = tickMission({ ...base(), timeScale: 100 }, 1, opts({ eventRate: 1, rng }));
    expect(s.timeScale).toBe(1);
    expect(s.eventLog.some((e) => e.severity === 'critical')).toBe(true);
    expect(s.failed).toBe(false); // anomaly recorded, craft survives with propellant
  });

  it('fails the mission when the battery is empty with negative net power', () => {
    const s = tickMission(
      { ...base(), batteryChargeWh: 10 },
      3,
      opts({ solarChargeWhPerDay: 0, loadWhPerDay: 200 }),
    );
    expect(s.failed).toBe(true);
    expect(s.failureReason).toMatch(/battery/i);
    expect(s.failureDay).toBeGreaterThan(0);
    expect(s.eventLog.some((e) => e.kind === 'power_loss' && e.severity === 'critical')).toBe(true);
  });

  it('completes the mission window and further ticks are inert', () => {
    const s = tickMission(base(), 100, opts());
    expect(s.complete).toBe(true);
    expect(s.eventLog.some((e) => e.kind === 'complete')).toBe(true);
    const again = tickMission(s, 10, opts());
    expect(again).toBe(s);
  });
});
