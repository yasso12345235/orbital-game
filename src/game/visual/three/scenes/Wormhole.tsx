/**
 * WormholeScene — the step-3 transition tunnel on a full-viewport quad.
 * The owning overlay drives `progress` (0→1) from a rAF loop; this scene
 * only samples it per frame, so the warp costs zero React re-renders.
 */
import { useMemo, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, Color } from 'three';
import { uAccent } from '../../store-adapters/accent';
import { useVisualQuality } from '../quality';
import { WORLD } from '../../theme/tokens';
import wormholeVert from '../shaders/wormhole.vert.glsl?raw';
import wormholeFrag from '../shaders/wormhole.frag.glsl?raw';

export interface WormholeSceneProps {
  /** 0..1 timeline, mutated in place by the overlay's rAF loop. */
  progress: MutableRefObject<number>;
}

export function WormholeScene({ progress }: WormholeSceneProps) {
  const q = useVisualQuality();
  const viewport = useThree((s) => s.viewport);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uIntensity: { value: q.tier === 'low' ? 0.85 : 1 },
      uAccent,
      uCool: { value: new Color(WORLD.auroraA) },
      uViolet: { value: new Color(WORLD.auroraB) },
      uAspect: { value: 1 },
    }),
    [q.tier],
  );

  useFrame((state, dt) => {
    uniforms.uTime.value += Math.min(dt, 0.05);
    uniforms.uProgress.value = progress.current;
    uniforms.uAspect.value = state.size.width / Math.max(1, state.size.height);
  });

  return (
    <mesh scale={[viewport.width * 1.04, viewport.height * 1.04, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={wormholeVert}
        fragmentShader={wormholeFrag}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}
