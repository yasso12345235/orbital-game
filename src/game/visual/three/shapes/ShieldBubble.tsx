/**
 * Shape 15 — Shield bubble: fresnel rim + hex-grid veil with an expanding
 * ripple around an impact direction (shaders/shield.frag.glsl). Impacts are
 * triggered by bumping the `impact.at` timestamp.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, Vector4 } from 'three';
import { uAccent } from '../../store-adapters/accent';
import { useVisualQuality } from '../quality';
import { hexTexture } from '../textures';
import shellVert from '../shaders/shell.vert.glsl?raw';
import shieldFrag from '../shaders/shield.frag.glsl?raw';

export interface ShieldImpact {
  dir: [number, number, number];
  /** Timestamp (ms) — bump to re-trigger the ripple. */
  at: number;
}

export interface ShieldBubbleProps {
  radius?: number;
  hexOpacity?: number;
  intensity?: number;
  impact?: ShieldImpact | null;
}

export function ShieldBubble({ radius = 1.9, hexOpacity = 0.55, intensity = 1.1, impact }: ShieldBubbleProps) {
  const q = useVisualQuality();
  const hexTex = useMemo(() => hexTexture(12), []);
  useEffect(() => () => hexTex.dispose(), [hexTex]);

  const uniforms = useMemo(
    () => ({
      uAccent,
      uHex: { value: hexTex },
      uHexOpacity: { value: hexOpacity },
      uImpact: { value: new Vector4(0, 1, 0, 0) },
      uRipple: { value: 0 },
      uPower: { value: 2.1 },
      uIntensity: { value: intensity },
    }),
    [hexTex, hexOpacity, intensity],
  );

  const rippleT = useRef(-1);
  const impactAt = impact?.at ?? 0;
  useEffect(() => {
    if (!impact || !impactAt) return;
    uniforms.uImpact.value.set(impact.dir[0], impact.dir[1], impact.dir[2], 1);
    rippleT.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impactAt]);

  useFrame((_, dt) => {
    if (rippleT.current < 0) return;
    rippleT.current += dt * 0.6;
    if (rippleT.current >= 1) {
      rippleT.current = -1;
      uniforms.uRipple.value = 0;
      uniforms.uImpact.value.w = 0;
    } else {
      uniforms.uRipple.value = rippleT.current;
    }
  });

  void q;
  return (
    <mesh>
      <sphereGeometry args={[radius, 64, 64]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={shellVert}
        fragmentShader={shieldFrag}
        transparent
        depthWrite={false}
        side={DoubleSide}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}
