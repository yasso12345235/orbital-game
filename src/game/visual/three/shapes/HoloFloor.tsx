/**
 * Shape 11 — Holographic grid floor: antialiased grid lines with distance
 * fade and an expanding scan pulse (shaders/grid.*.glsl). Reads uAccent.
 */
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, DoubleSide } from 'three';
import { NEON } from '../../theme/tokens';
import { uAccent } from '../../store-adapters/accent';
import { useVisualQuality } from '../quality';
import gridVert from '../shaders/grid.vert.glsl?raw';
import gridFrag from '../shaders/grid.frag.glsl?raw';

export interface HoloFloorProps {
  /** Grid cells per world unit. */
  scale?: number;
  /** World-space fade distance. */
  fade?: number;
  /** Scan-pulse strength (0 disables). */
  pulse?: number;
  pulseSpeed?: number;
  size?: number;
  y?: number;
}

export function HoloFloor({
  scale = 0.9,
  fade = 26,
  pulse = 0.6,
  pulseSpeed = 6,
  size = 90,
  y = -2.2,
}: HoloFloorProps) {
  const q = useVisualQuality();
  const uniforms = useMemo(
    () => ({
      uAccent,
      uNeon: { value: new Color(NEON.violet) },
      uTime: { value: 0 },
      uScale: { value: scale },
      uFade: { value: fade },
      uPulse: { value: pulse },
      uPulseSpeed: { value: pulseSpeed },
    }),
    [scale, fade, pulse, pulseSpeed],
  );

  useFrame((_, dt) => {
    if (!q.reduced) uniforms.uTime.value += dt;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <planeGeometry args={[size, size, 1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={gridVert}
        fragmentShader={gridFrag}
        transparent
        depthWrite={false}
        side={DoubleSide}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}
