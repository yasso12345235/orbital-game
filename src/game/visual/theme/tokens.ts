/**
 * Mission Architect — visual-layer design tokens (single source of truth).
 * Mirrors the `.ma-root` custom properties in theme.css; keep both in sync.
 */

/** Core palette (master-spec Part 6). */
export const PALETTE = {
  void: '#02050F',
  deep: '#050B1F',
  panel: '#0B1A3D',
  line: '#1B2A50',
  text: '#E8F1FF',
  muted: '#8FA3C8',
  accent: '#46C8FF',
  good: '#2FE39A',
  bad: '#FF4D6A',
  warn: '#FFC542',
} as const;

/** Secondary neon pairs for gradients and shader mixes. */
export const NEON = {
  cyan: '#46C8FF',
  violet: '#A77BFF',
  orange: '#FF6A3D',
  magenta: '#FF4DD8',
} as const;

/** Motion language (seconds). */
export const MOTION = {
  micro: 0.15,
  standard: 0.3,
  scene: 0.6,
  hero: 1.2,
  stagger: 0.06,
  accentFade: 0.6,
  easeEntrance: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
  springSoft: { stiffness: 120, damping: 14 },
} as const;

/** v3 world palette — shared by the SceneShell environment (fog, aurora). */
export const WORLD = {
  fog: '#03060F',
  auroraA: '#46C8FF',
  auroraB: '#A77BFF',
  auroraC: '#FF4DD8',
  floor: '#0B1A3D',
  starWarm: '#FFE9C4',
  starCool: '#BFD9FF',
} as const;
