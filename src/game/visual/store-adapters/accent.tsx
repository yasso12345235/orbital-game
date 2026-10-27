/**
 * uAccent bridge — keeps the shared shader uniform in lock-step with the CSS
 * accent (`--ma-accent`) and cross-fades over 0.6 s (MOTION.accentFade).
 *
 * Direction of truth: theme.css owns the accent (data-theme / ma-critical);
 * this adapter READS it (read-only access to the engine/UI state, as required
 * by the visual-layer contract) and never writes mission state back.
 */
import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color } from 'three';
import { useMission } from '../../store';
import { MOTION, PALETTE } from '../theme/tokens';

/** The one uniform every accent-driven shader shares. Mutated in place. */
export const uAccent = { value: new Color(PALETTE.accent) };

const target = new Color(PALETTE.accent);
const from = new Color(PALETTE.accent);
let progress = 1;

/** Point the uniform at a new accent colour; the fade restarts at 0. */
export function setAccentTarget(hex: string) {
  const next = new Color(hex);
  if (next.equals(target)) return;
  from.copy(uAccent.value);
  target.copy(next);
  progress = 0;
}

/** Current accent exactly as computed from theme.css (visual source of truth). */
export function readCssAccent(): string {
  if (typeof document === 'undefined') return PALETTE.accent;
  const el = document.querySelector('.ma-root');
  if (!el) return PALETTE.accent;
  const v = getComputedStyle(el).getPropertyValue('--ma-accent').trim();
  return v || PALETTE.accent;
}

/** React bridge: re-syncs on mission/screen changes and on direct theme swaps. */
export function useAccentBridge() {
  const missionId = useMission((s) => s.missionId);
  const screen = useMission((s) => s.screen);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAccentTarget(readCssAccent()));
    return () => cancelAnimationFrame(raf);
  }, [missionId, screen]);

  // The style-guide preview + critical mode swap `data-theme` / classes
  // directly on `.ma-root`, so watch the attribute instead of the store.
  useEffect(() => {
    const el = document.querySelector('.ma-root');
    if (!el || typeof MutationObserver === 'undefined') return;
    const mo = new MutationObserver(() => {
      requestAnimationFrame(() => setAccentTarget(readCssAccent()));
    });
    mo.observe(el, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => mo.disconnect();
  }, []);
}

/** R3F driver — mounted inside every BaseCanvas so the fade follows frames. */
export function AccentDriver() {
  useFrame((_, dt) => {
    if (progress >= 1) return;
    progress = Math.min(1, progress + dt / MOTION.accentFade);
    const e = 1 - Math.pow(1 - progress, 3);
    uAccent.value.lerpColors(from, target, e);
  });
  return null;
}
