/**
 * Mission Architect UI-layer unit tests: i18n parity, tech-tree integrity, input mapping.
 * Pure logic only — no DOM required.
 */
import { describe, it, expect } from 'vitest';
import { STRINGS, LANG_KEYS, translate } from '../src/game/i18n';
import { TECH_NODES, unlockedIdsFor, canUnlock, levelForXp, xpForNextLevel, STARTING_NODE } from '../src/game/tech';
import { keyToCommand, gamepadToCommands, isTypingTarget, GAMEPAD_MAP } from '../src/game/input';
import { COMPONENTS, LAUNCHERS, MISSIONS } from '../src/engine/data';

describe('i18n — bilingual dictionary', () => {
  it('has an Arabic string for every English key', () => {
    for (const key of LANG_KEYS) {
      expect(STRINGS.ar[key], `missing ar:${key}`).toBeTruthy();
      expect(typeof STRINGS.ar[key]).toBe('string');
      expect(STRINGS.ar[key].length).toBeGreaterThan(0);
      expect(STRINGS.en[key].length).toBeGreaterThan(0);
    }
  });

  it('Arabic strings actually contain Arabic script for prose keys', () => {
    const arabic = /[\u0600-\u06FF]/;
    const keys: typeof LANG_KEYS = ['start', 'mass', 'power', 'cost', 'launch', 'fire', 'scan', 'com', 'warp', 'results', 'simulation'];
    for (const key of keys) {
      expect(arabic.test(STRINGS.ar[key]), `not localized: ${key}`).toBe(true);
    }
  });

  it('falls back to English (or the key) for unknown keys', () => {
    expect(translate('ar', 'mass')).toBe(STRINGS.ar.mass);
    expect(translate('en', 'mass')).toBe(STRINGS.en.mass);
    expect(translate('en', 'totally_unknown' as never)).toBe('totally_unknown');
  });
});

describe('tech tree — data integrity', () => {
  const componentIds = new Set(COMPONENTS.map((c) => c.id));
  const launcherIds = new Set(LAUNCHERS.map((l) => l.id));
  const missionIds = new Set(MISSIONS.map((m) => m.id));

  it('node ids are unique and prerequisites exist', () => {
    const ids = TECH_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of TECH_NODES) {
      for (const req of n.requires) expect(ids).toContain(req);
      expect(n.cost).toBeGreaterThanOrEqual(0);
    }
  });

  it('every unlocked item exists in the data tables', () => {
    for (const n of TECH_NODES) {
      n.unlocks.components?.forEach((c) => expect(componentIds, `${n.id} → ${c}`).toContain(c));
      n.unlocks.launchers?.forEach((l) => expect(launcherIds, `${n.id} → ${l}`).toContain(l));
      n.unlocks.missions?.forEach((m) => expect(missionIds, `${n.id} → ${m}`).toContain(m));
    }
  });

  it('every mission is reachable through some tech node', () => {
    const reachable = new Set<string>();
    for (const n of TECH_NODES) n.unlocks.missions?.forEach((m) => reachable.add(m));
    for (const m of MISSIONS) expect(reachable, `mission ${m.id} is unreachable`).toContain(m.id);
  });

  it('the starting node unlocks enough hardware for the first missions', () => {
    const un = unlockedIdsFor([STARTING_NODE]);
    expect(un.launchers.size).toBeGreaterThan(0);
    expect(un.components.has('bus_cubesat')).toBe(true);
    expect(un.missions.has('cubesat_imaging')).toBe(true);
    // all six categories must be fillable with the starting node alone
    for (const cat of ['bus', 'power', 'propulsion', 'comms', 'payload', 'thermal']) {
      const fillable = COMPONENTS.some((c) => c.category === cat && un.components.has(c.id));
      expect(fillable, `category ${cat} not fillable at start`).toBe(true);
    }
  });

  it('unlock gating works: prerequisites and credits', () => {
    const deep = TECH_NODES.find((n) => n.id === 'deep_space')!;
    expect(canUnlock(deep, [STARTING_NODE], 99_999_999).ok).toBe(false);
    expect(canUnlock(deep, ['basic', 'small_lift', 'medium_lift'], 10).reason).toBe('credits');
    expect(canUnlock(deep, ['basic', 'small_lift', 'medium_lift'], deep.cost).ok).toBe(true);
    expect(canUnlock(TECH_NODES[0], [STARTING_NODE], 0).ok).toBe(false);
  });

  it('XP levels progress every 300 XP', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(299)).toBe(1);
    expect(levelForXp(300)).toBe(2);
    expect(xpForNextLevel(350)).toEqual({ current: 50, needed: 300 });
  });
});

describe('input layer — key + gamepad mapping', () => {
  const binds = { FIRE: 'Space', SCAN: 'KeyS', WARP: 'KeyW', CONFIRM: 'Enter', BACK: 'Backspace' };

  it('maps bound keys to named commands', () => {
    expect(keyToCommand('Space', binds)).toBe('FIRE');
    expect(keyToCommand('KeyS', binds)).toBe('SCAN');
    expect(keyToCommand('Enter', binds)).toBe('CONFIRM');
    expect(keyToCommand('KeyZ', binds)).toBeNull();
  });

  it('Tab and Escape always work regardless of bindings', () => {
    expect(keyToCommand('Tab', {})).toBe('NEXT_SLOT');
    expect(keyToCommand('Escape', {})).toBe('PAUSE');
  });

  it('input layer ignores keystrokes while typing', () => {
    expect(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV' } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it('gamepad edges fire once per press', () => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    buttons[0].pressed = true; // A
    buttons[7].value = 1; // RT
    const first = gamepadToCommands(buttons, []);
    expect(first.commands).toContain('CONFIRM');
    expect(first.commands).toContain('FIRE');
    const second = gamepadToCommands(buttons, first.state);
    expect(second.commands).toHaveLength(0);
    buttons[0].pressed = false;
    const third = gamepadToCommands(buttons, second.state);
    expect(third.commands).not.toContain('CONFIRM');
  });

  it('every mapped gamepad button maps to a real command name', () => {
    const valid = ['FIRE', 'SCAN', 'NAV', 'COM', 'SHLD', 'WARP', 'CONFIRM', 'BACK', 'UP', 'DOWN', 'LEFT', 'RIGHT'];
    for (const cmd of Object.values(GAMEPAD_MAP)) expect(valid).toContain(cmd);
  });
});
