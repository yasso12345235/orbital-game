/**
 * game.save — versioned save/restore.
 * Pure logic only (no DOM, no localStorage): every rule that decides what a
 * reloaded browser is allowed to believe lives in src/game/save.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  EMPTY_DESIGN,
  SAVE_VERSION,
  SaveImportError,
  createSave,
  exportSave,
  importSave,
  parseSave,
  saveSize,
  type PersistedGame,
  type SaveInput,
} from '../src/game/save';
import type {
  SimState,
  SpacecraftDesign,
} from '../src/engine';
import type { BuilderState, LaunchState } from '../src/game/store';

const DESIGN: SpacecraftDesign = {
  missionId: 'mars_orbiter',
  launcherId: 'falcon9',
  components: {
    bus: 'bus_small',
    power: 'pow_deploy',
    propulsion: 'prop_biprop',
    comms: 'com_xband',
    payload: 'pay_cam',
    thermal: 'thm_passive',
  },
  redundancy: { bus: false, power: true, propulsion: false, comms: false, payload: false, thermal: false },
  propellantMassKg: 420,
};

const BUILDER: BuilderState = {
  cursor: { x: 1, y: 2 },
  selectedCategory: 'bus',
  rotation: false,
  placed: {
    bus: { componentId: 'bus_small', x: 1, y: 0, w: 2, h: 2, rotated: false },
    power: null,
    propulsion: null,
    comms: null,
    payload: null,
    thermal: null,
  },
};

const SIM: SimState = {
  missionId: 'mars_orbiter',
  difficulty: 'normal',
  elapsedDays: 12.5,
  durationDays: 480,
  propRemainingKg: 250,
  batteryChargeWh: 900,
  batteryCapacityWh: 1200,
  dataStoredGb: 4,
  dataReturnedGb: 18,
  scienceGoalGb: 50,
  dvRemainingMps: 1200,
  safeMode: false,
  failed: false,
  complete: false,
  failureReason: null,
  failureDay: null,
  eventLog: [{ day: 1, kind: 'info', message: 'Launch window open.', severity: 'info' }],
  timeScale: 10,
};

const launchOf = (phase: LaunchState['phase']): LaunchState => ({
  phase,
  progress: 0.4,
  countdown: 3,
  goNoGo: [{ name: 'MASS', go: true }],
  callout: 'MAX Q',
  launchFailed: false,
});

function input(over: Partial<SaveInput> = {}): SaveInput {
  return {
    screen: 'simulation',
    missionId: 'mars_orbiter',
    launcherId: 'falcon9',
    design: DESIGN,
    builder: BUILDER,
    altitudeOffsetKm: 25,
    inclinationDeg: 25.2,
    sim: SIM,
    launch: launchOf('ops'),
    settings: DEFAULT_SETTINGS,
    progress: { ...DEFAULT_PROGRESS, credits: 4_500_000, xp: 340, badges: ['Mission Ace'] },
    difficulty: 'normal',
    ...over,
  };
}

const roundtrip = (save: PersistedGame) => parseSave(JSON.stringify(save));

describe('save v2 — create', () => {
  it('stamps the schema version and a timestamp', () => {
    const save = createSave(input());
    expect(save.version).toBe(SAVE_VERSION);
    expect(Number.isNaN(Date.parse(save.savedAt))).toBe(false);
  });

  it('persists the in-flight run for resumable screens', () => {
    for (const screen of ['missionSelect', 'builder', 'launcher', 'orbit', 'simulation'] as const) {
      const save = createSave(input({ screen }));
      expect(save.run, screen).not.toBeNull();
      expect(save.run?.screen).toBe(screen);
      expect(save.run?.missionId).toBe('mars_orbiter');
    }
  });

  it('drops the run on screens that must not resume, keeping the campaign', () => {
    for (const screen of ['home', 'results', 'techTree', 'hangar'] as const) {
      const save = createSave(input({ screen }));
      expect(save.run, screen).toBeNull();
      expect(save.progress.credits).toBe(4_500_000);
    }
  });

  it('keeps the run only when a mission is selected', () => {
    expect(createSave(input({ missionId: null, screen: 'builder' })).run).toBeNull();
  });

  it('never persists derived validation data', () => {
    const json = JSON.stringify(createSave(input()));
    expect(json).not.toContain('"validate"');
    expect(json).not.toContain('hardFailIds');
  });

  it('does not persist an ended run even on a resumable screen', () => {
    const save = createSave(input({ screen: 'simulation', launch: launchOf('ended') }));
    expect(save.run).toBeNull();
    expect(save.progress.credits).toBe(4_500_000);
  });

  it('caps the persisted event log at 300 rows', () => {
    const noisy: SimState = {
      ...SIM,
      eventLog: Array.from({ length: 5_000 }, (_, i) => ({
        day: i / 10,
        kind: 'info',
        message: `event ${i}`,
        severity: 'info' as const,
      })),
    };
    const save = createSave(input({ sim: noisy }));
    expect(save.run?.sim?.eventLog.length).toBe(300);
    expect(save.run?.sim?.eventLog[299].message).toBe('event 4999');
    expect(saveSize(save)).toBeLessThan(80_000);
  });
});

describe('save v2 — roundtrip', () => {
  it('restores design, builder, orbit and simulation exactly', () => {
    const original = createSave(input());
    const { game, source, warning } = roundtrip(original);
    expect(source).toBe('v2');
    expect(warning).toBeNull();
    expect(game).not.toBeNull();
    expect(game?.run?.design).toEqual(DESIGN);
    expect(game?.run?.builder).toEqual(BUILDER);
    expect(game?.run?.altitudeOffsetKm).toBe(25);
    expect(game?.run?.inclinationDeg).toBe(25.2);
    expect(game?.run?.sim?.elapsedDays).toBe(12.5);
    expect(game?.run?.sim?.timeScale).toBe(10);
    expect(game?.run?.launch?.phase).toBe('ops');
    expect(game?.progress.badges).toEqual(['Mission Ace']);
    expect(game?.settings.keybindings.FIRE).toBe('Space');
  });

  it('survives a second generation (write → read → write → read)', () => {
    const first = roundtrip(createSave(input())).game as PersistedGame;
    const second = roundtrip(
      createSave({
        ...input(),
        settings: first.settings,
        progress: first.progress,
        difficulty: first.difficulty,
      }),
    ).game;
    expect(second?.run?.design.components.bus).toBe('bus_small');
    expect(second?.run?.sim?.dataReturnedGb).toBe(18);
  });
});

describe('save v1 — legacy migration', () => {
  const legacy = JSON.stringify({
    settings: { ...DEFAULT_SETTINGS, lang: 'ar', volume: 0.25 },
    progress: { ...DEFAULT_PROGRESS, credits: 1_234_567, xp: 99, unlockedTech: ['basic', 'small_lift'] },
    difficulty: 'engineer',
  });

  it('reads a v1 save and upgrades it in memory', () => {
    const { game, source, warning } = parseSave(legacy);
    expect(source).toBe('v1');
    expect(warning).toBeNull();
    expect(game?.version).toBe(SAVE_VERSION);
    expect(game?.run).toBeNull();
    expect(game?.settings.lang).toBe('ar');
    expect(game?.settings.volume).toBe(0.25);
    expect(game?.difficulty).toBe('engineer');
    expect(game?.progress.credits).toBe(1_234_567);
  });

  it('falls back to defaults for a damaged difficulty and bad numbers', () => {
    const { game } = parseSave(
      JSON.stringify({ difficulty: 'nightmare', progress: { credits: 'lots', xp: -5 } }),
    );
    expect(game?.difficulty).toBe('tutorial');
    expect(game?.progress.credits).toBe(DEFAULT_PROGRESS.credits);
    expect(game?.progress.xp).toBe(0);
    expect(game?.settings.lang).toBe('en');
  });

  it('always keeps the starting tech node', () => {
    const { game } = parseSave(JSON.stringify({ progress: { unlockedTech: [] } }));
    expect(game?.progress.unlockedTech).toContain('basic');
  });
});

describe('hostile saves', () => {
  it('reports invalid JSON instead of throwing', () => {
    for (const raw of ['{not json', '', null, undefined]) {
      const res = parseSave(raw as string | null | undefined);
      expect(res.game).toBeNull();
      if (raw) expect(res.warning).toBeTruthy();
    }
  });

  it('rejects non-object payloads', () => {
    for (const raw of ['[]', '"save"', '42', 'null']) {
      const res = parseSave(raw);
      expect(res.game).toBeNull();
      expect(res.warning).toBeTruthy();
    }
  });

  it('refuses a save from a newer schema', () => {
    const res = parseSave(JSON.stringify({ version: SAVE_VERSION + 1, settings: {} }));
    expect(res.game).toBeNull();
    expect(res.warning).toContain(String(SAVE_VERSION + 1));
  });

  it('drops unknown component and launcher ids', () => {
    const raw = createSave(input());
    const run = raw.run as NonNullable<PersistedGame['run']>;
    const hostile = JSON.stringify({
      ...raw,
      run: {
        ...run,
        design: {
          ...run.design,
          launcherId: 'starship_mk9',
          components: { ...run.design.components, bus: 'bus_nonexistent', power: 'pow_deploy' },
        },
        launcherId: 'starship_mk9',
      },
    });
    const { game } = parseSave(hostile);
    expect(game?.run?.design.components.bus).toBeNull();
    expect(game?.run?.design.components.power).toBe('pow_deploy');
    expect(game?.run?.design.launcherId).toBe('');
    expect(game?.run?.launcherId).toBe('');
  });

  it('drops a run for an unknown mission but keeps the campaign', () => {
    const raw = createSave(input());
    const { game } = parseSave(
      JSON.stringify({ ...raw, run: { ...raw.run, missionId: 'to_alpha_centauri' } }),
    );
    expect(game).not.toBeNull();
    expect(game?.run).toBeNull();
    expect(game?.progress.credits).toBe(4_500_000);
  });

  it('rejects a builder placement that no longer matches the design', () => {
    const raw = createSave(input());
    const run = raw.run as NonNullable<PersistedGame['run']>;
    const { game } = parseSave(
      JSON.stringify({
        ...raw,
        run: {
          ...run,
          builder: {
            ...run.builder,
            placed: {
              ...run.builder.placed,
              bus: { componentId: 'bus_heavy', x: 0, y: 0, w: 2, h: 2, rotated: false },
            },
          },
        },
      }),
    );
    expect(game?.run?.builder.placed.bus).toBeNull();
  });

  it('clamps out-of-range progress and settings', () => {
    const raw = createSave(input());
    const { game } = parseSave(
      JSON.stringify({
        ...raw,
        progress: { ...raw.progress, credits: -50, xp: 1e12, badges: [1, 'ok', 'ok'] },
        settings: { ...raw.settings, volume: 9, quality: 'ultra', lang: 'fr' },
      }),
    );
    expect(game?.progress.credits).toBe(0);
    expect(game?.progress.xp).toBe(1e9);
    expect(game?.progress.badges).toEqual(['ok']);
    expect(game?.settings.volume).toBe(1);
    expect(game?.settings.quality).toBe('high');
    expect(game?.settings.lang).toBe('en');
  });

  it('drops a run whose simulation is malformed', () => {
    const raw = createSave(input());
    const run = raw.run as NonNullable<PersistedGame['run']>;
    const broken = { ...run, sim: { ...run.sim, elapsedDays: 'soon' } };
    const { game } = parseSave(JSON.stringify({ ...raw, run: broken }));
    expect(game?.run).toBeNull();
  });

  it('drops a simulation with no launch phase (cannot advance)', () => {
    const raw = createSave(input());
    const { game } = parseSave(JSON.stringify({ ...raw, run: { ...raw.run, launch: null } }));
    expect(game?.run).toBeNull();
  });

  it('drops a launch with no simulation (would crash operations)', () => {
    const raw = createSave(input());
    const { game } = parseSave(JSON.stringify({ ...raw, run: { ...raw.run, sim: null } }));
    expect(game?.run).toBeNull();
  });

  it('drops an ended run — results are not resumable', () => {
    const raw = createSave(input());
    const { game } = parseSave(
      JSON.stringify({ ...raw, run: { ...raw.run, launch: launchOf('ended'), screen: 'results' } }),
    );
    expect(game?.run).toBeNull();
  });

  it('resumes an interrupted cinematic directly in operations', () => {
    const raw = createSave(input());
    const { game } = parseSave(
      JSON.stringify({ ...raw, run: { ...raw.run, launch: launchOf('launch'), screen: 'simulation' } }),
    );
    expect(game?.run?.launch?.phase).toBe('ops');
    expect(game?.run?.launch?.progress).toBe(1);
    expect(game?.run?.launch?.countdown).toBe(0);
    expect(game?.run?.screen).toBe('simulation');
  });

  it('redirects a simulation screen without an ops snapshot to the builder', () => {
    const raw = createSave(input());
    const { game } = parseSave(
      JSON.stringify({ ...raw, run: { ...raw.run, screen: 'simulation', launch: null, sim: null } }),
    );
    expect(game?.run?.screen).toBe('builder');
  });

  it('never trusts a saved screen id', () => {
    const raw = createSave(input());
    const run = raw.run as NonNullable<PersistedGame['run']>;
    const { game } = parseSave(JSON.stringify({ ...raw, run: { ...run, screen: 'admin' } }));
    expect(game?.run?.screen).toBe('builder');
  });

  it('normalises a non-standard time scale', () => {
    const raw = createSave(input());
    const run = raw.run as NonNullable<PersistedGame['run']>;
    const { game } = parseSave(
      JSON.stringify({ ...raw, run: { ...run, sim: { ...run.sim, timeScale: 7 } } }),
    );
    expect(game?.run?.sim?.timeScale).toBe(1);
  });
});

describe('import / export', () => {
  it('exports pretty JSON that parses back to the same campaign', () => {
    const save = createSave(input());
    const text = exportSave(save);
    expect(text.split('\n').length).toBeGreaterThan(10);
    const back = importSave(text);
    expect(back.progress).toEqual(save.progress);
    expect(back.run?.design.components.propulsion).toBe('prop_biprop');
  });

  it('rejects empty and unreadable files with a readable reason', () => {
    expect(() => importSave('')).toThrow(SaveImportError);
    expect(() => importSave('   ')).toThrow(/empty/i);
    expect(() => importSave('{"version": 2')).toThrow(SaveImportError);
    expect(() => importSave('{"version": 99}')).toThrow(/newer version/i);
  });

  it('refuses an oversized file instead of freezing on it', () => {
    expect(() => importSave('x'.repeat(2_000_001))).toThrow(/too large/i);
  });

  it('accepts a legacy file and upgrades it', () => {
    const back = importSave(
      JSON.stringify({ progress: { credits: 777 }, difficulty: 'director' }),
    );
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.progress.credits).toBe(777);
    expect(back.difficulty).toBe('director');
    expect(back.run).toBeNull();
  });

  it('starts from a clean design when the file has no run', () => {
    const back = importSave(JSON.stringify({ progress: {} }));
    expect(back.run).toBeNull();
    expect(EMPTY_DESIGN.components.bus).toBeNull();
  });
});
