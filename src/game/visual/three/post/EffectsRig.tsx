/**
 * EffectsRig — the shared post-processing stack of the v2 visual layer.
 * Bloom (mipmapBlur) + Vignette + fine Noise always; ChromaticAberration only
 * on fast motion / warp streaks; DepthOfField only when a focus distance is
 * supplied (Builder focus). Every pass scales with the quality tier.
 */
import { useMemo, type ReactElement } from 'react';
import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  HueSaturation,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import { useVisualQuality } from '../quality';

export interface EffectsProps {
  /** 0…1 — fast-motion / warp strength feeding chromatic aberration. */
  motion?: number;
  /** Normalised focus distance (0–1 across the camera range) for DOF. */
  focusDistance?: number;
  focalLength?: number;
  bokehScale?: number;
  /** v3 cinematic colour grade (saturation + contrast); off on low tier. */
  grade?: boolean;
}

export function EffectsRig({
  motion = 0,
  focusDistance,
  focalLength = 0.02,
  bokehScale = 3,
  grade = true,
}: EffectsProps) {
  const q = useVisualQuality();
  const caOffset = useMemo(
    () => new Vector2(0.00035 * (0.2 + motion), 0.00035 * (0.2 + motion)),
    [motion],
  );

  if (!q.post) return null;

  const passes: ReactElement[] = [];
  if (q.bloom) {
    passes.push(
      <Bloom
        key="bloom"
        mipmapBlur
        intensity={0.95}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.25}
        radius={0.72}
      />,
    );
  }
  if (q.chromatic) {
    passes.push(
      <ChromaticAberration key="ca" offset={caOffset} radialModulation modulationOffset={0.15} />,
    );
  }
  if (q.dof && focusDistance !== undefined) {
    passes.push(
      <DepthOfField
        key="dof"
        focusDistance={focusDistance}
        focalLength={focalLength}
        bokehScale={bokehScale}
      />,
    );
  }
  if (grade && q.tier !== 'low') {
    // Cinematic grade: a touch of saturation + contrast, slightly cool hues.
    passes.push(
      <HueSaturation key="hs" hue={0.012} saturation={0.09} />,
      <BrightnessContrast key="bc" brightness={-0.02} contrast={0.06} />,
    );
  }
  if (q.vignette) {
    passes.push(<Vignette key="vignette" offset={0.3} darkness={0.7} />);
  }
  if (q.noise) {
    passes.push(<Noise key="noise" premultiply blendFunction={BlendFunction.SCREEN} />);
  }
  if (passes.length === 0) return null;

  return (
    <EffectComposer multisampling={q.antialias ? 4 : 0} enableNormalPass={false}>
      {passes}
    </EffectComposer>
  );
}
