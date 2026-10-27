/**
 * Shape 12 — Nebula & aurora: large additive billboards with an fbm noise
 * shader (shaders/nebula.frag.glsl), very slow drift, always camera-facing.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, DoubleSide, type Mesh } from 'three';
import { NEON } from '../../theme/tokens';
import { uAccent } from '../../store-adapters/accent';
import { useVisualQuality } from '../quality';
import dashVert from '../shaders/dash.vert.glsl?raw';
import nebulaFrag from '../shaders/nebula.frag.glsl?raw';

export interface NebulaProps {
  intensity?: number;
  /** UV drift speed (very slow by design). */
  drift?: number;
}

export function Nebula({ intensity = 0.9, drift = 0.02 }: NebulaProps) {
  const q = useVisualQuality();
  const p1 = useRef<Mesh>(null);
  const p2 = useRef<Mesh>(null);

  const layerA = useMemo(
    () => ({
      uAccent,
      uNeon: { value: new Color(NEON.violet) },
      uTime: { value: 0 },
      uScale: { value: 3.4 },
      uDrift: { value: drift },
      uIntensity: { value: intensity },
    }),
    [drift, intensity],
  );
  const layerB = useMemo(
    () => ({
      uAccent,
      uNeon: { value: new Color(NEON.magenta) },
      uTime: { value: 0 },
      uScale: { value: 6.2 },
      uDrift: { value: drift * 0.6 },
      uIntensity: { value: intensity * 0.75 },
    }),
    [drift, intensity],
  );

  useFrame((state, dt) => {
    if (!q.reduced) {
      layerA.uTime.value += dt;
      layerB.uTime.value += dt;
    }
    const cam = state.camera;
    if (p1.current) p1.current.lookAt(cam.position);
    if (p2.current) p2.current.lookAt(cam.position);
  });

  return (
    <group>
      <mesh ref={p1} position={[-4, 2, -16]}>
        <planeGeometry args={[30, 20]} />
        <shaderMaterial
          uniforms={layerA}
          vertexShader={dashVert}
          fragmentShader={nebulaFrag}
          transparent
          depthWrite={false}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh ref={p2} position={[6, -3, -20]}>
        <planeGeometry args={[42, 26]} />
        <shaderMaterial
          uniforms={layerB}
          vertexShader={dashVert}
          fragmentShader={nebulaFrag}
          transparent
          depthWrite={false}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
