/**
 * VisualCoreProbe — step-1 scaffold scene. Proves the whole v2 pipeline:
 * ACES canvas, live uAccent shader (fresnel shell), accent-driven emissive
 * core, bloom/vignette/noise stack and the quality tiers.
 * Replaced by the real shape library + per-screen scenes in later steps.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BackSide, Color, MeshStandardMaterial, type Group } from 'three';
import { uAccent } from '../../store-adapters/accent';
import type { VisualQuality } from '../quality';
import fresnelVert from '../shaders/fresnel.vert.glsl?raw';
import fresnelFrag from '../shaders/fresnel.frag.glsl?raw';

export function VisualCoreProbe({ quality }: { quality: VisualQuality }) {
  const spin = useRef<Group>(null);
  const shards = useRef<Group>(null);
  const coreMat = useRef<MeshStandardMaterial>(null);

  // One accented material shared by every shard — emissive follows uAccent.
  const shardMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color('#0B1A3D'),
        metalness: 0.6,
        roughness: 0.3,
        emissive: new Color(uAccent.value),
        emissiveIntensity: 1.1,
      }),
    [],
  );
  useEffect(() => () => shardMat.dispose(), [shardMat]);

  const uniforms = useMemo(
    () => ({
      uAccent, // shared object — the accent driver mutates it in place
      uPower: { value: 2.6 },
      uIntensity: { value: 1.3 },
      uTime: { value: 0 },
      uBand: { value: 0.35 },
    }),
    [],
  );

  const shardCount = quality.tier === 'low' ? 3 : quality.tier === 'medium' ? 5 : 7;
  const detail = quality.tier === 'low' ? 0 : 1;
  const shellDetail = quality.tier === 'low' ? 1 : 2;

  useFrame((state, dt) => {
    // Accent-driven emissive: the uniform colour mutates in place.
    if (coreMat.current) coreMat.current.emissive.copy(uAccent.value).multiplyScalar(0.38);
    shardMat.emissive.copy(uAccent.value).multiplyScalar(0.85);

    if (quality.reduced) return;
    uniforms.uTime.value += dt;
    if (spin.current) {
      spin.current.rotation.y += dt * 0.22;
      spin.current.position.y = 0.2 + Math.sin(state.clock.elapsedTime * 0.8) * 0.16;
    }
    if (shards.current) shards.current.rotation.y -= dt * 0.1;
  });

  return (
    <>
      {/* Lighting: warm key, cyan rim, violet fill — no external HDRI. */}
      <ambientLight intensity={0.4} color="#33406a" />
      <directionalLight position={[5, 7, 6]} intensity={2.2} color="#fff2e0" />
      <directionalLight position={[-7, -3, -5]} intensity={0.85} color="#46c8ff" />
      <directionalLight position={[-3, 6, -7]} intensity={0.55} color="#a77bff" />

      <group ref={spin} position={[0, 0.2, 0]}>
        {/* Faceted core — emissive follows the accent. */}
        <mesh>
          <icosahedronGeometry args={[1.05, detail]} />
          <meshStandardMaterial
            ref={coreMat}
            color="#0B1A3D"
            metalness={0.75}
            roughness={0.28}
            emissive="#0a1430"
          />
        </mesh>
        {/* Fresnel shell — custom GLSL reading the shared uAccent uniform. */}
        <mesh scale={1.5}>
          <icosahedronGeometry args={[1.05, shellDetail]} />
          <shaderMaterial
            uniforms={uniforms}
            vertexShader={fresnelVert}
            fragmentShader={fresnelFrag}
            transparent
            depthWrite={false}
            side={BackSide}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>

      {/* Accent shards orbiting the core. */}
      <group ref={shards} position={[0, 0.2, 0]}>
        {Array.from({ length: shardCount }, (_, i) => {
          const a = (i / shardCount) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 2.35, Math.sin(a * 2.3) * 0.6, Math.sin(a) * 2.35]}
              rotation={[a, a * 0.7, 0]}
              material={shardMat}
            >
              <tetrahedronGeometry args={[0.16, 0]} />
            </mesh>
          );
        })}
      </group>
    </>
  );
}
