/**
 * Quality tiers — scale particles, post-processing, DPR and materials.
 * Reads the shared settings store (read-only) + prefers-reduced-motion.
 */
import { useMemo } from 'react';
import { useMission } from '../../store';
import { useReducedMotion } from '../../hooks';

export type QualityTier = 'low' | 'medium' | 'high';

export interface VisualQuality {
  tier: QualityTier;
  dprMin: number;
  dprMax: number;
  /** Particle budget (dust + stars + debris) for scene layers. */
  particles: number;
  /** EffectComposer on/off. */
  post: boolean;
  bloom: boolean;
  chromatic: boolean;
  vignette: boolean;
  noise: boolean;
  dof: boolean;
  antialias: boolean;
  /** MeshPhysicalMaterial transmission allowed (glass). */
  glass: boolean;
  shadows: boolean;
  /** prefers-reduced-motion — static cameras, no parallax, no shake. */
  reduced: boolean;
}

const TIERS: Record<QualityTier, Partial<VisualQuality>> = {
  high: {
    dprMax: 2,
    particles: 30000,
    post: true,
    bloom: true,
    chromatic: true,
    vignette: true,
    noise: true,
    dof: true,
    antialias: true,
    glass: true,
    shadows: true,
  },
  medium: {
    dprMax: 1.6,
    particles: 10000,
    post: true,
    bloom: true,
    chromatic: true,
    vignette: true,
    noise: true,
    dof: false,
    antialias: true,
    glass: true,
    shadows: false,
  },
  low: {
    dprMin: 0.8,
    dprMax: 1.25,
    particles: 2000,
    post: true,
    bloom: true,
    chromatic: false,
    vignette: true,
    noise: false,
    dof: false,
    antialias: false,
    glass: false,
    shadows: false,
  },
};

export function resolveQuality(tier: QualityTier, reduced: boolean): VisualQuality {
  const base: VisualQuality = {
    tier,
    dprMin: 1,
    dprMax: 2,
    particles: 30000,
    post: true,
    bloom: true,
    chromatic: true,
    vignette: true,
    noise: true,
    dof: true,
    antialias: true,
    glass: true,
    shadows: true,
    reduced,
    ...TIERS[tier],
  };
  // Reduced motion never removes glow (visual identity) — only animation.
  if (reduced) {
    base.chromatic = false;
    base.dof = false;
  }
  return base;
}

/** Hook — responds to settings.quality and prefers-reduced-motion. */
export function useVisualQuality(): VisualQuality {
  const tier = useMission((s) => s.settings.quality);
  const reduced = useReducedMotion();
  return useMemo(() => resolveQuality(tier, reduced), [tier, reduced]);
}
