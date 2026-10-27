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

export type ScreenId =
  | 'home' | 'hangar' | 'missionSelect' | 'builder' | 'launcher'
  | 'orbit' | 'simulation' | 'results' | 'techTree' | 'styleGuide' | 'playground';

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
}

const SAVE_KEY = 'ma_save_v1';

const DEFAULT_SETTINGS: MissionSettings = {
  lang: 'en',
  sound: true,
  volume: 0.6,
  effectsVolume: 0.85,
  ambienceVolume: 0.65,
  quality: 'high',
  reducedMotion: false,
  learnMode: true,
  teacherMode: false,
  keybindings: {
    FIRE: 'Space', SCAN: 'KeyS', NAV: 'KeyN', COM: 'KeyC', SHLD: 'KeyH', WARP: 'KeyW',
    CONFIRM: 'Enter', BACK: 'Backspace', UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight',
    ROTATE_CW: 'KeyE', ROTATE_CCW: 'KeyQ', PLACE: 'Enter', REMOVE: 'Backspace', NEXT_SLOT: 'Tab', ANALYSE: 'KeyA', PAUSE: 'Escape',
  },
};

const DEFAULT_PROGRESS: MissionProgress = {
  credits: 3_000_000,
  xp: 0,
  unlockedTech: [STARTING_NODE],
  completed: {},
  badges: [],
};

const EMPTY_DESIGN: SpacecraftDesign = {
  missionId: '',
  launcherId: '',
  components: { bus: null, power: null, propulsion: null, comms: null, payload: null, thermal: null },
  redundancy: { bus: false, power: false, propulsion: false, comms: false, payload: false, thermal: false },
  propellantMassKg: 0,
};

const CATEGORIES: ComponentCategory[] = ['bus', 'power', 'propulsion', 'comms', 'payload', 'thermal'];

function loadSave(): { settings: MissionSettings; progress: MissionProgress; difficulty: DifficultyId } | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings, keybindings: { ...DEFAULT_SETTINGS.keybindings, ...parsed.settings?.keybindings } },
      progress: { ...DEFAULT_PROGRESS, ...parsed.progress },
      difficulty: parsed.difficulty ?? 'tutorial',
    };
  } catch {
    return null;
  }
}

const saved = typeof localStorage !== 'undefined' ? loadSave() : null;

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

export const useMission = create<MissionStore>((set, get) => ({
  screen: 'home',
  difficulty: saved?.difficulty ?? 'tutorial',
  missionId: null,
  launcherId: null,
  design: { ...EMPTY_DESIGN, components: { ...EMPTY_DESIGN.components }, redundancy: { ...EMPTY_DESIGN.redundancy } },
  builder: emptyBuilder(),
  validate: null,
  validationStale: false,
  sim: null,
  launch: null,
  result: null,
  settings: saved?.settings ?? DEFAULT_SETTINGS,
  progress: saved?.progress ?? DEFAULT_PROGRESS,
  toasts: [],
  commandPulse: {},
  aiOpen: false,
  hangarTab: 'hangar',
  altitudeOffsetKm: 0,
  inclinationDeg: 0,

  save: () => {
    const { settings, progress, difficulty } = get();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ settings, progress, difficulty }));
    } catch { /* storage unavailable */ }
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
    });
  },

  setLauncher: (id) => {
    const design = { ...get().design, launcherId: id };
    const validate = design.missionId ? resolveDesign(design, lookupTables(), budgetCapFor(get().difficulty)) : null;
    set({ launcherId: id, design, validate });
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
  },

  toggleRedundancy: (cat) => {
    const design = { ...get().design, redundancy: { ...get().design.redundancy, [cat]: !get().design.redundancy[cat] } };
    const validate = design.missionId ? resolveDesign(design, lookupTables(), budgetCapFor(get().difficulty)) : null;
    set({ design, validate });
    if (get().settings.sound) sound.play('attach');
  },

  setPropellant: (kg) => {
    const spec = get().design.components.propulsion ? lookupTables().components[get().design.components.propulsion!] : null;
    const cap = spec?.propCapacityKg ?? 0;
    const design = { ...get().design, propellantMassKg: Math.max(0, Math.min(cap, Math.round(kg))) };
    const validate = design.missionId ? resolveDesign(design, lookupTables(), budgetCapFor(get().difficulty)) : null;
    set({ design, validate });
  },

  setAltitudeOffset: (km) => set({ altitudeOffsetKm: Math.max(-200, Math.min(400, km)) }),
  setInclination: (deg) => set({ inclinationDeg: Math.max(0, Math.min(180, deg)) }),

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
  },

  skipLaunch: () => {
    const launch = get().launch;
    if (!launch || launch.phase !== 'launch') return;
    set({ launch: { ...launch, phase: 'ops', progress: 1, countdown: 0, callout: 'ORBIT INSERTION' } });
    if (get().settings.sound) { sound.stopRumble(); sound.play('confirm'); }
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
    set({ screen: 'missionSelect', sim: null, launch: null, result: null });
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

  setSetting: (k, v) => {
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
    set({ progress: { ...DEFAULT_PROGRESS, unlockedTech: [STARTING_NODE] }, difficulty: 'tutorial', screen: 'home' });
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
