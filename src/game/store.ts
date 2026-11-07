/**
 * Mission Architect — game store (Zustand).
 * UI dispatches named commands; resources only change through the engine.
 */
import { create } from 'zustand';
import {
  createSim, dispatchCommand as engineDispatch, tickMission, resolveDesign, canPlace,
  lookupTables, budgetCapFor, DIFFICULTIES, MISSIONS, COMPONENTS, LAUNCHERS,
  computeScore, gradeForScore, dataRateMbps, missionDistanceKm, lightDelayS,
  type SimState, type SimEventEntry, type SpacecraftDesign, type ComponentCategory,
  type DifficultyId, type CommandName, type ValidationResult, type ScoreBreakdown, type PlacedPart,
} from '@engine';
import { sound } from './audio';
import type { Lang } from './i18n';
import { TECH_NODES, STARTING_NODE, unlockedIdsFor, canUnlock, levelForXp } from './tech';
import {
  BACKUP_KEY,
  CORRUPT_KEY,
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  EMPTY_DESIGN,
  LEGACY_SAVE_KEY,
  SAVE_KEY,
  createSave,
  exportSave as serializeSave,
  importSave as parseImportedSave,
  parseSave,
  type PersistedGame,
} from './save';
import {
  buildModule as engineBuildModule,
  collectNode as engineCollectNode,
  createSurface,
  moveSurvivor,
  renameSurvivor,
  repairSuit as engineRepairSuit,
  resupply as engineResupply,
  tickSurface,
  unlockRover,
  checkSolGoal,
  completeSolGoal,
  scoutDrone,
  setEndless,
  levelOf,
  solOf,
  upgradeSuit as engineUpgradeSuit,
  type SurfaceNode,
  type SurfaceState,
} from './surface/engine';
import type { ModuleKind, UpgradeId, SolGoal } from './surface/model';

export type ScreenId =
  | 'home' | 'hangar' | 'missionSelect' | 'builder' | 'launcher'
  | 'orbit' | 'simulation' | 'results' | 'techTree' | 'styleGuide' | 'playground'
  | 'descent' | 'surface' | 'flight';

export interface DescentState {
  target: string;
  /** Metres above the pad. */
  altitude: number;
  /** Downward velocity, m/s. */
  vy: number;
  /** Lateral position, m. */
  x: number;
  /** Lateral velocity, m/s. */
  vx: number;
  /** Remaining propellant, 0–100. */
  fuel: number;
  phase: 'flying' | 'landed' | 'crashed';
  attempts: number;
  /** Touchdown speed of the last attempt, m/s. */
  touchdown: number;
}

export interface MissionSettings {
  lang: Lang;
  sound: boolean;
  volume: number;
  effectsVolume: number;
  ambienceVolume: number;
  quality: 'low' | 'medium' | 'high';
  reducedMotion: boolean;
  learnMode: boolean;
  teacherMode: boolean;
  keybindings: Record<string, string>;
}

export type HangarTab = 'profile' | 'hangar' | 'missions' | 'tech' | 'map' | 'system';

export interface MissionProgress {
  credits: number;
  xp: number;
  unlockedTech: string[];
  completed: Record<string, { score: number; grade: string }>;
  badges: string[];
}

export interface RunResult {
  missionId: string;
  difficulty: DifficultyId;
  score: ScoreBreakdown;
  grade: string;
  badges: string[];
  timeline: SimEventEntry[];
  survived: boolean;
  failureReason: string | null;
  budgetCap: number;
  costTotal: number;
  scienceReturnedGb: number;
  scienceGoalGb: number;
}

export interface LaunchState {
  phase: 'launch' | 'ops' | 'ended';
  progress: number; // 0..1 cinematic progress
  countdown: number; // T-10 .. 0
  goNoGo: { name: string; go: boolean }[];
  callout: string;
  launchFailed: boolean;
}

export interface BuilderState {
  cursor: { x: number; y: number };
  selectedCategory: ComponentCategory;
  rotation: boolean;
  placed: Record<ComponentCategory, PlacedPart | null>;
}

export interface Toast { id: number; msg: string; kind: 'info' | 'good' | 'bad' | 'warn' }

interface MissionStore {
  screen: ScreenId;
  difficulty: DifficultyId;
  missionId: string | null;
  launcherId: string | null;
  design: SpacecraftDesign;
  builder: BuilderState;
  validate: ValidationResult | null;
  validationStale: boolean;
  sim: SimState | null;
  launch: LaunchState | null;
  result: RunResult | null;
  settings: MissionSettings;
  progress: MissionProgress;
  toasts: Toast[];
  commandPulse: Record<string, number>;
  aiOpen: boolean;
  /** Which tab the Hangar should open on (set by the main menu quick links). */
  hangarTab: HangarTab;
  /** Planetary expedition — null until the team leaves orbit. */
  surface: SurfaceState | null;
  /** Landing guidance state; transient (never persisted mid-descent). */
  descent: DescentState | null;

  // navigation & config
  setScreen: (s: ScreenId) => void;
  setDifficulty: (d: DifficultyId) => void;
  selectMission: (id: string) => void;
  setLauncher: (id: string) => void;
  setComponent: (cat: ComponentCategory, id: string | null) => void;
  toggleRedundancy: (cat: ComponentCategory) => void;
  setPropellant: (kg: number) => void;
  setAltitudeOffset: (km: number) => void;
  setInclination: (deg: number) => void;
  altitudeOffsetKm: number;
  inclinationDeg: number;

  // builder
  setBuilderCategory: (c: ComponentCategory) => void;
  moveCursor: (dx: number, dy: number) => void;
  setCursor: (x: number, y: number) => void;
  placePart: () => void;
  removePart: () => void;
  rotatePart: () => void;
  autoLayout: () => void;

  // simulation
  beginLaunch: () => void;
  skipLaunch: () => void;
  tick: (dtDays: number) => void;
  endMission: () => void;
  newMission: () => void;
  dispatch: (cmd: CommandName, ctx?: { playerInitiated?: boolean }) => void;

  // planetary expedition
  startExpedition: () => void;
  setDescent: (patch: Partial<DescentState>) => void;
  landExpedition: (touchdown: number, fuelLeft: number) => void;
  failDescent: (touchdown: number) => void;
  retryDescent: () => void;
  abortExpedition: () => void;
  surfaceTick: (hours: number) => void;
  surfacePose: (x: number, z: number) => void;
  surfaceCollect: (node: SurfaceNode) => void;
  surfaceBuild: (kind: ModuleKind) => void;
  surfaceUpgrade: (id: UpgradeId) => void;
  surfaceRepair: () => void;
  surfaceResupply: () => void;
  surfaceRename: (callsign: string) => void;
  surfaceSuitColor: (color: string) => void;
  surfaceUnlockRover: () => void;
  surfaceCheckSolGoal: () => { completed: boolean; goal: SolGoal | null };
  surfaceCompleteSolGoal: () => void;
  surfaceScoutDrone: () => void;
  surfaceToggleEndless: (on: boolean) => void;
  surfaceExport: () => void;
  endExpedition: () => void;

  // meta
  setSetting: <K extends keyof MissionSettings>(k: K, v: MissionSettings[K]) => void;
  setKeybinding: (cmd: string, code: string) => void;
  unlockTech: (nodeId: string) => void;
  resetProgress: () => void;
  pushToast: (msg: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
  toggleAi: () => void;
  setHangarTab: (t: HangarTab) => void;
  save: () => void;
  /** Set when the boot save was damaged/migrated, shown once as a banner. */
  loadWarning: string | null;
  dismissLoadWarning: () => void;
  /** Serialise the current campaign + in-flight run to pretty JSON. */
  exportSave: () => string;
  /** Replace the campaign from imported JSON. Never throws. */
  importSave: (text: string) => { ok: boolean; message: string };
}

const CATEGORIES: ComponentCategory[] = ['bus', 'power', 'propulsion', 'comms', 'payload', 'thermal'];

interface HydratedRun {
  screen: ScreenId;
  missionId: string | null;
  launcherId: string | null;
  design: SpacecraftDesign;
  builder: BuilderState;
  sim: SimState | null;
  launch: LaunchState | null;
  altitudeOffsetKm: number;
  inclinationDeg: number;
  validate: ValidationResult | null;
  surface: SurfaceState | null;
}

/**
 * Read the persisted campaign at boot. A damaged primary save is quarantined
 * (kept under CORRUPT_KEY for support) and the rotating backup is tried before
 * falling back to a fresh campaign, so one bad write cannot brick the game.
 */
function readSave(): { game: PersistedGame | null; warning: string | null } {
  if (typeof localStorage === 'undefined') return { game: null, warning: null };

  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return { game: null, warning: null };
  }

  if (!raw) {
    // v1 saves predate the versioned key; read them here and let the next write
    // upgrade them in place.
    try {
      const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
      if (legacy) {
        const migrated = parseSave(legacy);
        if (migrated.game) return { game: migrated.game, warning: null };
      }
    } catch { /* storage unavailable */ }
    return { game: null, warning: null };
  }

  const primary = parseSave(raw);
  if (primary.game) return { game: primary.game, warning: primary.warning };

  try {
    localStorage.setItem(CORRUPT_KEY, raw);
  } catch { /* out of quota — nothing else to do */ }

  let backup: string | null = null;
  try {
    backup = localStorage.getItem(BACKUP_KEY);
  } catch { /* storage unavailable */ }
  if (backup) {
    const restored = parseSave(backup);
    if (restored.game) {
      return {
        game: restored.game,
        warning:
          'Your saved game was damaged, so an earlier backup was restored. Recent progress may be missing.',
      };
    }
  }

  return {
    game: null,
    warning: primary.warning ?? 'Your saved game could not be read; starting a new campaign.',
  };
}

/** Turn a parsed save into store state; validation is always recomputed, never trusted. */
function hydrateRun(game: PersistedGame | null): HydratedRun {
  const run = game?.run ?? null;
  const design: SpacecraftDesign = run
    ? { ...run.design, components: { ...run.design.components }, redundancy: { ...run.design.redundancy } }
    : { ...EMPTY_DESIGN, components: { ...EMPTY_DESIGN.components }, redundancy: { ...EMPTY_DESIGN.redundancy } };
  const missionId = run?.missionId ?? null;
  const validate = missionId
    ? resolveDesign(design, lookupTables(), budgetCapFor(game?.difficulty ?? 'tutorial'))
    : null;
  const surface = game?.surface ?? null;
  // A save written on the surface (or mid-descent) resumes the expedition even
  // though the finished mission run itself is not kept.
  const savedScreen = game?.screen;
  const screen: ScreenId =
    surface && (savedScreen === 'surface' || savedScreen === 'descent')
      ? 'surface'
      : run?.screen ?? 'home';
  return {
    screen,
    missionId,
    launcherId: run?.launcherId || null,
    design,
    builder: run ? run.builder : emptyBuilder(),
    sim: run?.sim ?? null,
    launch: run?.launch ?? null,
    altitudeOffsetKm: run?.altitudeOffsetKm ?? 0,
    inclinationDeg: run?.inclinationDeg ?? 0,
    validate,
    surface,
  };
}

const loaded = readSave();
const boot = hydrateRun(loaded.game);

function emptyBuilder(): BuilderState {
  return {
    cursor: { x: 0, y: 0 },
    selectedCategory: 'bus',
    rotation: false,
    placed: { bus: null, power: null, propulsion: null, comms: null, payload: null, thermal: null },
  };
}

/** Default design: cheapest unlocked component per category; propellant = tank capacity. */
function prefillDesign(missionId: string, launcherId: string, unlocked: string[]): { design: SpacecraftDesign; builder: BuilderState } {
  const un = unlockedIdsFor(unlocked);
  const design: SpacecraftDesign = {
    ...EMPTY_DESIGN,
    missionId,
    launcherId,
    components: { ...EMPTY_DESIGN.components },
    redundancy: { ...EMPTY_DESIGN.redundancy },
    propellantMassKg: 0,
  };
  const builder = emptyBuilder();
  const pool = COMPONENTS.filter((c) => un.components.has(c.id));
  for (const cat of CATEGORIES) {
    const opts = pool.filter((c) => c.category === cat).sort((a, b) => a.cost - b.cost);
    const pick = opts[0];
    if (!pick) continue;
    design.components[cat] = pick.id;
    const w = pick.footprintW ?? 2;
    const h = pick.footprintH ?? 2;
    const parts = CATEGORIES.map((c) => builder.placed[c]).filter(Boolean) as PlacedPart[];
    // naive first fit honoring canPlace semantics
    let placedAt: { x: number; y: number } | null = null;
    outer: for (let y = 0; y <= 5 - h; y++) {
      for (let x = 0; x <= 7 - w; x++) {
        if (canPlace(parts, x, y, w, h)) { placedAt = { x, y }; break outer; }
      }
    }
    builder.placed[cat] = placedAt ? { componentId: pick.id, x: placedAt.x, y: placedAt.y, w, h, rotated: false } : null;
  }
  const prop = design.components.propulsion ? lookupTables().components[design.components.propulsion] : null;
  design.propellantMassKg = prop?.propCapacityKg ?? 0;
  return { design, builder };
}

/** Derived: average daily solar charge (Wh/day) using mission eclipse fraction and target. */
export function dailyPowerFor(design: SpacecraftDesign, missionId: string): { chargeWhPerDay: number; loadWhPerDay: number; scienceRatePerDay: number; storageCapGb: number } {
  const tables = lookupTables();
  const mission = tables.missions[missionId];
  const v = resolveDesign(design, tables, 1e9);
  const eFrac = mission && ['leo', 'gto', 'geo'].includes(mission.target) ? 0.35 : 0.05;
  const charge = v.budget.generationW * 24 * (1 - eFrac);
  const load = v.budget.loadW * 24;
  const payload = design.components.payload ? tables.components[design.components.payload] : null;
  const scienceRate = Math.max(0.2, (payload?.sciencePower ?? 0.5) * 2.2);
  const storage = payload?.dataStorageGb ?? 32;
  return { chargeWhPerDay: charge, loadWhPerDay: load, scienceRatePerDay: scienceRate, storageCapGb: storage };
}

let toastSeq = 1;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let lastBackupAt = 0;

/** Write the current state now (also used by pagehide/visibilitychange). */
function flushSave(): void {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
  try {
    useMission.getState().save();
  } catch { /* store not ready */ }
}

/**
 * Coalesce bursts of state changes into periodic writes. Operations tick ~10×/s,
 * so a direct write per tick would hammer localStorage. Crucially this is a
 * *trailing throttle*, not a debounce: an existing timer is never reset, so
 * continuous simulation ticks cannot starve the save forever.
 */
function scheduleSave(delay = 900): void {
  if (autosaveTimer) return;
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    try {
      useMission.getState().save();
    } catch { /* storage unavailable */ }
  }, delay);
}

if (typeof window !== 'undefined') {
  // `pagehide` fires on reload/close; `visibilitychange` covers mobile task
  // switches where `pagehide` is unreliable. Both flush synchronously.
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });
}

export const useMission = create<MissionStore>((set, get) => ({
  difficulty: loaded.game?.difficulty ?? 'tutorial',
  ...boot,
  validationStale: false,
  result: null,
  settings: loaded.game?.settings ?? DEFAULT_SETTINGS,
  progress: loaded.game?.progress ?? DEFAULT_PROGRESS,
  toasts: [],
  commandPulse: {},
  aiOpen: false,
  hangarTab: 'hangar',
  loadWarning: loaded.warning,
  descent: null,

  save: () => {
    const s = get();
    const game = createSave({
      screen: s.screen,
      missionId: s.missionId,
      launcherId: s.launcherId,
      design: s.design,
      builder: s.builder,
      altitudeOffsetKm: s.altitudeOffsetKm,
      inclinationDeg: s.inclinationDeg,
      sim: s.sim,
      launch: s.launch,
      settings: s.settings,
      progress: s.progress,
      difficulty: s.difficulty,
      surface: s.surface,
    });
    try {
      // Keep a rotating backup of the last known-good save (throttled so the
      // one-second autosave does not double every write).
      const previous = localStorage.getItem(SAVE_KEY);
      if (previous && Date.now() - lastBackupAt > 15_000 && parseSave(previous).game) {
        localStorage.setItem(BACKUP_KEY, previous);
        lastBackupAt = Date.now();
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    } catch { /* storage unavailable or over quota */ }
  },

  dismissLoadWarning: () => set({ loadWarning: null }),

  exportSave: () => {
    const s = get();
    return serializeSave(
      createSave({
        screen: s.screen,
        missionId: s.missionId,
        launcherId: s.launcherId,
        design: s.design,
        builder: s.builder,
        altitudeOffsetKm: s.altitudeOffsetKm,
        inclinationDeg: s.inclinationDeg,
        sim: s.sim,
        launch: s.launch,
        settings: s.settings,
        progress: s.progress,
        difficulty: s.difficulty,
        surface: s.surface,
      }),
    );
  },

  importSave: (text) => {
    let game: PersistedGame;
    try {
      game = parseImportedSave(text);
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Could not read that file.' };
    }
    const hydrated = hydrateRun(game);
    set({
      settings: game.settings,
      progress: game.progress,
      difficulty: game.difficulty,
      ...hydrated,
      // A campaign-only file (no in-flight run) should not yank the player off
      // the screen they imported from; a run-bearing or surface file navigates.
      screen: game.run || hydrated.surface ? hydrated.screen : get().screen,
      validationStale: false,
      result: null,
      toasts: [],
      loadWarning: null,
    });
    sound.setMuted(!game.settings.sound);
    sound.setVolume(game.settings.volume);
    get().save();
    return {
      ok: true,
      message: `Imported: ${game.progress.unlockedTech.length} tech nodes, ${game.progress.badges.length} badges.`,
    };
  },

  pushToast: (msg, kind = 'info') => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, msg, kind }] }));
    setTimeout(() => get().dismissToast(id), 5200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setScreen: (screen) => {
    if (get().settings.sound) sound.play('confirm');
    set({ screen });
    scheduleSave();
  },

  setHangarTab: (hangarTab) => set({ hangarTab }),

  setDifficulty: (difficulty) => {
    set({ difficulty });
    get().save();
  },

  selectMission: (id) => {
    const mission = MISSIONS.find((m) => m.id === id);
    if (!mission) return;
    const { progress, launcherId } = get();
    const un = unlockedIdsFor(progress.unlockedTech);
    if (!un.missions.has(id)) {
      get().pushToast('Mission locked — unlock it in the Tech Tree.', 'warn');
      if (get().settings.sound) sound.play('error');
      return;
    }
    const pickLauncher = launcherId && un.launchers.has(launcherId) ? launcherId : [...un.launchers][0] ?? 'electron';
    const { design, builder } = prefillDesign(id, pickLauncher, progress.unlockedTech);
    const validate = resolveDesign(design, lookupTables(), budgetCapFor(get().difficulty));
    set({
      missionId: id,
      launcherId: pickLauncher,
      design,
      builder,
      validate,
      altitudeOffsetKm: 0,
      inclinationDeg: mission.inclinationDeg,
      sim: null,
      launch: null,
      surface: null,
      descent: null,
    });
    scheduleSave();
  },

  setLauncher: (id) => {
    const design = { ...get().design, launcherId: id };
    const validate = design.missionId ? resolveDesign(design, lookupTables(), budgetCapFor(get().difficulty)) : null;
    set({ launcherId: id, design, validate });
    scheduleSave();
  },

  setComponent: (cat, id) => {
    const design = { ...get().design, components: { ...get().design.components, [cat]: id } };
    if (cat === 'propulsion' && id) {
      const spec = lookupTables().components[id];
      design.propellantMassKg = Math.min(design.propellantMassKg || (spec?.propCapacityKg ?? 0), spec?.propCapacityKg ?? design.propellantMassKg);
      if (design.propellantMassKg === 0) design.propellantMassKg = spec?.propCapacityKg ?? 0;
    }
    const builder = { ...get().builder, placed: { ...get().builder.placed } };
    if (id) {
      const spec = lookupTables().components[id];
      const others = CATEGORIES.filter((c) => c !== cat).map((c) => builder.placed[c]).filter(Boolean) as PlacedPart[];
      const w = spec.footprintW ?? 2;
      const h = spec.footprintH ?? 2;
      let at: { x: number; y: number } | null = null;
      outer2: for (let y = 0; y <= 5 - h; y++) {
        for (let x = 0; x <= 7 - w; x++) {
          if (canPlace(others, x, y, w, h)) { at = { x, y }; break outer2; }
        }
      }
      builder.placed[cat] = at ? { componentId: id, x: at.x, y: at.y, w, h, rotated: false } : null;
    } else {
      builder.placed[cat] = null;
    }
    const validate = design.missionId ? resolveDesign(design, lookupTables(), budgetCapFor(get().difficulty)) : null;
    set({ design, builder, validate });
    if (get().settings.sound) sound.play('attach');
    scheduleSave();
  },

  toggleRedundancy: (cat) => {
    const design = { ...get().design, redundancy: { ...get().design.redundancy, [cat]: !get().design.redundancy[cat] } };
    const validate = design.missionId ? resolveDesign(design, lookupTables(), budgetCapFor(get().difficulty)) : null;
    set({ design, validate });
    if (get().settings.sound) sound.play('attach');
    scheduleSave();
  },

  setPropellant: (kg) => {
    const spec = get().design.components.propulsion ? lookupTables().components[get().design.components.propulsion!] : null;
    const cap = spec?.propCapacityKg ?? 0;
    const design = { ...get().design, propellantMassKg: Math.max(0, Math.min(cap, Math.round(kg))) };
    const validate = design.missionId ? resolveDesign(design, lookupTables(), budgetCapFor(get().difficulty)) : null;
    set({ design, validate });
    scheduleSave();
  },

  setAltitudeOffset: (km) => {
    set({ altitudeOffsetKm: Math.max(-200, Math.min(400, km)) });
    scheduleSave();
  },
  setInclination: (deg) => {
    set({ inclinationDeg: Math.max(0, Math.min(180, deg)) });
    scheduleSave();
  },

  setBuilderCategory: (c) => {
    const b = get().builder;
    const part = b.placed[c];
    set({ builder: { ...b, selectedCategory: c, cursor: part ? { x: part.x, y: part.y } : b.cursor, rotation: part ? part.rotated : false } });
  },

  moveCursor: (dx, dy) => {
    const b = get().builder;
    set({ builder: { ...b, cursor: { x: Math.max(0, Math.min(6, b.cursor.x + dx)), y: Math.max(0, Math.min(4, b.cursor.y + dy)) } } });
    if (get().settings.sound) sound.play('key');
  },

  setCursor: (x, y) => set((s) => ({ builder: { ...s.builder, cursor: { x, y } } })),

  placePart: () => {
    const { builder, design, settings } = get();
    const cat = builder.selectedCategory;
    const compId = design.components[cat];
    if (!compId) {
      get().pushToast('No part selected in this slot.', 'warn');
      if (settings.sound) sound.play('error');
      return;
    }
    const spec = lookupTables().components[compId];
    const w = builder.rotation ? (spec.footprintH ?? 2) : (spec.footprintW ?? 2);
    const h = builder.rotation ? (spec.footprintW ?? 2) : (spec.footprintH ?? 2);
    const others = CATEGORIES.filter((c) => c !== cat).map((c) => builder.placed[c]).filter(Boolean) as PlacedPart[];
    if (!canPlace(others, builder.cursor.x, builder.cursor.y, w, h)) {
      get().pushToast('Cell occupied or out of bounds — move the cursor.', 'bad');
      if (settings.sound) sound.play('error');
      return;
    }
    const placed = { ...builder.placed, [cat]: { componentId: compId, x: builder.cursor.x, y: builder.cursor.y, w, h, rotated: builder.rotation } };
    set({ builder: { ...builder, placed } });
    if (settings.sound) sound.play('attach');
    scheduleSave();
  },

  removePart: () => {
    const { builder, settings } = get();
    const cat = builder.selectedCategory;
    if (!builder.placed[cat]) {
      if (settings.sound) sound.play('error');
      return;
    }
    set({ builder: { ...builder, placed: { ...builder.placed, [cat]: null } } });
    if (settings.sound) sound.play('back');
    scheduleSave();
  },

  rotatePart: () => {
    const { builder, settings } = get();
    set({ builder: { ...builder, rotation: !builder.rotation } });
    if (settings.sound) sound.play('key');
  },

  autoLayout: () => {
    const { builder, design, settings } = get();
    const placed: Record<ComponentCategory, PlacedPart | null> = { bus: null, power: null, propulsion: null, comms: null, payload: null, thermal: null };
    for (const cat of CATEGORIES) {
      const id = design.components[cat];
      if (!id) continue;
      const spec = lookupTables().components[id];
      const w = spec?.footprintW ?? 2;
      const h = spec?.footprintH ?? 2;
      const others = CATEGORIES.map((c) => placed[c]).filter(Boolean) as PlacedPart[];
      let at: { x: number; y: number } | null = null;
      outer: for (let y = 0; y <= 5 - h; y++) {
        for (let x = 0; x <= 7 - w; x++) {
          if (canPlace(others, x, y, w, h)) { at = { x, y }; break outer; }
        }
      }
      placed[cat] = at ? { componentId: id, x: at.x, y: at.y, w, h, rotated: false } : null;
    }
    set({ builder: { ...builder, placed } });
    if (settings.sound) sound.play('attach');
    scheduleSave();
  },

  beginLaunch: () => {
    const { design, missionId, difficulty, validate, settings } = get();
    if (!missionId) return;
    if (!validate?.go) {
      get().pushToast('Design blocked — fix the red checks before launch.', 'bad');
      if (settings.sound) sound.play('error');
      return;
    }
    const tables = lookupTables();
    const mission = tables.missions[missionId];
    const power = dailyPowerFor(design, missionId);
    const sim0 = createSim({
      missionId,
      difficulty,
      durationDays: mission.durationDays,
      propKg: validate.budget.propellantMassKg,
      batteryCapacityWh: validate.budget.batteryWh,
      dvMps: validate.budget.availableDvMps,
      scienceGoalGb: mission.scienceGoalGb,
    });
    const goNoGo = validate.checks.map((c) => ({ name: c.id.toUpperCase(), go: c.severity !== 'fail' }));
    const launcherRel = tables.launchers[design.launcherId]?.reliability ?? 0.95;
    const launchFailed = difficulty === 'tutorial' ? false : Math.random() > launcherRel;
    set({
      screen: 'simulation',
      sim: { ...sim0, batteryChargeWh: validate.budget.batteryWh },
      launch: { phase: 'launch', progress: 0, countdown: 10, goNoGo, callout: 'TERMINAL COUNT', launchFailed },
      inclinationDeg: get().inclinationDeg || mission.inclinationDeg,
    });
    if (settings.sound) { sound.play('beep'); sound.startRumble(); }
    get().save();
  },

  skipLaunch: () => {
    const launch = get().launch;
    if (!launch || launch.phase !== 'launch') return;
    set({ launch: { ...launch, phase: 'ops', progress: 1, countdown: 0, callout: 'ORBIT INSERTION' } });
    if (get().settings.sound) { sound.stopRumble(); sound.play('confirm'); }
    scheduleSave();
  },

  tick: (dtDays) => {
    const { sim, missionId, design, difficulty, launch } = get();
    if (!sim || !missionId || launch?.phase !== 'ops') return;
    const power = dailyPowerFor(design, missionId);
    const diff = DIFFICULTIES.find((d) => d.id === difficulty);
    const next = tickMission(sim, dtDays, {
      solarChargeWhPerDay: power.chargeWhPerDay,
      loadWhPerDay: power.loadWhPerDay,
      scienceRatePerDay: power.scienceRatePerDay,
      storageCapGb: power.storageCapGb,
      autoDownlinkFracPerDay: 0.08,
      eventRate: diff?.eventRatePerDay ?? 1,
    });
    set({ sim: next });
    if (next.failed || next.complete) get().endMission();
    else scheduleSave();
  },

  endMission: () => {
    const { sim, missionId, launcherId, difficulty, design, validate, progress, launch } = get();
    if (!sim || !missionId) return;
    const tables = lookupTables();
    const mission = tables.missions[missionId];
    const launcher = tables.launchers[launcherId ?? ''] ?? { reliability: 1, name: '—', capacityToLeoKg: 0, id: '', cost: 0 };
    const budgetCap = budgetCapFor(difficulty);
    const survived = !sim.failed && !launch?.launchFailed;
    const anomalies = sim.eventLog.filter((e) => e.severity === 'critical').length;

    // Innovation: advanced propulsion/parts + redundancy depth + tight margin bonus
    let innovation = 0;
    const propSpec = design.components.propulsion ? tables.components[design.components.propulsion] : null;
    if (propSpec?.id === 'prop_ion') innovation += 3;
    if (propSpec?.id === 'prop_hydrolox') innovation += 2;
    if (design.components.payload && (tables.components[design.components.payload]?.tier ?? 1) >= 3) innovation += 2;
    const redCount = CATEGORIES.filter((c) => design.redundancy[c]).length;
    if (redCount >= 3) innovation += 2;
    if (validate && validate.budget.massMarginKg >= 0 && validate.budget.massMarginKg < validate.budget.launcherCapacityKg * 0.06) innovation += 1;
    innovation = Math.min(10, innovation);

    const score = computeScore({
      scienceReturnedGb: sim.dataReturnedGb,
      scienceGoalGb: mission.scienceGoalGb,
      costTotal: validate?.budget.costTotal ?? 0,
      budgetCap,
      reliability: survived ? (validate?.budget.reliability ?? 0.8) : (validate?.budget.reliability ?? 0.5),
      survived,
      innovationPoints: innovation,
      anomalyCount: anomalies,
    });
    const grade = gradeForScore(score.total);

    // Badges
    const badgesWon: string[] = [];
    if (survived && score.total >= 80) badgesWon.push('Mission Ace');
    if (survived && (validate?.budget.costTotal ?? budgetCap) <= budgetCap * 0.6) badgesWon.push('Efficient Engineer');
    if (survived && (validate?.budget.massMarginKg ?? 0) >= 0 && (validate?.budget.massMarginKg ?? 1) < (validate?.budget.launcherCapacityKg ?? 1) * 0.08) badgesWon.push('Zero Waste');
    if (survived && ['engineer', 'director'].includes(difficulty)) badgesWon.push('Survivor');
    if (mission.difficultyStars >= 4 && survived) badgesWon.push('Deep-Space Navigator');

    const newBadges = badgesWon.filter((b) => !progress.badges.includes(b));
    const leftoverCredits = Math.max(0, budgetCap - (validate?.budget.costTotal ?? budgetCap));
    const earned = Math.round(leftoverCredits * 0.25 + score.total * 8000);
    const newProgress: MissionProgress = {
      ...progress,
      credits: progress.credits + earned,
      xp: progress.xp + Math.round(score.total),
      badges: [...progress.badges, ...newBadges],
      completed: {
        ...progress.completed,
        [missionId]: { score: Math.max(score.total, progress.completed[missionId]?.score ?? 0), grade },
      },
    };
    set({
      progress: newProgress,
      result: {
        missionId, difficulty, score, grade, badges: badgesWon,
        timeline: sim.eventLog, survived,
        failureReason: sim.failureReason ?? (launch?.launchFailed ? 'Launcher failure during ascent.' : null),
        budgetCap, costTotal: validate?.budget.costTotal ?? 0,
        scienceReturnedGb: sim.dataReturnedGb, scienceGoalGb: mission.scienceGoalGb,
      },
      launch: launch ? { ...launch, phase: 'ended' } : null,
      screen: 'results',
    });
    if (get().settings.sound) {
      sound.stopRumble();
      sound.play(survived ? 'success' : 'failure');
    }
    get().save();
    void launcher;
  },

  newMission: () => {
    set({ screen: 'missionSelect', sim: null, launch: null, result: null, surface: null, descent: null });
    scheduleSave();
  },

  /* ---------------------------------------------------- planetary expedition */

  startExpedition: () => {
    const { result, missionId } = get();
    const id = result?.missionId ?? missionId;
    if (!id) return;
    const mission = MISSIONS.find((m) => m.id === id);
    const target = mission?.target ?? 'earth';
    const surface = createSurface({ target, seed: Date.now() & 0x7fffffff });
    set({
      surface,
      descent: {
        target,
        altitude: 800,
        vy: 10,
        x: 0,
        vx: 0,
        fuel: 100,
        phase: 'flying',
        attempts: 0,
        touchdown: 0,
      },
      screen: 'descent',
    });
    if (get().settings.sound) sound.play('warp');
    get().save();
  },

  setDescent: (patch) => {
    const d = get().descent;
    if (!d) return;
    set({ descent: { ...d, ...patch } });
  },

  landExpedition: (touchdown, fuelLeft) => {
    const { surface, descent } = get();
    if (!surface || !descent) return;
    const soft = touchdown <= 2.5;
    const next: SurfaceState = {
      ...surface,
      xp: surface.xp + (soft ? 30 : 12),
      log: [
        ...surface.log,
        {
          h: 0,
          msg: soft
            ? `Soft touchdown at ${touchdown.toFixed(1)} m/s. Expedition begins.`
            : `Hard landing at ${touchdown.toFixed(1)} m/s. Suit and lander damaged.`,
          kind: soft ? 'good' : 'warn',
        },
      ],
    };
    set({
      surface: next,
      descent: { ...descent, phase: 'landed', touchdown, fuel: fuelLeft, altitude: 0, vy: 0 },
      screen: 'surface',
    });
    get().pushToast(soft ? 'Touchdown confirmed — base camp is live.' : 'Hard landing — check suit integrity.', soft ? 'good' : 'warn');
    if (get().settings.sound) sound.play(soft ? 'success' : 'alarm');
    get().save();
  },

  failDescent: (touchdown) => {
    const d = get().descent;
    if (!d) return;
    set({ descent: { ...d, phase: 'crashed', touchdown, altitude: 0, vy: 0, attempts: d.attempts + 1 } });
    if (get().settings.sound) sound.play('failure');
  },

  retryDescent: () => {
    const d = get().descent;
    if (!d) return;
    set({
      descent: {
        ...d,
        phase: 'flying',
        altitude: 800,
        vy: 10,
        x: 0,
        vx: 0,
        fuel: 100,
        attempts: d.attempts + 1,
        touchdown: 0,
      },
    });
  },

  abortExpedition: () => {
    set({ surface: null, descent: null, screen: 'results' });
    get().save();
  },

  surfaceTick: (hours) => {
    const { surface, screen } = get();
    if (!surface || screen !== 'surface' || surface.status !== 'active') return;
    const res = tickSurface(surface, hours);
    if (res.state === surface) return;
    set({ surface: res.state });
    for (const ev of res.events.slice(0, 2)) get().pushToast(ev.msg, ev.kind);
    scheduleSave();
  },

  surfacePose: (x, z) => {
    const surface = get().surface;
    if (!surface) return;
    set({ surface: moveSurvivor(surface, x, z) });
  },

  surfaceCollect: (node) => {
    const surface = get().surface;
    if (!surface) return;
    const res = engineCollectNode(surface, node);
    if (!res.ok) {
      get().pushToast(res.message, 'warn');
      if (get().settings.sound) sound.play('error');
      return;
    }
    set({ surface: res.state });
    get().pushToast(res.message, 'good');
    if (get().settings.sound) sound.play('scan');
    scheduleSave();
  },

  surfaceBuild: (kind) => {
    const surface = get().surface;
    if (!surface) return;
    const res = engineBuildModule(surface, kind);
    if (!res.ok) {
      get().pushToast(res.message, 'warn');
      if (get().settings.sound) sound.play('error');
      return;
    }
    set({ surface: res.state });
    get().pushToast(res.message, 'good');
    if (get().settings.sound) sound.play('attach');
    scheduleSave();
  },

  surfaceUpgrade: (id) => {
    const surface = get().surface;
    if (!surface) return;
    const res = engineUpgradeSuit(surface, id);
    if (!res.ok) {
      get().pushToast(res.message, 'warn');
      if (get().settings.sound) sound.play('error');
      return;
    }
    set({ surface: res.state });
    get().pushToast(res.message, 'good');
    if (get().settings.sound) sound.play('confirm');
    scheduleSave();
  },

  surfaceRepair: () => {
    const surface = get().surface;
    if (!surface) return;
    const res = engineRepairSuit(surface);
    if (!res.ok) {
      get().pushToast(res.message, 'warn');
      if (get().settings.sound) sound.play('error');
      return;
    }
    set({ surface: res.state });
    get().pushToast(res.message, 'good');
    scheduleSave();
  },

  surfaceResupply: () => {
    const surface = get().surface;
    if (!surface) return;
    const res = engineResupply(surface);
    if (!res.ok) {
      get().pushToast(res.message, 'warn');
      if (get().settings.sound) sound.play('error');
      return;
    }
    set({ surface: res.state });
    get().pushToast(res.message, 'good');
    scheduleSave();
  },

  surfaceRename: (callsign) => {
    const surface = get().surface;
    if (!surface) return;
    set({ surface: renameSurvivor(surface, callsign) });
    scheduleSave();
  },

  surfaceSuitColor: (color) => {
    const surface = get().surface;
    if (!surface) return;
    set({ surface: { ...surface, suitColor: color } });
    scheduleSave();
  },

  surfaceUnlockRover: () => {
    const surface = get().surface;
    if (!surface) return;
    const res = unlockRover(surface);
    if (!res.ok) {
      get().pushToast(res.message, 'warn');
      if (get().settings.sound) sound.play('error');
      return;
    }
    set({ surface: res.state });
    get().pushToast(res.message, 'good');
    if (get().settings.sound) sound.play('confirm');
    scheduleSave();
  },

  surfaceCheckSolGoal: () => {
    const surface = get().surface;
    if (!surface) return { completed: false, goal: null };
    return checkSolGoal(surface);
  },

  surfaceCompleteSolGoal: () => {
    const surface = get().surface;
    if (!surface) return;
    const res = completeSolGoal(surface);
    if (!res.ok) {
      get().pushToast(res.message, 'warn');
      if (get().settings.sound) sound.play('error');
      return;
    }
    set({ surface: res.state });
    get().pushToast(res.message, 'good');
    if (get().settings.sound) sound.play('confirm');
    scheduleSave();
  },

  surfaceScoutDrone: () => {
    const surface = get().surface;
    if (!surface) return;
    const res = scoutDrone(surface);
    if (!res.ok) {
      get().pushToast(res.message, 'warn');
      if (get().settings.sound) sound.play('error');
      return;
    }
    set({ surface: res.state });
    get().pushToast(res.message, 'good');
    if (get().settings.sound) sound.play('scan');
    scheduleSave();
  },

  surfaceToggleEndless: (on) => {
    const surface = get().surface;
    if (!surface) return;
    const res = setEndless(surface, on);
    if (!res.ok) {
      get().pushToast(res.message, 'warn');
      if (get().settings.sound) sound.play('error');
      return;
    }
    set({ surface: res.state });
    get().pushToast(res.message, on ? 'warn' : 'good');
    if (get().settings.sound) sound.play(on ? 'alarm' : 'confirm');
    scheduleSave();
  },

  surfaceExport: () => {
    const surface = get().surface;    if (!surface) return;
    const exportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      target: surface.target,
      callsign: surface.callsign,
      suitColor: surface.suitColor,
      seed: surface.seed,
      hours: surface.hours,
      sol: solOf(surface),
      inventory: surface.inventory,
      gathered: surface.gathered,
      walked: surface.walked,
      xp: surface.xp,
      level: levelOf(surface),
      modules: surface.modules,
      taken: surface.taken,
      upgrades: surface.upgrades,
      o2: surface.o2,
      water: surface.water,
      food: surface.food,
      warmth: surface.warmth,
      charge: surface.charge,
      radiation: surface.radiation,
      integrity: surface.integrity,
      weather: surface.weather,
      weatherHours: surface.weatherHours,
      roverUnlocked: surface.roverUnlocked,
      endless: surface.endless,
      scoutDroneTarget: surface.scoutDroneTarget,
      solGoalsCompleted: surface.solGoalsCompleted,
      log: surface.log,
      status: surface.status,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const safeName = (surface.callsign || 'CREW').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orbital_surface_${safeName}_${surface.target}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    get().pushToast('Surface state exported.', 'good');
    if (get().settings.sound) sound.play('confirm');
    scheduleSave();
  },

  endExpedition: () => {
    const { surface, progress } = get();
    if (!surface) {
      set({ screen: 'results' });
      return;
    }
    const bonus = surface.status === 'rescued' ? 10_000 : 25_000 + surface.modules.length * 12_000;
    set({
      progress: {
        ...progress,
        xp: progress.xp + surface.xp,
        credits: progress.credits + bonus,
      },
      descent: null,
      screen: 'results',
    });
    get().pushToast(
      surface.status === 'rescued'
        ? `Expedition logged: ${surface.gathered} samples, team recovered.`
        : `Expedition complete: ${surface.gathered} samples, ${surface.modules.length} base modules.`,
      surface.status === 'rescued' ? 'warn' : 'good',
    );
    get().save();
  },

  dispatch: (cmd, ctx) => {
    const { settings, screen, launch } = get();
    const now = Date.now();
    set((s) => ({ commandPulse: { ...s.commandPulse, [cmd]: now } }));
    if (settings.sound && ctx?.playerInitiated) {
      const map: Partial<Record<CommandName, Parameters<typeof sound.play>[0]>> = {
        FIRE: 'fire', SCAN: 'scan', COM: 'com', WARP: 'warp',
        SHLD: 'shldOn', CONFIRM: 'confirm', BACK: 'back', NAV: 'beep',
      };
      const s = map[cmd];
      if (s) sound.play(s);
    }

    if (screen === 'simulation') {
      const { sim } = get();
      if (!sim) return;
      if (launch?.phase === 'launch') {
        if (cmd === 'CONFIRM' || cmd === 'WARP') get().skipLaunch();
        return;
      }
      if (launch?.phase !== 'ops') return;
      const res = engineDispatch(sim, cmd);
      if (!res.accepted) {
        if (settings.sound) sound.play('error');
        get().pushToast(res.message, 'bad');
        return;
      }
      set({ sim: res.state });
      scheduleSave();
      return;
    }

    if (screen === 'builder') {
      switch (cmd) {
        case 'UP': get().moveCursor(0, -1); break;
        case 'DOWN': get().moveCursor(0, 1); break;
        case 'LEFT': get().moveCursor(-1, 0); break;
        case 'RIGHT': get().moveCursor(1, 0); break;
        case 'ROTATE_CW': case 'ROTATE_CCW': get().rotatePart(); break;
        case 'PLACE': case 'CONFIRM': get().placePart(); break;
        case 'REMOVE': case 'BACK': get().removePart(); break;
        case 'NEXT_SLOT': {
          const cur = get().builder.selectedCategory;
          const idx = CATEGORIES.indexOf(cur);
          get().setBuilderCategory(CATEGORIES[(idx + 1) % CATEGORIES.length]);
          break;
        }
        case 'ANALYSE': {
          const { design } = get();
          const v = resolveDesign(design, lookupTables(), budgetCapFor(get().difficulty));
          set({ validate: v });
          get().pushToast(v.go ? 'Design valid — cleared for launch.' : `Blocked: ${v.hardFailIds.join(', ')}.`, v.go ? 'good' : 'bad');
          if (settings.sound) sound.play(v.go ? 'confirm' : 'error');
          break;
        }
        default: break;
      }
      return;
    }

    if (screen === 'missionSelect' && cmd === 'CONFIRM') {
      const { missionId } = get();
      if (missionId) get().setScreen('builder');
    }
  },

  setSetting: <K extends keyof MissionSettings>(k: K, v: MissionSettings[K]) => {
    const settings = { ...get().settings, [k]: v };
    set({ settings });
    if (k === 'sound') sound.setMuted(!v);
    if (k === 'volume') sound.setVolume(v as number);
    get().save();
  },

  setKeybinding: (cmd, code) => {
    const keybindings = { ...get().settings.keybindings, [cmd]: code };
    set({ settings: { ...get().settings, keybindings } });
    get().save();
  },

  unlockTech: (nodeId) => {
    const node = TECH_NODES.find((n) => n.id === nodeId);
    if (!node) return;
    const { progress, settings } = get();
    const check = canUnlock(node, progress.unlockedTech, progress.credits);
    if (!check.ok) {
      if (settings.sound) sound.play('error');
      const msg = check.reason === 'credits'
        ? `Not enough credits — need ${node.cost.toLocaleString()}.`
        : 'Complete the prerequisite node first.';
      get().pushToast(msg, 'bad');
      return;
    }
    const newProgress: MissionProgress = {
      ...progress,
      credits: progress.credits - node.cost,
      unlockedTech: [...progress.unlockedTech, node.id],
    };
    set({ progress: newProgress });
    if (settings.sound) sound.play('lockOpen');
    get().pushToast(`Tech unlocked: ${node.name}`, 'good');
    get().save();
  },

  resetProgress: () => {
    set({
      progress: { ...DEFAULT_PROGRESS, unlockedTech: [STARTING_NODE] },
      difficulty: 'tutorial',
      screen: 'home',
      missionId: null,
      launcherId: null,
      design: { ...EMPTY_DESIGN, components: { ...EMPTY_DESIGN.components }, redundancy: { ...EMPTY_DESIGN.redundancy } },
      builder: emptyBuilder(),
      validate: null,
      validationStale: false,
      sim: null,
      launch: null,
      result: null,
      altitudeOffsetKm: 0,
      inclinationDeg: 0,
    });
    try {
      // A reset campaign must not be resurrected from the rotating backup.
      localStorage.removeItem(BACKUP_KEY);
      localStorage.removeItem(LEGACY_SAVE_KEY);
    } catch { /* storage unavailable */ }
    get().save();
    get().pushToast('Progress reset.', 'info');
  },

  toggleAi: () => set((s) => ({ aiOpen: !s.aiOpen })),
}));

export { CATEGORIES };

/** Convenience selectors. */
export function xpInfo() {
  const xp = useMission.getState().progress.xp;
  return { level: levelForXp(xp) };
}

export function missionTheme(target: string): string {
  if (target === 'mars') return 'mars';
  if (target === 'jupiter') return 'jupiter';
  if (target === 'europa') return 'europa';
  if (target === 'moon') return 'moon';
  if (target === 'venus') return 'venus';
  if (target === 'eros') return 'eros';
  if (target === 'titan') return 'titan';
  return 'earth';
}

/** Accent hex for canvases/SVGs (keep in sync with theme.css [data-theme] blocks). */
export function accentForTarget(target: string): string {
  switch (missionTheme(target)) {
    case 'mars': return '#FF6A3D';
    case 'jupiter': return '#A77BFF';
    case 'europa': return '#D9C6FF';
    case 'moon': return '#9AD1FF';
    case 'venus': return '#FFC55A';
    case 'eros': return '#C9B29B';
    case 'titan': return '#E8A03D';
    default: return '#46C8FF';
  }
}

export function linkInfoFor(missionId: string, design: SpacecraftDesign) {
  const tables = lookupTables();
  const mission = tables.missions[missionId];
  const comms = design.components.comms ? tables.components[design.components.comms] : null;
  const dist = mission ? missionDistanceKm(mission.target) : 0;
  const rate = comms ? dataRateMbps({ txPowerW: comms.txPowerW ?? 0, antennaGain: comms.antennaGain ?? 0, distanceKm: dist }) : 0;
  return { rateMbps: rate, lightDelayS: lightDelayS(dist), distanceKm: dist };
}

/**
 * Read-only what-if validation for the hangar refit preview.
 * Runs the same engine resolver as the builder at the current difficulty;
 * never writes to the store, so the player can inspect before installing.
 */
export function previewValidation(design: SpacecraftDesign) {
  return resolveDesign(design, lookupTables(), budgetCapFor(useMission.getState().difficulty));
}

export { MISSIONS, LAUNCHERS, COMPONENTS, TECH_NODES, DIFFICULTIES, budgetCapFor, lookupTables };
export type { SpacecraftDesign };
