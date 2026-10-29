/**
 * save.ts — versioned, defensive save/restore for ORBITAL.
 *
 * The store owns the live game state; this module owns the *shape* of what is
 * persisted and every rule for reading it back. Keeping it free of React and of
 * localStorage makes it unit-testable and lets the store stay a thin adapter.
 *
 * Schema
 *   v1 (legacy, still readable): { settings, progress, difficulty }
 *   v2 (current):                { version: 2, savedAt, settings, progress,
 *                                  difficulty, run }
 *
 * `run` is the in-flight flight plan: design + builder placement + the selected
 * mission and, once launched, the live simulation snapshot. Without it a page
 * reload during operations silently threw the whole mission away.
 *
 * Everything read from disk is treated as hostile: unknown component ids,
 * out-of-range numbers, impossible screens and malformed simulations are dropped
 * rather than trusted, so a stale or hand-edited save can never crash the game.
 */
import type {
  BuilderState,
  LaunchState,
  MissionProgress,
  MissionSettings,
  ScreenId,
} from './store';
import { STARTING_NODE, TECH_NODES } from './tech';
import type { SurfaceState, BuiltModule } from './surface/engine';
import {
  MODULES,
  RESOURCE_IDS,
  SURFACE_PROFILES,
  UPGRADES,
  type ModuleKind,
  type ResourceId,
  type UpgradeId,
  type WeatherId,
} from './surface/model';
import {
  COMPONENTS,
  MISSIONS,
  LAUNCHERS,
  type ComponentCategory,
  type DifficultyId,
  type PlacedPart,
  type SimState,
  type SpacecraftDesign,
} from '@engine';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'ma_save_v2';
export const LEGACY_SAVE_KEY = 'ma_save_v1';
export const BACKUP_KEY = 'ma_save_v2_backup';
export const CORRUPT_KEY = 'ma_save_v2_corrupt';

/** Screens whose in-flight state is worth resuming after a reload. */
export const RESUMABLE_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'missionSelect',
  'builder',
  'launcher',
  'orbit',
  'simulation',
  'surface',
]);

const ALL_SCREENS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'home',
  'hangar',
  'missionSelect',
  'builder',
  'launcher',
  'orbit',
  'simulation',
  'results',
  'techTree',
  'styleGuide',
  'playground',
  'descent',
  'surface',
]);

export const CATEGORY_LIST: ComponentCategory[] = [  'bus',
  'power',
  'propulsion',
  'comms',
  'payload',
  'thermal',
];

const DIFFICULTIES: DifficultyId[] = ['tutorial', 'normal', 'engineer', 'director'];

/** Newest allowed event-log rows kept in a save; older ones are dropped. */
const MAX_PERSISTED_LOG = 300;

export const DEFAULT_KEYBINDINGS: Record<string, string> = {
  FIRE: 'Space',
  SCAN: 'KeyS',
  NAV: 'KeyN',
  COM: 'KeyC',
  SHLD: 'KeyH',
  WARP: 'KeyW',
  CONFIRM: 'Enter',
  BACK: 'Backspace',
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  ROTATE_CW: 'KeyE',
  ROTATE_CCW: 'KeyQ',
  PLACE: 'Enter',
  REMOVE: 'Backspace',
  NEXT_SLOT: 'Tab',
  ANALYSE: 'KeyA',
  PAUSE: 'Escape',
};

export const DEFAULT_SETTINGS: MissionSettings = {
  lang: 'en',
  sound: true,
  volume: 0.6,
  effectsVolume: 0.85,
  ambienceVolume: 0.65,
  quality: 'high',
  reducedMotion: false,
  learnMode: true,
  teacherMode: false,
  keybindings: { ...DEFAULT_KEYBINDINGS },
};

export const DEFAULT_PROGRESS: MissionProgress = {
  credits: 3_000_000,
  xp: 0,
  unlockedTech: [STARTING_NODE],
  completed: {},
  badges: [],
};

export const EMPTY_DESIGN: SpacecraftDesign = {
  missionId: '',
  launcherId: '',
  components: { bus: null, power: null, propulsion: null, comms: null, payload: null, thermal: null },
  redundancy: { bus: false, power: false, propulsion: false, comms: false, payload: false, thermal: false },
  propellantMassKg: 0,
};

export interface RunSnapshot {
  screen: ScreenId;
  missionId: string;
  launcherId: string;
  design: SpacecraftDesign;
  builder: BuilderState;
  altitudeOffsetKm: number;
  inclinationDeg: number;
  /** Live operations snapshot; null before launch. */
  sim: SimState | null;
  launch: LaunchState | null;
}

export interface PersistedGame {
  version: number;
  savedAt: string;
  settings: MissionSettings;
  progress: MissionProgress;
  difficulty: DifficultyId;
  run: RunSnapshot | null;
  /** Planetary expedition; independent of the finished mission run. */
  surface: SurfaceState | null;
  /** Last screen, so a surface save can resume on the surface. */
  screen: ScreenId;
}

export interface SaveInput {
  screen: ScreenId;
  missionId: string | null;
  launcherId: string | null;
  design: SpacecraftDesign;
  builder: BuilderState;
  altitudeOffsetKm: number;
  inclinationDeg: number;
  sim: SimState | null;
  launch: LaunchState | null;
  settings: MissionSettings;
  progress: MissionProgress;
  difficulty: DifficultyId;
  surface?: SurfaceState | null;
}

export type ParseSource = 'v2' | 'v1' | 'none';

export interface ParseResult {
  game: PersistedGame | null;
  source: ParseSource;
  warning: string | null;
}

export class SaveImportError extends Error {}

/* ------------------------------------------------------------------ helpers */

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

const COMPONENT_IDS = new Set(COMPONENTS.map((c) => c.id));
const LAUNCHER_IDS = new Set(LAUNCHERS.map((l) => l.id));
const MISSION_IDS = new Set(MISSIONS.map((m) => m.id));
const TECH_IDS = new Set(TECH_NODES.map((n) => n.id));

const PLACED_PART = (v: unknown): PlacedPart | null => {
  if (!isObject(v)) return null;
  const componentId = str(v.componentId);
  if (!componentId) return null;
  return {
    componentId,
    x: Math.round(num(v.x, 0, 0, 7)),
    y: Math.round(num(v.y, 0, 0, 5)),
    w: Math.round(num(v.w, 2, 1, 7)),
    h: Math.round(num(v.h, 2, 1, 5)),
    rotated: bool(v.rotated, false),
  };
};

/* --------------------------------------------------------------- sanitation */

function sanitizeSettings(raw: unknown): MissionSettings {
  const r = isObject(raw) ? raw : {};
  const quality = r.quality;
  const keybindings: Record<string, string> = { ...DEFAULT_KEYBINDINGS };
  if (isObject(r.keybindings)) {
    for (const key of Object.keys(DEFAULT_KEYBINDINGS)) {
      const value = r.keybindings[key];
      if (typeof value === 'string' && value.length > 0) keybindings[key] = value;
    }
  }
  return {
    lang: r.lang === 'ar' ? 'ar' : 'en',
    sound: bool(r.sound, DEFAULT_SETTINGS.sound),
    volume: num(r.volume, DEFAULT_SETTINGS.volume, 0, 1),
    effectsVolume: num(r.effectsVolume, DEFAULT_SETTINGS.effectsVolume, 0, 1),
    ambienceVolume: num(r.ambienceVolume, DEFAULT_SETTINGS.ambienceVolume, 0, 1),
    quality: quality === 'low' || quality === 'medium' || quality === 'high' ? quality : 'high',
    reducedMotion: bool(r.reducedMotion, DEFAULT_SETTINGS.reducedMotion),
    learnMode: bool(r.learnMode, DEFAULT_SETTINGS.learnMode),
    teacherMode: bool(r.teacherMode, DEFAULT_SETTINGS.teacherMode),
    keybindings,
  };
}

function sanitizeProgress(raw: unknown): MissionProgress {
  const r = isObject(raw) ? raw : {};
  const unlocked = Array.isArray(r.unlockedTech)
    ? [...new Set(r.unlockedTech.filter((id): id is string => typeof id === 'string' && TECH_IDS.has(id)))]
    : [];
  if (!unlocked.includes(STARTING_NODE)) unlocked.unshift(STARTING_NODE);

  const completed: MissionProgress['completed'] = {};
  if (isObject(r.completed)) {
    for (const [id, value] of Object.entries(r.completed)) {
      if (!MISSION_IDS.has(id) || !isObject(value)) continue;
      completed[id] = {
        score: Math.round(num(value.score, 0, 0, 1000)),
        grade: str(value.grade, 'D').slice(0, 2),
      };
    }
  }

  const badges = Array.isArray(r.badges)
    ? [...new Set(r.badges.filter((b): b is string => typeof b === 'string'))].slice(0, 200)
    : [];

  return {
    credits: Math.round(num(r.credits, DEFAULT_PROGRESS.credits, 0, 1e12)),
    xp: Math.round(num(r.xp, DEFAULT_PROGRESS.xp, 0, 1e9)),
    unlockedTech: unlocked,
    completed,
    badges,
  };
}

function sanitizeDesign(raw: unknown): SpacecraftDesign {
  const r = isObject(raw) ? raw : {};
  const components = { ...EMPTY_DESIGN.components };
  const redundancy = { ...EMPTY_DESIGN.redundancy };
  if (isObject(r.components)) {
    for (const cat of CATEGORY_LIST) {
      const id = r.components[cat];
      components[cat] = typeof id === 'string' && COMPONENT_IDS.has(id) ? id : null;
    }
  }
  if (isObject(r.redundancy)) {
    for (const cat of CATEGORY_LIST) redundancy[cat] = bool(r.redundancy[cat], false);
  }
  const design: SpacecraftDesign = {
    missionId: typeof r.missionId === 'string' && MISSION_IDS.has(r.missionId) ? r.missionId : '',
    launcherId: typeof r.launcherId === 'string' && LAUNCHER_IDS.has(r.launcherId) ? r.launcherId : '',
    components,
    redundancy,
    propellantMassKg: Math.round(num(r.propellantMassKg, 0, 0, 1e6)),
  };
  if (Number.isFinite(Number(r.extraSolarAreaM2))) {
    design.extraSolarAreaM2 = num(r.extraSolarAreaM2, 0, 0, 1e4);
  }
  if (Number.isFinite(Number(r.extraBatteryWh))) {
    design.extraBatteryWh = num(r.extraBatteryWh, 0, 0, 1e6);
  }
  return design;
}

function sanitizeBuilder(raw: unknown, design: SpacecraftDesign): BuilderState {
  const r = isObject(raw) ? raw : {};
  const placed = { ...EMPTY_DESIGN.components } as BuilderState['placed'];
  for (const cat of CATEGORY_LIST) placed[cat] = null;
  if (isObject(r.placed)) {
    for (const cat of CATEGORY_LIST) {
      const part = PLACED_PART(r.placed[cat]);
      // A placement is only meaningful if it matches the equipped component.
      if (part && part.componentId === design.components[cat]) placed[cat] = part;
    }
  }
  const cursor = isObject(r.cursor) ? r.cursor : {};
  return {
    cursor: {
      x: Math.round(num(cursor.x, 0, 0, 6)),
      y: Math.round(num(cursor.y, 0, 0, 4)),
    },
    selectedCategory: CATEGORY_LIST.includes(r.selectedCategory as ComponentCategory)
      ? (r.selectedCategory as ComponentCategory)
      : 'bus',
    rotation: bool(r.rotation, false),
    placed,
  };
}

function sanitizeLaunch(raw: unknown): LaunchState | null {
  if (!isObject(raw)) return null;
  const phase = raw.phase;
  if (phase !== 'launch' && phase !== 'ops' && phase !== 'ended') return null;
  const goNoGo = Array.isArray(raw.goNoGo)
    ? raw.goNoGo
        .filter(isObject)
        .map((x) => ({ name: str(x.name), go: bool(x.go, true) }))
        .slice(0, 32)
    : [];
  return {
    phase,
    progress: num(raw.progress, 0, 0, 1),
    countdown: num(raw.countdown, 0, 0, 10),
    goNoGo,
    callout: str(raw.callout),
    launchFailed: bool(raw.launchFailed, false),
  };
}

function sanitizeSim(raw: unknown): SimState | null {
  if (!isObject(raw)) return null;
  const required = [
    'elapsedDays',
    'durationDays',
    'propRemainingKg',
    'batteryChargeWh',
    'batteryCapacityWh',
    'dataStoredGb',
    'dataReturnedGb',
    'scienceGoalGb',
    'dvRemainingMps',
  ] as const;
  for (const key of required) {
    if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key] as number)) return null;
  }
  const scale = raw.timeScale === 10 || raw.timeScale === 100 ? raw.timeScale : 1;
  const eventLog = Array.isArray(raw.eventLog)
    ? raw.eventLog
        .filter(isObject)
        .map((e) => ({
          day: num(e.day, 0, 0, 1e6),
          kind: str(e.kind, 'info'),
          message: str(e.message),
          severity: (e.severity === 'critical' || e.severity === 'warn' ? e.severity : 'info') as
            | 'info'
            | 'warn'
            | 'critical',
        }))
        .slice(-MAX_PERSISTED_LOG * 2)
    : [];

  return {
    missionId: str(raw.missionId),
    difficulty: DIFFICULTIES.includes(raw.difficulty as DifficultyId)
      ? (raw.difficulty as DifficultyId)
      : 'normal',
    elapsedDays: num(raw.elapsedDays, 0, 0, 1e6),
    durationDays: num(raw.durationDays, 1, 0.0001, 1e6),
    propRemainingKg: num(raw.propRemainingKg, 0, 0, 1e7),
    batteryChargeWh: num(raw.batteryChargeWh, 0, 0, 1e8),
    batteryCapacityWh: num(raw.batteryCapacityWh, 0, 0, 1e8),
    dataStoredGb: num(raw.dataStoredGb, 0, 0, 1e9),
    dataReturnedGb: num(raw.dataReturnedGb, 0, 0, 1e9),
    scienceGoalGb: num(raw.scienceGoalGb, 0, 0, 1e9),
    dvRemainingMps: num(raw.dvRemainingMps, 0, 0, 1e6),
    safeMode: bool(raw.safeMode, false),
    failed: bool(raw.failed, false),
    complete: bool(raw.complete, false),
    failureReason: typeof raw.failureReason === 'string' ? raw.failureReason : null,
    failureDay: typeof raw.failureDay === 'number' && Number.isFinite(raw.failureDay) ? raw.failureDay : null,
    eventLog,
    timeScale: scale,
  };
}

function sanitizeSurface(raw: unknown): SurfaceState | null {
  if (!isObject(raw)) return null;
  const target = str(raw.target);
  if (!SURFACE_PROFILES[target]) return null;

  const clamp01to100 = (v: unknown, fallback: number) => num(v, fallback, 0, 100);
  const upgrades = { o2: 0, thermal: 0, shield: 0, boots: 0, cargo: 0, solar: 0 } as Record<UpgradeId, number>;
  if (isObject(raw.upgrades)) {
    for (const def of UPGRADES) {
      upgrades[def.id] = Math.round(num((raw.upgrades as Record<string, unknown>)[def.id], 0, 0, def.maxLevel));
    }
  }

  const inventory = { ice: 0, regolith: 0, ore: 0, crystal: 0, biomass: 0 } as Record<ResourceId, number>;
  if (isObject(raw.inventory)) {
    for (const id of RESOURCE_IDS) {
      inventory[id] = Math.round(num((raw.inventory as Record<string, unknown>)[id], 0, 0, 1e6));
    }
  }

  const modules: BuiltModule[] = [];
  if (Array.isArray(raw.modules)) {
    const seen = new Set<ModuleKind>();
    for (const m of raw.modules) {
      if (!isObject(m)) continue;
      const kind = m.kind;
      if (typeof kind !== 'string' || !MODULES.some((d) => d.id === kind)) continue;
      if (seen.has(kind as ModuleKind)) continue;
      seen.add(kind as ModuleKind);
      modules.push({ kind: kind as ModuleKind, slot: Math.round(num(m.slot, modules.length, 0, 5)) });
      if (modules.length >= 6) break;
    }
  }

  const taken = Array.isArray(raw.taken)
    ? [...new Set(raw.taken.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id >= 0 && id < 500))].slice(0, 500)
    : [];

  const log = Array.isArray(raw.log)
    ? raw.log
        .filter(isObject)
        .map((e) => ({
          h: num(e.h, 0, 0, 1e6),
          msg: str(e.msg).slice(0, 200),
          kind: (e.kind === 'good' || e.kind === 'warn' || e.kind === 'bad' ? e.kind : 'info') as
            | 'info'
            | 'good'
            | 'warn'
            | 'bad',
        }))
        .filter((e) => e.msg.length > 0)
        .slice(-30)
    : [];

  const rawColor = str(raw.suitColor, '#e9c37c');
  const suitColor = /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor : '#e9c37c';
  const callsign = str(raw.callsign, 'NOVA').trim().toUpperCase().slice(0, 14) || 'NOVA';

  return {
    target,
    callsign,
    suitColor,
    seed: Math.round(num(raw.seed, 1, 0, 0xffffffff)),
    x: num(raw.x, 0, -90, 90),
    z: num(raw.z, 0, -90, 90),
    hours: num(raw.hours, 0, 0, 1e6),
    o2: clamp01to100(raw.o2, 100),
    water: clamp01to100(raw.water, 100),
    food: clamp01to100(raw.food, 100),
    warmth: clamp01to100(raw.warmth, 100),
    radiation: clamp01to100(raw.radiation, 0),
    integrity: clamp01to100(raw.integrity, 100),
    charge: clamp01to100(raw.charge, 100),
    xp: Math.round(num(raw.xp, 0, 0, 1e6)),
    upgrades,
    modules,
    inventory,
    taken,
    gathered: Math.round(num(raw.gathered, 0, 0, 1e6)),
    walked: num(raw.walked, 0, 0, 1e9),
    roverUnlocked: bool(raw.roverUnlocked, false),
    currentSolGoal: null,
    solGoalsCompleted: [],
    lastSol: 0,
    weather: (typeof raw.weather === 'string' && ['clear', 'dust_storm', 'radiation_spell', 'cold_snap', 'heat_wave', 'meteor_shower', 'solar_flare', 'acid_rain'].includes(raw.weather)) ? (raw.weather as WeatherId) : 'clear',
    weatherHours: num(raw.weatherHours, 0, 0, 1e6),
    status: raw.status === 'rescued' ? 'rescued' : 'active',
    log,
  };
}

function sanitizeRun(raw: unknown): RunSnapshot | null {
  if (!isObject(raw)) return null;
  const missionId = str(raw.missionId);
  if (!MISSION_IDS.has(missionId)) return null;

  const rawDesign = isObject(raw.design) ? raw.design : {};
  const design = sanitizeDesign({ ...rawDesign, missionId });
  const sim = sanitizeSim(raw.sim);
  const rawLaunch = isObject(raw.launch) ? raw.launch : null;

  // An ended run belongs to the results screen, which is not resumable: keep the
  // campaign, drop the run.
  if (rawLaunch?.phase === 'ended') return null;

  // A run interrupted mid-cinematic resumes straight into operations; replaying
  // the launch would duplicate it and could re-roll the launch failure.
  const launch = sanitizeLaunch(
    rawLaunch?.phase === 'launch'
      ? { ...rawLaunch, phase: 'ops', progress: 1, countdown: 0, callout: 'ORBIT INSERTION' }
      : raw.launch,
  );

  // A simulation without a launch phase (or a launch with no sim) cannot advance.
  if (sim && !launch) return null;
  if (launch && !sim) return null;

  let screen = RESUMABLE_SCREENS.has(raw.screen as ScreenId) ? (raw.screen as ScreenId) : 'builder';
  if (screen === 'simulation' && (!sim || launch?.phase !== 'ops')) screen = 'builder';
  // The surface screen only makes sense with a persisted expedition.
  if (screen === 'surface') screen = 'missionSelect';

  const rawLauncher = str(raw.launcherId);

  return {
    screen,
    missionId,
    launcherId: design.launcherId || (LAUNCHER_IDS.has(rawLauncher) ? rawLauncher : ''),
    design,
    builder: sanitizeBuilder(raw.builder, design),
    altitudeOffsetKm: num(raw.altitudeOffsetKm, 0, -200, 400),
    inclinationDeg: num(raw.inclinationDeg, 0, 0, 180),
    sim,
    launch,
  };
}

/* -------------------------------------------------------------- public API */

/** Build the object that gets written to storage (or exported to a file). */
export function createSave(input: SaveInput): PersistedGame {
  // An ended run is owned by the results screen: the campaign is saved, the
  // finished flight is not (matching the parser, which drops ended runs).
  const resumable =
    RESUMABLE_SCREENS.has(input.screen) &&
    !!input.missionId &&
    input.launch?.phase !== 'ended';
  const sim = input.sim ? trimSim(input.sim) : null;

  const run: RunSnapshot | null = resumable
    ? {
        screen: input.screen,
        missionId: input.missionId as string,
        launcherId: input.launcherId ?? '',
        design: input.design,
        builder: input.builder,
        altitudeOffsetKm: input.altitudeOffsetKm,
        inclinationDeg: input.inclinationDeg,
        sim,
        launch: input.launch,
      }
    : null;

  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    settings: input.settings,
    progress: input.progress,
    difficulty: input.difficulty,
    run,
    surface: input.surface ? { ...input.surface, log: input.surface.log.slice(-30) } : null,
    screen: input.surface && input.screen === 'descent' ? 'surface' : input.screen,
  };
}

/** Keep saves small: the log is telemetry, not a transcript. */
export function trimSim(sim: SimState): SimState {
  if (sim.eventLog.length <= MAX_PERSISTED_LOG) return sim;
  return { ...sim, eventLog: sim.eventLog.slice(-MAX_PERSISTED_LOG) };
}

/**
 * Parse a persisted game. Accepts v2 and the legacy v1 shape. Never throws:
 * an unreadable payload returns `game: null` with a human-readable warning.
 */
export function parseSave(raw: string | null | undefined): ParseResult {
  if (!raw) return { game: null, source: 'none', warning: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { game: null, source: 'none', warning: 'The save file is not valid JSON.' };
  }

  if (!isObject(parsed)) {
    return { game: null, source: 'none', warning: 'The save file has an unexpected shape.' };
  }

  const version = typeof parsed.version === 'number' ? parsed.version : 1;
  if (version > SAVE_VERSION) {
    return {
      game: null,
      source: 'none',
      warning: `This save was written by a newer version (v${version}) and cannot be loaded.`,
    };
  }

  const game: PersistedGame = {
    version: SAVE_VERSION,
    savedAt: str(parsed.savedAt, new Date().toISOString()),
    settings: sanitizeSettings(parsed.settings),
    progress: sanitizeProgress(parsed.progress),
    difficulty: DIFFICULTIES.includes(parsed.difficulty as DifficultyId)
      ? (parsed.difficulty as DifficultyId)
      : 'tutorial',
    run: version >= 2 ? sanitizeRun(parsed.run) : null,
    surface: version >= 2 ? sanitizeSurface(parsed.surface) : null,
    screen: version >= 2 && ALL_SCREENS.has(parsed.screen as ScreenId)
      ? (parsed.screen as ScreenId)
      : 'home',
  };

  return {
    game,
    source: version >= 2 ? 'v2' : 'v1',
    warning: null,
  };
}

/** Hard ceiling for an imported file: a real save is a few KB. */
export const MAX_IMPORT_CHARS = 2_000_000;

/** Pretty JSON for the “export progress” download. */
export function exportSave(game: PersistedGame): string {
  return JSON.stringify(game, null, 2);
}

/** Parse an imported file; throws SaveImportError with a readable reason. */
export function importSave(text: string): PersistedGame {
  if (!text || !text.trim()) throw new SaveImportError('The selected file is empty.');
  if (text.length > MAX_IMPORT_CHARS) {
    throw new SaveImportError('That file is too large to be an ORBITAL save (limit 2 MB).');
  }
  const result = parseSave(text);
  if (!result.game) throw new SaveImportError(result.warning ?? 'The selected file is not a valid save.');
  return result.game;
}

/** Approximate byte size of a save, used by tests to catch unbounded growth. */
export function saveSize(game: PersistedGame): number {
  return JSON.stringify(game).length;
}
