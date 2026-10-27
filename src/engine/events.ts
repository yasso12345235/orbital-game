/**
 * Random events with mitigations. Pure tables + pure roll logic (injectable RNG for tests).
 */
export interface GameEvent {
  id: 'solar_storm' | 'debris' | 'battery_degradation' | 'comms_loss' | 'fuel_leak' | 'overheating';
  name: string;
  description: string;
  mitigation: string; // player action that mitigates
  mitigatedBySafeMode: boolean;
  /** Fractional effect applied when unmitigated. */
  effect: {
    batteryCapacityMult?: number; // e.g. 0.9 = lose 10%
    propLossKg?: number;
    dataLossGb?: number;
    reliabilityPenalty?: number;
    powerDrawW?: number;
  };
  baseRatePerDay: number; // at Normal difficulty
}

export const GAME_EVENTS: GameEvent[] = [
  {
    id: 'solar_storm',
    name: 'Solar storm',
    description: 'Charged particles degrade panels and threaten electronics.',
    mitigation: 'Enable SHLD (safe mode) to ride it out.',
    mitigatedBySafeMode: true,
    effect: { reliabilityPenalty: 0.05, powerDrawW: 20 },
    baseRatePerDay: 0.02,
  },
  {
    id: 'debris',
    name: 'Debris conjunction',
    description: 'Tracked fragment on close approach.',
    mitigation: 'FIRE avoidance burn (costs propellant) or accept risk.',
    mitigatedBySafeMode: false,
    effect: { reliabilityPenalty: 0.08 },
    baseRatePerDay: 0.015,
  },
  {
    id: 'battery_degradation',
    name: 'Battery degradation',
    description: 'Cells lose capacity after deep cycling.',
    mitigation: 'Larger battery margin in design; reduce loads.',
    mitigatedBySafeMode: false,
    effect: { batteryCapacityMult: 0.92 },
    baseRatePerDay: 0.01,
  },
  {
    id: 'comms_loss',
    name: 'Comms loss',
    description: 'Ground-station dropout / pointing error.',
    mitigation: 'COM retry; higher-gain antenna in design.',
    mitigatedBySafeMode: false,
    effect: { dataLossGb: 2 },
    baseRatePerDay: 0.02,
  },
  {
    id: 'fuel_leak',
    name: 'Fuel leak',
    description: 'Valve seal weep detected.',
    mitigation: 'None in flight — design reliable propulsion.',
    mitigatedBySafeMode: false,
    effect: { propLossKg: 5 },
    baseRatePerDay: 0.008,
  },
  {
    id: 'overheating',
    name: 'Overheating',
    description: 'Thermal excursion on sun-facing side.',
    mitigation: 'SHLD safe mode reduces payload draw and heat.',
    mitigatedBySafeMode: true,
    effect: { reliabilityPenalty: 0.04, powerDrawW: 15 },
    baseRatePerDay: 0.012,
  },
];

export function eventProbabilityPerDay(baseRate: number, difficultyRate: number, inSafeMode: boolean, mitigatedBySafe: boolean): number {
  let p = baseRate * difficultyRate;
  if (inSafeMode && mitigatedBySafe) p *= 0.25; // safe mode cuts mitigatable events to 25%
  return Math.min(1, Math.max(0, p));
}

/** Roll one day of events. Returns triggered event ids. RNG injectable for determinism. */
export function rollDailyEvents(
  safeMode: boolean,
  difficultyRate: number,
  rng: () => number = Math.random,
): GameEvent[] {
  const out: GameEvent[] = [];
  for (const ev of GAME_EVENTS) {
    const p = eventProbabilityPerDay(ev.baseRatePerDay, difficultyRate, safeMode, ev.mitigatedBySafeMode);
    if (rng() < p) out.push(ev);
  }
  return out;
}
