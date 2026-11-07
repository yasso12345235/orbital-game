/**
 * Command bus catalog — every control dispatches a named command to the engine.
 * UI never mutates resources directly. (Full bus wiring lands in build step 4;
 * this module is the contract both sides program against.)
 */
import type { CommandName } from '../core/types';

export interface CommandDef {
  name: CommandName;
  description: string;
  defaultKey: string;
  gamepadHint?: string;
  energyCost?: string;
}

export const COMMANDS: CommandDef[] = [
  { name: 'FIRE', description: 'Thruster burn — consumes propellant, changes orbit.', defaultKey: 'Space', gamepadHint: 'RT (7)' },
  { name: 'SCAN', description: 'Science scan — consumes energy, adds stored data.', defaultKey: 'KeyS', gamepadHint: 'X (2)' },
  { name: 'NAV', description: 'Orbit lock / navigation readout.', defaultKey: 'KeyN' },
  { name: 'COM', description: 'Downlink stored data via link budget.', defaultKey: 'KeyC' },
  { name: 'SHLD', description: 'Toggle safe/shield mode.', defaultKey: 'KeyH' },
  { name: 'WARP', description: 'Cycle time acceleration x1 → x10 → x100.', defaultKey: 'KeyW', gamepadHint: 'Y (3)' },
  { name: 'CONFIRM', description: 'Confirm / place.', defaultKey: 'Enter', gamepadHint: 'A (0)' },
  { name: 'BACK', description: 'Cancel / undo / remove.', defaultKey: 'Backspace', gamepadHint: 'B (1)' },
  { name: 'UP', description: 'Move selection up / raise slider.', defaultKey: 'ArrowUp', gamepadHint: 'D-pad up (12)' },
  { name: 'DOWN', description: 'Move selection down / lower slider.', defaultKey: 'ArrowDown', gamepadHint: 'D-pad down (13)' },
  { name: 'LEFT', description: 'Move selection left.', defaultKey: 'ArrowLeft', gamepadHint: 'D-pad left (14)' },
  { name: 'RIGHT', description: 'Move selection right.', defaultKey: 'ArrowRight', gamepadHint: 'D-pad right (15)' },
  { name: 'ROTATE_CW', description: 'Rotate builder part clockwise.', defaultKey: 'KeyE' },
  { name: 'ROTATE_CCW', description: 'Rotate builder part counter-clockwise.', defaultKey: 'KeyQ' },
  { name: 'PLACE', description: 'Place builder part.', defaultKey: 'Enter' },
  { name: 'REMOVE', description: 'Remove builder part.', defaultKey: 'Backspace' },
  { name: 'NEXT_SLOT', description: 'Next equipment slot.', defaultKey: 'Tab' },
  { name: 'ANALYSE', description: 'Recompute budgets (SCAN in builder).', defaultKey: 'KeyS' },
  { name: 'PAUSE', description: 'Pause menu / reset.', defaultKey: 'Escape' },
  { name: 'TAB_CYCLE', description: 'Cycle focus between panels.', defaultKey: 'Tab' },
];

export function isKnownCommand(name: string): name is CommandName {
  return COMMANDS.some((c) => c.name === name);
}
