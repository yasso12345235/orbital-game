/**
 * Simulation — pure state machine.
 * UI / audio / 3D are driven BY this state, never the reverse.
 * Commands only mutate via `dispatchCommand`; time advances via `tickDays`.
 */
import { GAME_EVENTS, rollDailyEvents, type GameEvent } from './events';
import type { CommandName, DifficultyId, SimEventEntry, SimState } from './types';

export const DIFFICULTY_EVENT_RATE: Record<DifficultyId, number> = {
  tutorial: 0, // no random events
  normal: 1,
  engineer: 1.6,
  director: 2.4,
};

export const COMMAND_ENERGY_COST: Record<string, number> = {
  SCAN: 5, // Wh per scan
  COM: 8, // Wh per downlink burst
  FIRE: 2, // Wh + propellant
};

export const COMMAND_PROP_COST_KG = 8; // kg per FIRE burn (game step; dv derived from rocket eq externally)

export interface DispatchResult {
  state: SimState;
  accepted: boolean;
  message: string;
}

let logSeq = 0;

function log(state: SimState, day: number, kind: string, message: string, severity: SimEventEntry['severity']): SimState {
  void logSeq;
  return { ...state, eventLog: [...state.eventLog, { day, kind, message, severity }] };
}

export function createSim(opts: {
  missionId: string;
  difficulty: DifficultyId;
  durationDays: number;
  propKg: number;
  batteryCapacityWh: number;
  dvMps: number;
  scienceGoalGb: number;
}): SimState {
  return {
    missionId: opts.missionId,
    difficulty: opts.difficulty,
    elapsedDays: 0,
    durationDays: opts.durationDays,
    propRemainingKg: opts.propKg,
    batteryChargeWh: opts.batteryCapacityWh,
    batteryCapacityWh: opts.batteryCapacityWh,
    dataStoredGb: 0,
    dataReturnedGb: 0,
    scienceGoalGb: opts.scienceGoalGb,
    dvRemainingMps: opts.dvMps,
    safeMode: false,
    failed: false,
    complete: false,
    failureReason: null,
    failureDay: null,
    eventLog: [{ day: 0, kind: 'launch', message: 'Liftoff — mission clock started.', severity: 'info' }],
    timeScale: 1,
  };
}

/** Pure command reducer. Refused commands return accepted=false with a reason (for error buzz). */
export function dispatchCommand(state: SimState, cmd: CommandName, ctx?: { energyGenPerDayWh?: number }): DispatchResult {
  if (state.failed || state.complete) return { state, accepted: false, message: 'Mission already ended.' };
  switch (cmd) {
    case 'FIRE': {
      if (state.propRemainingKg <= 0)
        return { state, accepted: false, message: 'FIRE refused: zero propellant.' };
      const used = Math.min(COMMAND_PROP_COST_KG, state.propRemainingKg);
      const frac = state.propRemainingKg > 0 ? used / (state.propRemainingKg + 200) : 0; // placeholder burn fraction; real dv recomputed by caller via propulsion.ts
      void frac;
      const next: SimState = {
        ...state,
        propRemainingKg: state.propRemainingKg - used,
        batteryChargeWh: Math.max(0, state.batteryChargeWh - COMMAND_ENERGY_COST.FIRE),
      };
      return { state: log(next, state.elapsedDays, 'burn', `FIRE: burn used ${used.toFixed(1)} kg propellant.`, 'info'), accepted: true, message: 'Burn executed.' };
    }
    case 'SCAN': {
      const cost = state.safeMode ? COMMAND_ENERGY_COST.SCAN * 0.5 : COMMAND_ENERGY_COST.SCAN;
      if (state.batteryChargeWh < cost)
        return { state, accepted: false, message: 'SCAN refused: battery too low.' };
      const gain = state.safeMode ? 0.4 : 1.2; // Gb per scan; scaled by payload externally
      const next: SimState = {
        ...state,
        batteryChargeWh: state.batteryChargeWh - cost,
        dataStoredGb: state.dataStoredGb + gain,
      };
      void ctx;
      return { state: log(next, state.elapsedDays, 'scan', `SCAN: +${gain.toFixed(1)} Gb stored.`, 'info'), accepted: true, message: 'Scan complete.' };
    }
    case 'COM': {
      const cost = COMMAND_ENERGY_COST.COM;
      if (state.batteryChargeWh < cost)
        return { state, accepted: false, message: 'COM refused: battery too low.' };
      if (state.dataStoredGb <= 0)
        return { state, accepted: false, message: 'COM refused: no stored data.' };
      const sent = Math.min(state.dataStoredGb, 2.5); // Gb per burst; link budget scales this externally
      const next: SimState = {
        ...state,
        batteryChargeWh: state.batteryChargeWh - cost,
        dataStoredGb: state.dataStoredGb - sent,
        dataReturnedGb: state.dataReturnedGb + sent,
      };
      return { state: log(next, state.elapsedDays, 'com', `COM: downlinked ${sent.toFixed(1)} Gb.`, 'info'), accepted: true, message: 'Downlink complete.' };
    }
    case 'SHLD': {
      const next = { ...state, safeMode: !state.safeMode };
      return {
        state: log(next, state.elapsedDays, 'shield', next.safeMode ? 'SHLD: safe mode ON — loads and science reduced.' : 'SHLD: safe mode OFF.', 'info'),
        accepted: true,
        message: next.safeMode ? 'Safe mode on.' : 'Safe mode off.',
      };
    }
    case 'WARP': {
      const order: SimState['timeScale'][] = [1, 10, 100];
      const nextScale = order[(order.indexOf(state.timeScale) + 1) % order.length];
      return { state: { ...state, timeScale: nextScale }, accepted: true, message: `Time acceleration x${nextScale}.` };
    }
    case 'NAV':
      return { state: log(state, state.elapsedDays, 'nav', 'NAV: orbit lock confirmed.', 'info'), accepted: true, message: 'Nav locked.' };
    default:
      return { state, accepted: true, message: `${cmd} acknowledged.` };
  }
}

/** Advance the clock by dtDays: recharge battery, check completion. Event rolls injected by caller. */
export function tickDays(
  state: SimState,
  dtDays: number,
  opts?: { solarChargeWhPerDay?: number; loadWhPerDay?: number; forcedEvents?: GameEvent[] },
): SimState {
  if (state.failed || state.complete) return state;
  const charge = opts?.solarChargeWhPerDay ?? 40;
  const load = (opts?.loadWhPerDay ?? 30) * (state.safeMode ? 0.6 : 1);
  const net = (charge - load) * dtDays;
  let batteryChargeWh = Math.min(state.batteryCapacityWh, Math.max(0, state.batteryChargeWh + net));
  let next: SimState = { ...state, elapsedDays: state.elapsedDays + dtDays, batteryChargeWh };

  // Apply forced events (deterministic path for tests / scripted scenarios)
  for (const ev of opts?.forcedEvents ?? []) {
    next = applyEvent(next, ev);
    if (next.failed) break;
  }

  if (!next.failed && next.elapsedDays >= next.durationDays) {
    next = { ...next, complete: true };
    next = log(next, next.elapsedDays, 'complete', `Mission window complete: ${next.dataReturnedGb.toFixed(1)} Gb returned.`, 'info');
  }
  // Auto-drop WARP to x1 on critical events
  if (next.eventLog.length > state.eventLog.length) {
    const last = next.eventLog[next.eventLog.length - 1];
    if (last.severity === 'critical' && next.timeScale !== 1) next = { ...next, timeScale: 1 };
  }
  return next;
}

/** Apply a random/scenario event to state. Exported for tests. */
export function applyEvent(state: SimState, ev: GameEvent): SimState {
  let next = state as SimState;
  const mitigated = state.safeMode && ev.mitigatedBySafeMode;
  switch (ev.id) {
    case 'battery_degradation': {
      const mult = ev.effect.batteryCapacityMult ?? 0.92;
      const cap = next.batteryCapacityWh * mult;
      next = { ...next, batteryCapacityWh: cap, batteryChargeWh: Math.min(next.batteryChargeWh, cap) };
      next = log(next, next.elapsedDays, ev.id, `Battery degradation: capacity now ${cap.toFixed(0)} Wh.`, 'warn');
      break;
    }
    case 'fuel_leak': {
      const loss = mitigated ? 0 : (ev.effect.propLossKg ?? 5);
      next = { ...next, propRemainingKg: Math.max(0, next.propRemainingKg - loss) };
      next = log(next, next.elapsedDays, ev.id, loss > 0 ? `Fuel leak: −${loss.toFixed(1)} kg propellant.` : `Fuel leak contained by safe mode.`, loss > 0 ? 'warn' : 'info');
      break;
    }
    case 'comms_loss': {
      const loss = Math.min(next.dataStoredGb, ev.effect.dataLossGb ?? 2);
      next = { ...next, dataStoredGb: next.dataStoredGb - loss };
      next = log(next, next.elapsedDays, ev.id, `Comms loss: −${loss.toFixed(1)} Gb stored data.`, 'warn');
      break;
    }
    case 'solar_storm':
    case 'overheating':
    case 'debris': {
      if (mitigated) {
        next = log(next, next.elapsedDays, ev.id, `${ev.name} weathered in safe mode (no damage).`, 'info');
      } else {
        next = log(next, next.elapsedDays, ev.id, `${ev.name}: anomaly recorded. ${ev.mitigation}`, 'critical');
        // Critical anomaly at low margins can end the mission (simplified): debris at 0 prop = loss of control
        if (ev.id === 'debris' && next.propRemainingKg <= 0.01) {
          next = { ...next, failed: true, failureReason: 'Debris strike with no propellant for avoidance — loss of spacecraft.', failureDay: next.elapsedDays };
        }
      }
      break;
    }
    default:
      next = log(next, next.elapsedDays, ev.id, ev.name, 'info');
  }
  void GAME_EVENTS;
  return next;
}

/** Full operational tick used by the game loop: power, science accrual, auto-downlink, events, failures. */
export interface TickMissionOptions {
  /** Average solar charge available per day (Wh/day), accounting for eclipse. */
  solarChargeWhPerDay: number;
  /** Spacecraft load per day (Wh/day) before safe-mode reduction. */
  loadWhPerDay: number;
  /** Science accrual rate (Gb/day) at full payload health. */
  scienceRatePerDay: number;
  /** Onboard storage cap (Gb); overflow is lost. */
  storageCapGb: number;
  /** Fraction of stored data auto-downlinked per day when a link exists. */
  autoDownlinkFracPerDay: number;
  /** Difficulty event rate multiplier (0 = off). */
  eventRate: number;
  /** Injectable RNG for deterministic tests. */
  rng?: () => number;
}

export function tickMission(state: SimState, dtDays: number, opts: TickMissionOptions): SimState {
  if (state.failed || state.complete) return state;
  let next: SimState = { ...state, elapsedDays: state.elapsedDays + dtDays };

  // --- Power ---
  const load = opts.loadWhPerDay * (next.safeMode ? 0.6 : 1);
  const net = (opts.solarChargeWhPerDay - load) * dtDays;
  next = { ...next, batteryChargeWh: Math.min(next.batteryCapacityWh, Math.max(0, next.batteryChargeWh + net)) };

  // --- Science accrual (instruments run continuously; SCAN command adds bursts) ---
  const rate = opts.scienceRatePerDay * (next.safeMode ? 0.4 : 1);
  const stored = Math.min(opts.storageCapGb, next.dataStoredGb + rate * dtDays);
  const overflow = next.dataStoredGb + rate * dtDays - stored;
  next = { ...next, dataStoredGb: stored };
  if (overflow > 0.5) next = log(next, next.elapsedDays, 'storage', `Storage full: ${overflow.toFixed(1)} Gb of science lost. Downlink with COM.`, 'warn');

  // --- Auto-downlink (a fraction each day; COM command bursts are faster) ---
  const down = Math.min(next.dataStoredGb, next.dataStoredGb * opts.autoDownlinkFracPerDay * dtDays);
  if (down > 0) next = { ...next, dataStoredGb: next.dataStoredGb - down, dataReturnedGb: next.dataReturnedGb + down };

  // --- Random events ---
  if (opts.eventRate > 0) {
    const events = rollDailyEvents(next.safeMode, opts.eventRate, opts.rng ?? Math.random);
    for (const ev of events) {
      next = applyEvent(next, ev);
      if (next.failed) break;
    }
  }

  // --- Power-loss failure (no battery left at all) ---
  if (!next.failed && next.batteryChargeWh <= 0 && net < 0) {
    next = {
      ...next,
      failed: true,
      failureReason: 'Battery depleted with no solar margin — spacecraft lost. Add solar area or cut loads.',
      failureDay: next.elapsedDays,
    };
    next = log(next, next.elapsedDays, 'power_loss', 'CRITICAL: battery empty, power loss.', 'critical');
  }

  // --- Completion ---
  if (!next.failed && next.elapsedDays >= next.durationDays) {
    next = { ...next, complete: true };
    next = log(next, next.elapsedDays, 'complete', `Mission window complete: ${next.dataReturnedGb.toFixed(1)} Gb returned.`, 'info');
  }

  // --- Auto-drop WARP to x1 on critical events ---
  if (next.eventLog.length > state.eventLog.length) {
    const last = next.eventLog[next.eventLog.length - 1];
    if (last.severity === 'critical' && next.timeScale !== 1) next = { ...next, timeScale: 1 };
  }
  return next;
}
