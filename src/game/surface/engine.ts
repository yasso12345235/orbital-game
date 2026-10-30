/**
 * surface/engine.ts — the planetary expedition simulation.
 *
 * Pure and deterministic: same state + same hours ⇒ same result. No React, no
 * three.js, no Math.random (node fields are seeded). The store only calls in,
 * the HUD only reads out, the 3D scene only visualises.
 */
import {
  BASE_RADIUS,
  DRAIN,
  ENDLESS_MAX_PRESSURE,
  MODULE_IDS,
  MODULES,
  NODE_YIELD,
  RESOURCE_IDS,
  ROVER_COST,
  SCOUT_DRONE_COST,
  SCOUT_DRONE_DURATION_HOURS,
  SOL_GOALS,
  STARTING_INVENTORY,
  UPGRADES,
  WEATHER_EFFECTS,
  XP,
  endlessPressure,
  levelForXp,
  pickSolGoal,
  surfaceProfileFor,
  type ModuleKind,
  type ResourceId,
  type SolGoal,
  type SurfaceProfile,
  type UpgradeId,
  type WeatherId,
} from './model';
import { surfaceNodes } from './nodes';

export interface SurfaceNode {
  id: number;
  kind: ResourceId;
  x: number;
  z: number;
  scale: number;
}

export interface BuiltModule {
  kind: ModuleKind;
  /** Base ring slot 0–5 — fixed so the base is stable across reloads. */
  slot: number;
}

export interface SurfaceLogEntry {
  h: number;
  msg: string;
  kind: 'info' | 'good' | 'warn' | 'bad';
}

export interface SurfaceState {
  target: string;
  callsign: string;
  suitColor: string;
  seed: number;
  /** Survivor position in metres from the touchdown point. */
  x: number;
  z: number;
  /** Local hours elapsed since touchdown. */
  hours: number;
  o2: number;
  water: number;
  food: number;
  warmth: number;
  /** Accumulated radiation dose, 0–100. */
  radiation: number;
  integrity: number;
  charge: number;
  xp: number;
  upgrades: Record<UpgradeId, number>;
  modules: BuiltModule[];
  inventory: Record<ResourceId, number>;
  taken: number[];
  gathered: number;
  walked: number;
  /** Current surface weather (deterministic, seeded). */
  weather: WeatherId;
  /** Hours elapsed in the current weather spell. */
  weatherHours: number;
  /** Rover unlocked status — increases surface speed. */
  roverUnlocked: boolean;
  /** Endless survival: life-support pressure rises every sol. */
  endless: boolean;
  /** Current sol (24h) survival objective. */
  currentSolGoal: SolGoal | null;
  /** IDs of completed sol goals. */
  solGoalsCompleted: string[];
  /** Last sol number for which a goal was assigned. */
  lastSol: number;
  /** Scout drone target (nearest free deposit) and expiry hour. */
  scoutDroneTarget: SurfaceNode | null;
  scoutDroneExpiresAt: number;
  status: 'active' | 'rescued';
  log: SurfaceLogEntry[];
}

export interface SuitEffects {
  o2Drain: number;
  warmthDrain: number;
  radiationDose: number;
  speed: number;
  capacity: number;
  solar: number;
}

export interface SurfaceEvent {
  msg: string;
  kind: SurfaceLogEntry['kind'];
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

const WEATHER_IDS: WeatherId[] = ['clear', 'dust_storm', 'radiation_spell', 'cold_snap', 'heat_wave'];

/** Pick the weather spell for a 6-hour block, deterministic from seed + hours. */
function pickWeather(profile: SurfaceProfile, seed: number, hours: number): WeatherId {
  const block = Math.floor(hours / 6);
  const roll = ((hashString(`${seed}:${block}`) >>> 0) / 0xffffffff);
  const weights = WEATHER_IDS.map((id) => profile.weatherBias[id] ?? 0);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = roll * total;
  for (let i = 0; i < WEATHER_IDS.length; i++) {
    r -= weights[i];
    if (r <= 0) return WEATHER_IDS[i];
  }
  return WEATHER_IDS[WEATHER_IDS.length - 1];
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
export function rngFrom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CALLSIGNS = ['NOVA', 'ORION', 'VEGA', 'HELIOS', 'LYRA', 'ATLAS'];

export function defaultCallsign(seed: number): string {
  return CALLSIGNS[seed % CALLSIGNS.length];
}

export interface CreateSurfaceInput {
  target: string;
  seed?: number;
  callsign?: string;
  suitColor?: string;
  endless?: boolean;
}

export function createSurface(input: CreateSurfaceInput): SurfaceState {
  const profile = surfaceProfileFor(input.target);
  const seed = (input.seed ?? Date.now()) >>> 0;
  return {
    target: profile.target,
    callsign: input.callsign ?? defaultCallsign(seed),
    suitColor: input.suitColor ?? '#e9c37c',
    seed,
    x: 3,
    z: 3,
    hours: 0,
    o2: 100,
    water: 100,
    food: 100,
    warmth: 100,
    radiation: 0,
    integrity: 100,
    charge: 100,
    xp: 0,
    upgrades: { o2: 0, thermal: 0, shield: 0, boots: 0, cargo: 0, solar: 0 },
    modules: [],
    inventory: { ...STARTING_INVENTORY },
    taken: [],
    gathered: 0,
    walked: 0,
    weather: 'clear',
    weatherHours: 0,
    roverUnlocked: false,
    endless: input.endless === true,
    currentSolGoal: null,
    solGoalsCompleted: [],
    lastSol: 0,
    scoutDroneTarget: null,
    scoutDroneExpiresAt: 0,
    status: 'active',
    log: [
      {
        h: 0,
        msg: `Touchdown on ${profile.nameEn}. Base camp established at the lander.`,
        kind: 'good',
      },
    ],
  };
}

/* ------------------------------------------------------------------ derived */

export function suitEffects(state: SurfaceState): SuitEffects {
  const u = state.upgrades;
  return {
    o2Drain: Math.max(0.2, 1 - u.o2 * 0.18),
    warmthDrain: Math.max(0.25, 1 - u.thermal * 0.2),
    radiationDose: Math.max(0.15, 1 - u.shield * 0.22),
    speed: 1 + u.boots * 0.12,
    capacity: 120 + u.cargo * 40,
    solar: 1 + u.solar * 0.25,
  };
}

export function distanceToBase(state: SurfaceState): number {
  return Math.hypot(state.x, state.z);
}

export function atBase(state: SurfaceState): boolean {
  return distanceToBase(state) <= BASE_RADIUS;
}

export function hasModule(state: SurfaceState, kind: ModuleKind): boolean {
  return state.modules.some((m) => m.kind === kind);
}

export function inventoryTotal(state: SurfaceState): number {
  return RESOURCE_IDS.reduce((n, id) => n + (state.inventory[id] ?? 0), 0);
}

export function capacityLeft(state: SurfaceState): number {
  return Math.max(0, suitEffects(state).capacity - inventoryTotal(state));
}

export function nextUpgradeCost(state: SurfaceState, id: UpgradeId): Partial<Record<ResourceId, number>> | null {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return null;
  const level = state.upgrades[id] ?? 0;
  if (level >= def.maxLevel) return null;
  return def.cost(level);
}

export function canAfford(state: SurfaceState, cost: Partial<Record<ResourceId, number>>): boolean {
  return RESOURCE_IDS.every((id) => (state.inventory[id] ?? 0) >= (cost[id] ?? 0));
}

function pay(state: SurfaceState, cost: Partial<Record<ResourceId, number>>): Record<ResourceId, number> {
  const inventory = { ...state.inventory };
  for (const id of RESOURCE_IDS) inventory[id] = Math.max(0, inventory[id] - (cost[id] ?? 0));
  return inventory;
}

/* -------------------------------------------------------------- environment */

/** 0 at night, 1 at local noon. */
export function daylight(profile: SurfaceProfile, hours: number): number {
  const local = ((profile.startHour + hours) % 24 + 24) % 24;
  const s = Math.sin(((local - 6) / 12) * Math.PI);
  return clamp(s, 0, 1);
}

export function localHour(profile: SurfaceProfile, hours: number): number {
  return ((profile.startHour + hours) % 24 + 24) % 24;
}

export function surfaceTemp(profile: SurfaceProfile, hours: number): number {
  return profile.tempC + profile.swingC * (daylight(profile, hours) * 2 - 1);
}

/** Night on the surface, used by the sky/lighting and the HUD clock. */
export function isNight(profile: SurfaceProfile, hours: number): boolean {
  const h = localHour(profile, hours);
  return h < 6 || h >= 19;
}

/* ------------------------------------------------------------------ ticks */

export interface TickResult {
  state: SurfaceState;
  events: SurfaceEvent[];
}

function pushLog(state: SurfaceState, msg: string, kind: SurfaceLogEntry['kind']): SurfaceLogEntry[] {
  const entry: SurfaceLogEntry = { h: round1(state.hours), msg, kind };
  return [...state.log, entry].slice(-40);
}

export function tickSurface(state: SurfaceState, hours: number): TickResult {
  if (hours <= 0 || state.status !== 'active') return { state, events: [] };

  const profile = surfaceProfileFor(state.target);
  const e = suitEffects(state);
  const nearBase = atBase(state);
  const nearBaseRadius = nearBase;
  const events: SurfaceEvent[] = [];
  const sun = daylight(profile, state.hours + hours / 2);
  const temp = surfaceTemp(profile, state.hours + hours / 2);
  const nextWeather = pickWeather(profile, state.seed, state.hours + hours);
  const weatherChanged = nextWeather !== state.weather;
  const effect = WEATHER_EFFECTS[nextWeather];
  // Endless runs ramp the life-support cost every sol survived.
  const pressure = state.endless ? endlessPressure(state.hours) : 1;
  const drainMult = effect.drainMult * pressure;

  // Sol (24h) goal assignment: pick a new goal when the sol changes.
  const currentSol = Math.floor((state.hours + hours) / 24);
  const solChanged = currentSol !== state.lastSol && currentSol > 0;
  let currentSolGoal = state.currentSolGoal;
  let solGoalsCompleted = state.solGoalsCompleted;
  if (solChanged || !currentSolGoal) {
    currentSolGoal = pickSolGoal(state.seed, currentSol);
    if (!solGoalsCompleted.includes(currentSolGoal.id)) {
      solGoalsCompleted = [...solGoalsCompleted];
    }
  }

  const cold = clamp(-temp / 120, 0, 1.6);
  const heat = clamp((temp - 30) / 130, 0, 3.2);

  let o2 = state.o2;
  let water = state.water;
  let food = state.food;
  let warmth = state.warmth;
  let radiation = state.radiation;
  let integrity = state.integrity;
  let charge = state.charge;

  // Life support draw (modified by weather and endless pressure).
  o2 -= DRAIN.o2 * e.o2Drain * hours * drainMult;
  water -= DRAIN.water * hours * pressure;
  food -= DRAIN.food * hours * pressure;
  warmth -= (DRAIN.warmth + cold * 0.42 + heat * 0.5) * e.warmthDrain * hours * drainMult;
  charge -= DRAIN.charge * hours * drainMult;

  // Solar recharge (suit skin + array at base).
  const solarGain = 0.55 * sun * e.solar;
  charge += solarGain * hours;

  // Radiation dose: the planet sets the rate, the liner cuts it, weather amplifies it.
  radiation += (DRAIN.radiation + profile.radiation * 0.1) * e.radiationDose * hours * effect.radiationMult;

  // Base camp services only work inside BASE_RADIUS.
  if (nearBaseRadius) {
    if (hasModule(state, 'o2gen')) {
      o2 += 0.9 * hours;
    }
    if (hasModule(state, 'extractor')) {
      water += 0.7 * hours;
    }
    if (hasModule(state, 'greenhouse')) {
      food += 0.6 * hours;
    }
    if (hasModule(state, 'heater')) {
      warmth += 1.4 * hours;
    }
    if (hasModule(state, 'radshield')) {
      radiation -= 0.7 * hours;
    }
    if (hasModule(state, 'solar')) {
      charge += 1.2 * hours;
    }
  }

  // Renewable resource production: modules inside base generate resources over time.
  const inventory = { ...state.inventory };
  let capacityOverflow = false;
  for (const m of state.modules) {
    const def = MODULES.find((d) => d.id === m.kind);
    if (!def?.produces) continue;
    const produced = def.produces.amountPerHour * hours;
    const spaceLeft = suitEffects(state).capacity - inventoryTotal({ ...state, inventory });
    if (spaceLeft <= 0) {
      capacityOverflow = true;
      continue;
    }
    const amount = Math.min(produced, spaceLeft);
    inventory[def.produces.id] = (inventory[def.produces.id] ?? 0) + amount;
  }

  // Weather-specific damage: meteor showers damage suit integrity, solar flares
  // drain charge, acid rain damages suit and drains water.
  if (nextWeather === 'meteor_shower') {
    integrity -= 0.5 * hours;
    events.push({ msg: 'Meteor shower impacting — suit integrity at risk.', kind: 'warn' });
  }
  if (nextWeather === 'solar_flare') {
    charge -= 0.4 * hours;
    radiation += 0.3 * hours;
    events.push({ msg: 'Solar flare detected — radiation and battery drain elevated.', kind: 'warn' });
  }
  if (nextWeather === 'acid_rain') {
    integrity -= 0.3 * hours;
    water -= 0.3 * hours;
    events.push({ msg: 'Acid rain falling — suit integrity and water reserves dropping.', kind: 'warn' });
  }

  // Suit wear: slow baseline plus dose-driven damage.
  integrity -= (DRAIN.integrity + Math.max(0, radiation - 55) * 0.006) * hours;

  o2 = clamp(o2, 0, 100);
  water = clamp(water, 0, 100);
  food = clamp(food, 0, 100);
  warmth = clamp(warmth, 0, 100);
  radiation = clamp(radiation, 0, 100);
  integrity = clamp(integrity, 0, 100);
  charge = clamp(charge, 0, 100);

  const next: SurfaceState = {
    ...state,
    hours: state.hours + hours,
    weather: nextWeather,
    weatherHours: weatherChanged ? 0 : state.weatherHours + hours,
    o2,
    water,
    food,
    warmth,
    radiation,
    integrity,
    charge,
    inventory,
    currentSolGoal,
    solGoalsCompleted,
    lastSol: currentSol,
    scoutDroneTarget:
      state.scoutDroneTarget && state.hours + hours >= state.scoutDroneExpiresAt
        ? null
        : state.scoutDroneTarget,
  };

  if (state.scoutDroneTarget && next.scoutDroneTarget === null) {
    events.push({ msg: 'Scout drone telemetry expired — target marker lost.', kind: 'info' });
  }

  // Weather change announcement.
  if (weatherChanged) {
    const label =
      nextWeather === 'clear'
        ? 'Clear'
        : nextWeather === 'dust_storm'
          ? 'Dust storm'
          : nextWeather === 'radiation_spell'
            ? 'Radiation spell'
            : nextWeather === 'cold_snap'
              ? 'Cold snap'
              : nextWeather === 'heat_wave'
                ? 'Heat wave'
                : nextWeather === 'meteor_shower'
                  ? 'Meteor shower'
                  : nextWeather === 'solar_flare'
                    ? 'Solar flare'
                    : 'Acid rain';
    events.push({ msg: `Weather changed: ${label}.`, kind: 'warn' });
  }

  // Sol goal change announcement.
  if (solChanged && currentSolGoal) {
    const label = currentSolGoal.en;
    events.push({ msg: `New sol goal: ${label}.`, kind: 'info' });
  }

  // Endless mode: announce each pressure step so the ramp is legible.
  if (state.endless && solChanged) {
    const nextPressure = endlessPressure(state.hours + hours);
    if (nextPressure > pressure || pressure >= ENDLESS_MAX_PRESSURE) {
      events.push({
        msg: `Endless pressure ×${nextPressure.toFixed(2)} — life support costs climbing.`,
        kind: 'warn',
      });
    }
  }

  const crossed = (before: number, after: number, limit: number) => before > limit && after <= limit;
  if (crossed(state.o2, o2, 25)) {
    events.push({ msg: 'Oxygen at 25% — return to base or build an O₂ generator.', kind: 'warn' });
  }
  if (crossed(state.water, water, 20)) {
    events.push({ msg: 'Hydration low — drink from the extractor at base.', kind: 'warn' });
  }
  if (crossed(state.warmth, warmth, 20)) {
    events.push({ msg: 'Core temperature dropping — get to the thermal hut.', kind: 'warn' });
  }
  if (crossed(state.integrity, integrity, 30)) {
    events.push({ msg: 'Suit integrity below 30% — repair at base.', kind: 'bad' });
  }
  if (crossed(state.radiation, radiation, 70)) {
    events.push({ msg: 'Radiation dose high — shelter in the rad bay.', kind: 'bad' });
  }

  const failed =
    o2 <= 0 || warmth <= 0 || integrity <= 0 || radiation >= 100 || charge <= 0 && temp < -80;

  if (failed) {
    next.status = 'rescued';
    next.log = [
      ...pushLog(next, 'Emergency extraction: the surface team was recovered by the lander.', 'bad'),
    ];
    events.push({ msg: 'Emergency extraction — the expedition is over.', kind: 'bad' });
  } else if (events.length) {
    next.log = events.reduce((log, ev) => [...log, { h: round1(next.hours), msg: ev.msg, kind: ev.kind }], next.log);
  }

  return { state: next, events };
}

/* ------------------------------------------------------------------ actions */

export interface ActionResult {
  ok: boolean;
  state: SurfaceState;
  message: string;
  events?: SurfaceEvent[];
}

export function collectNode(state: SurfaceState, node: SurfaceNode): ActionResult {
  if (state.status !== 'active') {
    return { ok: false, state, message: 'The expedition is over.' };
  }
  if (state.taken.includes(node.id)) {
    return { ok: false, state, message: 'That deposit is already spent.' };
  }
  const e = suitEffects(state);
  const room = capacityLeft(state);
  if (room <= 0) {
    return { ok: false, state, message: 'Cargo rig full — return to base and build storage.' };
  }
  const amount = Math.min(NODE_YIELD[node.kind], room);
  const inventory = { ...state.inventory, [node.kind]: (state.inventory[node.kind] ?? 0) + amount };
  const next: SurfaceState = {
    ...state,
    inventory,
    taken: [...state.taken, node.id],
    gathered: state.gathered + 1,
    xp: state.xp + XP.gather,
    log: pushLog(state, `Collected ${amount} × ${node.kind}.`, 'good'),
  };
  return {
    ok: true,
    state: next,
    message: `+${amount} ${node.kind}`,
    events: [{ msg: `Collected ${amount} × ${node.kind}.`, kind: 'good' }],
  };
}

export function buildModule(state: SurfaceState, kind: ModuleKind): ActionResult {
  const def = MODULES.find((m) => m.id === kind);
  if (!def) return { ok: false, state, message: 'Unknown module.' };
  if (hasModule(state, kind)) {
    return { ok: false, state, message: 'That module is already built.' };
  }
  if (!canAfford(state, def.cost)) {
    return { ok: false, state, message: 'Not enough materials — gather more first.' };
  }
  const slot = state.modules.length % 6;
  const next: SurfaceState = {
    ...state,
    inventory: pay(state, def.cost),
    modules: [...state.modules, { kind, slot }],
    xp: state.xp + XP.build,
    log: pushLog(state, `Built ${def.en}.`, 'good'),
  };
  return {
    ok: true,
    state: next,
    message: `${def.en} online`,
    events: [{ msg: `${def.en} is online at base.`, kind: 'good' }],
  };
}

export function upgradeSuit(state: SurfaceState, id: UpgradeId): ActionResult {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return { ok: false, state, message: 'Unknown upgrade.' };
  const level = state.upgrades[id] ?? 0;
  if (level >= def.maxLevel) return { ok: false, state, message: 'Already at maximum level.' };
  const cost = def.cost(level);
  if (!canAfford(state, cost)) return { ok: false, state, message: 'Not enough materials for this upgrade.' };
  const next: SurfaceState = {
    ...state,
    inventory: pay(state, cost),
    upgrades: { ...state.upgrades, [id]: level + 1 },
    xp: state.xp + XP.upgrade,
    log: pushLog(state, `${def.en} upgraded to Mk ${level + 1}.`, 'good'),
  };
  return {
    ok: true,
    state: next,
    message: `${def.en} Mk ${level + 1}`,
    events: [{ msg: `${def.en} upgraded to Mk ${level + 1}.`, kind: 'good' }],
  };
}

export function repairSuit(state: SurfaceState): ActionResult {
  const cost: Partial<Record<ResourceId, number>> = { ore: 2, regolith: 2 };
  if (state.integrity >= 99.5) return { ok: false, state, message: 'Suit integrity is already full.' };
  if (!canAfford(state, cost)) return { ok: false, state, message: 'Repair needs 2 ore + 2 regolith.' };
  const next: SurfaceState = {
    ...state,
    inventory: pay(state, cost),
    integrity: clamp(state.integrity + 28, 0, 100),
    log: pushLog(state, 'Suit patched at base.', 'good'),
  };
  return { ok: true, state: next, message: 'Suit repaired +28%', events: [{ msg: 'Suit repaired.', kind: 'good' }] };
}

/** Restore a deep-frozen suit reserve at base (costs ice + charge). */
export function resupply(state: SurfaceState): ActionResult {
  if (!atBase(state)) return { ok: false, state, message: 'Return to the lander to resupply.' };
  const cost: Partial<Record<ResourceId, number>> = { ice: 3 };
  if (!canAfford(state, cost)) return { ok: false, state, message: 'Resupply needs 3 ice (melt it at the extractor).' };
  if (state.charge < 10) return { ok: false, state, message: 'Battery too low to run the resupply loop.' };
  const next: SurfaceState = {
    ...state,
    inventory: pay(state, cost),
    o2: 100,
    water: 100,
    food: Math.min(100, state.food + 25),
    charge: clamp(state.charge - 10, 0, 100),
    log: pushLog(state, 'Resupplied from the lander stores.', 'good'),
  };
  return { ok: true, state: next, message: 'Resupplied: O₂ + water full', events: [{ msg: 'Resupply complete.', kind: 'good' }] };
}

export function scoutDrone(state: SurfaceState): ActionResult {
  if (!atBase(state)) {
    return { ok: false, state, message: 'Return to the lander to launch the scout drone.' };
  }
  if (!canAfford(state, SCOUT_DRONE_COST)) {
    return { ok: false, state, message: 'Not enough materials to launch the scout drone.' };
  }
  const nodes = surfaceNodes(state.seed, state.target).filter((n) => !state.taken.includes(n.id));
  if (nodes.length === 0) {
    return { ok: false, state, message: 'No free deposits detected on this world.' };
  }
  const nearest = nodes.reduce((best, n) => {
    const d = Math.hypot(n.x - state.x, n.z - state.z);
    const bd = Math.hypot(best.x - state.x, best.z - state.z);
    return d < bd ? n : best;
  });
  const next: SurfaceState = {
    ...state,
    inventory: pay(state, SCOUT_DRONE_COST),
    scoutDroneTarget: nearest,
    scoutDroneExpiresAt: state.hours + SCOUT_DRONE_DURATION_HOURS,
    xp: state.xp + XP.scan,
    log: pushLog(state, `Scout drone launched: nearest ${nearest.kind} deposit marked.`, 'good'),
  };
  return {
    ok: true,
    state: next,
    message: 'Scout drone launched — nearest deposit marked.',
    events: [{ msg: `Scout drone: ${nearest.kind} deposit marked at ${Math.hypot(nearest.x - state.x, nearest.z - state.z).toFixed(0)} m.`, kind: 'good' }],
  };
}

export function moveSurvivor(state: SurfaceState, x: number, z: number): SurfaceState {
  const dist = Math.hypot(x, z);
  const scale = dist > 90 ? 90 / dist : 1;
  const nx = x * scale;
  const nz = z * scale;
  const walked = state.walked + Math.hypot(nx - state.x, nz - state.z);
  return { ...state, x: nx, z: nz, walked };
}

export function renameSurvivor(state: SurfaceState, callsign: string): SurfaceState {
  const clean = callsign.trim().slice(0, 14).toUpperCase();
  return { ...state, callsign: clean || state.callsign };
}

/** Toggle the endless survival pressure. Allowed while the expedition is active. */
export function setEndless(state: SurfaceState, on: boolean): ActionResult {
  if (state.status !== 'active') {
    return { ok: false, state, message: 'The expedition is already over.' };
  }
  if (state.endless === on) {
    return { ok: false, state, message: on ? 'Endless survival is already on.' : 'Endless survival is already off.' };
  }
  const next: SurfaceState = {
    ...state,
    endless: on,
    log: pushLog(
      state,
      on ? 'Endless survival enabled — life support pressure will rise each sol.' : 'Endless survival disabled — life support pressure reset.',
      on ? 'warn' : 'good',
    ),
  };
  return {
    ok: true,
    state: next,
    message: on ? 'Endless survival — pressure rises each sol.' : 'Endless survival off.',
    events: [
      {
        msg: on ? 'Endless survival enabled.' : 'Endless survival disabled.',
        kind: on ? 'warn' : 'good',
      },
    ],
  };
}

export function levelOf(state: SurfaceState): number {
  return levelForXp(state.xp);
}

/** Days survived, used by the debrief and the HUD sol counter. */
export function solOf(state: SurfaceState): number {
  return Math.floor(state.hours / 24) + 1;
}

export function unlockRover(state: SurfaceState): ActionResult {  if (state.roverUnlocked) {
    return { ok: false, state, message: 'Rover already unlocked.' };
  }
  if (!canAfford(state, ROVER_COST)) {
    return { ok: false, state, message: 'Not enough materials to unlock the rover.' };
  }
  const next: SurfaceState = {
    ...state,
    inventory: pay(state, ROVER_COST),
    roverUnlocked: true,
    xp: state.xp + XP.upgrade,
    log: pushLog(state, 'Surface rover unlocked.', 'good'),
  };
  return {
    ok: true,
    state: next,
    message: 'Surface rover unlocked',
    events: [{ msg: 'Rover ready for exploration.', kind: 'good' }],
  };
}

export function checkSolGoal(state: SurfaceState): { completed: boolean; goal: SolGoal | null } {
  const goal = state.currentSolGoal;
  if (!goal) return { completed: false, goal: null };
  if (state.solGoalsCompleted.includes(goal.id)) return { completed: true, goal };

  if (goal.resource) {
    const have = state.inventory[goal.resource] ?? 0;
    return { completed: have >= goal.target, goal };
  }
  if (goal.module) {
    return { completed: hasModule(state, goal.module), goal };
  }
  return { completed: false, goal };
}

export function completeSolGoal(state: SurfaceState): ActionResult {
  const goal = state.currentSolGoal;
  if (!goal) {
    return { ok: false, state, message: 'No active sol goal.' };
  }
  if (state.solGoalsCompleted.includes(goal.id)) {
    return { ok: false, state, message: 'Sol goal already completed.' };
  }
  const next: SurfaceState = {
    ...state,
    solGoalsCompleted: [...state.solGoalsCompleted, goal.id],
    xp: state.xp + goal.xp,
    currentSolGoal: null,
    log: pushLog(state, `Sol goal complete: ${goal.en}. (+${goal.xp} XP)`, 'good'),
  };
  return {
    ok: true,
    state: next,
    message: `Sol goal complete: ${goal.en}`,
    events: [{ msg: `Sol goal complete: ${goal.en}. (+${goal.xp} XP)`, kind: 'good' }],
  };
}

export function moduleSlotPosition(slot: number): { x: number; z: number } {
  const angle = (slot / 6) * Math.PI * 2 + Math.PI / 6;
  return { x: Math.cos(angle) * 7, z: Math.sin(angle) * 7 };
}

/** Freshly-generate the fixed ring of base slots (kept for save sanitisation). */
export function isValidModuleKind(v: unknown): v is ModuleKind {
  return typeof v === 'string' && (MODULE_IDS as string[]).includes(v);
}
