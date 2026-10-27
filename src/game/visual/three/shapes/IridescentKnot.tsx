/**
 * Shape 5 — Iridescent torus knots & rings: fresnel-driven hue shift mixing the
 * live accent with a neon partner colour (see shaders/iridescent.frag.glsl).
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type Group } from 'three';
import { NEON } from '../../theme/tokens';
import { uAccent } from '../../store-adapters/accent';
import { useVisualQuality } from '../quality';
import fresnelVert from '../shaders/fresnel.vert.glsl?raw';
import iridescentFrag from '../shaders/iridescent.frag.glsl?raw';

export interface IridescentKnotProps {
  knotP?: number;
  knotQ?: number;
  radius?: number;
  tube?: number;
  spin?: number;
  /** Fresnel hue spread (0…1). */
  hue?: number;
  /** Rim glow strength. */
  glow?: number;
}

export function IridescentKnot({
  knotP = 2,
  knotQ = 3,
  radius = 1.1,
  tube = 0.3,
  spin = 0.3,
  hue = 0.45,
  glow = 1.7,
}: IridescentKnotProps) {
  const q = useVisualQuality();
  const group = useRef<Group>(null);

  const uniforms = useMemo(
    () => ({
      uAccent,
      uNeon: { value: new Color(NEON.violet) },
      uRange: { value: hue },
      uShift: { value: 0.05 },
      uGlow: { value: glow },
    }),
    [hue, glow],
  );

  useFrame((_, dt) => {
    if (q.reduced) return;
    uniforms.uShift.value = (uniforms.uShift.value + dt * 0.06) % 1;
    if (group.current) {
      group.current.rotation.y += dt * spin;
      group.current.rotation.x += dt * spin * 0.25;
    }
  });

  return (
    <group ref={group}>
      <mesh>
        <torusKnotGeometry args={[radius, tube, 180, 24, knotP, knotQ]} />
        <shaderMaterial uniforms={uniforms} vertexShader={fresnelVert} fragmentShader={iridescentFrag} />
      </mesh>
      {/* Companion ring — same material language, offset composition. */}
      <mesh position={[0, 0, 0]} rotation={[1.2, 0.4, 0]}>
        <torusGeometry args={[radius * 1.6, tube * 0.18, 12, 160]} />
        <shaderMaterial uniforms={uniforms} vertexShader={fresnelVert} fragmentShader={iridescentFrag} />
      </mesh>
    </group>
  );
}
