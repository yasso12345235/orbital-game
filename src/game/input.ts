/**
 * Mission Architect — unified input layer.
 * Keyboard + Gamepad API + pointer/touch all dispatch the SAME named commands.
 * Pure mapping helpers are unit-tested; the hook wires them to the store.
 */
import { useEffect } from 'react';
import type { CommandName } from '@engine';
import { useMission } from './store';
import { sound } from './audio';

/** Key code → command, honoring player keybindings. Tab is handled as NEXT_SLOT; Escape as PAUSE. */
export function keyToCommand(
  code: string,
  keybindings: Record<string, string>,
  key?: string,
): CommandName | null {
  if (code === 'Tab') return 'NEXT_SLOT';
  if (code === 'Escape') return 'PAUSE';
  for (const [cmd, bound] of Object.entries(keybindings)) {
    if (bound === code) return cmd as CommandName;
  }
  // Fallback: single-letter keys when keybindings drifted
  if (key === ' ' && keybindings.FIRE === 'Space') return 'FIRE';
  return null;
}

export const GAMEPAD_MAP: Record<number, CommandName> = {
  0: 'CONFIRM', // A
  1: 'BACK', // B
  2: 'SCAN', // X
  3: 'WARP', // Y
  4: 'LEFT', // LB (timeline scrub left)
  5: 'RIGHT', // RB (timeline scrub right)
  6: 'SHLD', // LT
  7: 'FIRE', // RT
  12: 'UP', 13: 'DOWN', 14: 'LEFT', 15: 'RIGHT',
};

/** Edge-detection: returns commands whose buttons were just pressed. */
export function gamepadToCommands(buttons: readonly { pressed: boolean; value: number }[] | undefined, prev: boolean[]): { commands: CommandName[]; state: boolean[] } {
  if (!buttons) return { commands: [], state: [] };
  const state = buttons.map((b) => b.pressed || b.value > 0.5);
  const commands: CommandName[] = [];
  state.forEach((pressed, i) => {
    if (pressed && !prev[i] && GAMEPAD_MAP[i]) commands.push(GAMEPAD_MAP[i]);
  });
  return { commands, state };
}

/** True when typing in a field — input layer must not steal keys. */
export function isTypingTarget(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable === true;
}

export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch { /* unsupported */ }
}

/** Mounts keyboard + gamepad listeners. Safe to mount once at the app root. */
export function useInputLayer() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const state = useMission.getState();
      const cmd = keyToCommand(e.code, state.settings.keybindings, e.key);
      if (!cmd) return;
      e.preventDefault();
      // keycap sound for raw keys in addition to command sounds
      if (state.settings.sound && ['UP', 'DOWN', 'LEFT', 'RIGHT', 'NEXT_SLOT'].includes(cmd)) sound.play('key');
      state.dispatch(cmd, { playerInitiated: true });
    };
    const onPointerResume = () => sound.resume();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerResume, { once: true });

    let raf = 0;
    let prev: boolean[] = [];
    let lastPoll = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - lastPoll < 90) return; // ~11 Hz polling is enough for edge detection
      lastPoll = t;
      const pads = navigator.getGamepads?.() ?? [];
      for (const gp of pads) {
        if (!gp) continue;
        const { commands, state } = gamepadToCommands(gp.buttons, prev);
        prev = state;
        if (!commands.length) continue;
        const st = useMission.getState();
        for (const cmd of commands) st.dispatch(cmd, { playerInitiated: true });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerResume);
      cancelAnimationFrame(raf);
    };
  }, []);
}
