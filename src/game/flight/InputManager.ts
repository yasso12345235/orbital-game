/**
 * InputManager — continuous keyboard input for flight control.
 *
 * Reads arrow keys (primary), Shift (throttle up), Space (engine),
 * P (pause), R (restart) while keys are held. Returns a FlightInput
 * snapshot suitable for each physics step.
 *
 * ArrowRight / ArrowLeft → steerX (yaw)
 * ArrowUp / ArrowDown → steerY (pitch)
 * Shift → throttleUp
 * Space → engine
 * P → pause
 * R → restart
 */
import { useEffect, useRef } from 'react';
import type { FlightInput } from './FlightStore';

export const KEY_CODES = {
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ShiftLeft: 'ShiftLeft',
  ShiftRight: 'ShiftRight',
  Space: 'Space',
  KeyP: 'KeyP',
  KeyR: 'KeyR',
} as const;

export function useFlightInput(): FlightInput {
  const inputRef = useRef<FlightInput>({
    steerX: 0,
    steerY: 0,
    engine: false,
    throttleUp: false,
    pause: false,
    restart: false,
  });
  const keysPressed = useRef<Set<string>>(new Set());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      keysPressed.current.add(e.code);
      if (e.code === KEY_CODES.KeyP) inputRef.current.pause = true;
      if (e.code === KEY_CODES.KeyR) inputRef.current.restart = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
      if (e.code === KEY_CODES.KeyP) inputRef.current.pause = false;
      if (e.code === KEY_CODES.KeyR) inputRef.current.restart = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Continuous read: held keys drive steer/throttle/engine each frame.
  useEffect(() => {
    const read = () => {
      const k = keysPressed.current;
      inputRef.current.steerX = 0;
      inputRef.current.steerY = 0;
      inputRef.current.throttleUp = false;
      inputRef.current.engine = false;

      if (k.has(KEY_CODES.ArrowRight)) inputRef.current.steerX = 1;
      if (k.has(KEY_CODES.ArrowLeft)) inputRef.current.steerX = -1;
      if (k.has(KEY_CODES.ArrowUp)) inputRef.current.steerY = 1;
      if (k.has(KEY_CODES.ArrowDown)) inputRef.current.steerY = -1;
      if (k.has(KEY_CODES.ShiftLeft) || k.has(KEY_CODES.ShiftRight)) inputRef.current.throttleUp = true;
      if (k.has(KEY_CODES.Space)) inputRef.current.engine = true;
    };
    read();
    const raf = requestAnimationFrame(() => read());
    return () => cancelAnimationFrame(raf);
  }, []);

  return inputRef.current;
}
