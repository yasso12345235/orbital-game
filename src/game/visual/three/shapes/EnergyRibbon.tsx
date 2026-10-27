/**
 * Shape 9 — Energy ribbons: TubeGeometry along CatmullRom curves with a
 * flowing dash/gradient shader (accent → neon). Used later to link panels,
 * parts and tech-tree nodes.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CatmullRomCurve3, Color, DoubleSide, Vector3, type Group } from 'three';
import { NEON } from '../../theme/tokens';
import { uAccent } from '../../store-adapters/accent';
import { useVisualQuality } from '../quality';
import dashVert from '../shaders/dash.vert.glsl?raw';
import ribbonFrag from '../shaders/ribbon.frag.glsl?raw';

export interface EnergyRibbonProps {
  /** Flow speed of the dashes. */
  flow?: number;
  glow?: number;
  /** Dashes per tube traversal. */
  repeat?: number;
  tube?: number;
}

export function EnergyRibbon({ flow = 0.6, glow = 1.6, repeat = 6, tube = 0.05 }: EnergyRibbonProps) {
  const q = useVisualQuality();
  const group = useRef<Group>(null);

  const curve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(-3.2, -1.1, 0.4),
        new Vector3(-1.7, 1.25, -0.6),
        new Vector3(0.1, -0.45, 0.6),
        new Vector3(1.9, 1.1, -0.3),
        new Vector3(3.3, -0.85, 0.2),
      ]),
    [],
  );

  const uniforms = useMemo(
    () => ({
      uAccent,
      uNeon: { value: new Color(NEON.violet) },
      uTime: { value: 0 },
      uSpeed: { value: flow },
      uGlow: { value: glow },
      uRepeat: { value: repeat },
    }),
    [flow, glow, repeat],
  );

  useFrame((state, dt) => {
    if (q.reduced) return;
    uniforms.uTime.value += dt;
    if (group.current) group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.15) * 0.22;
  });

  return (
    <group ref={group}>
      <mesh>
        <tubeGeometry args={[curve, 96, tube, 8, false]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={dashVert}
          fragmentShader={ribbonFrag}
          transparent
          depthWrite={false}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, -0.5, -0.5]} scale={0.82}>
        <tubeGeometry args={[curve, 72, tube * 0.7, 8, false]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={dashVert}
          fragmentShader={ribbonFrag}
          transparent
          depthWrite={false}
          side={DoubleSide}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
