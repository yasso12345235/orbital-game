/**
 * Shape 1 — Planet: procedural surface (day texture with baked city lights on
 * Earth), drifting cloud shell and a fresnel atmosphere that reads uAccent.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BackSide, type Mesh } from 'three';
import { cloudTexture, planetTexture } from '../textures';
import { useVisualQuality } from '../quality';
import { uAccent } from '../../store-adapters/accent';
import fresnelVert from '../shaders/fresnel.vert.glsl?raw';
import fresnelFrag from '../shaders/fresnel.frag.glsl?raw';

export interface PlanetProps {
  target?: string;
  radius?: number;
  /** Rotation-speed multiplier (1 = gentle). */
  spin?: number;
  /** Cloud-shell density 0…1. */
  cloud?: number;
  /** Atmosphere rim strength. */
  atmosphere?: number;
}

export function Planet({
  target = 'earth',
  radius = 1.6,
  spin = 1,
  cloud = 0.8,
  atmosphere = 1.3,
}: PlanetProps) {
  const q = useVisualQuality();
  const surface = useMemo(() => planetTexture(target), [target]);
  const cloudy = cloud > 0.05;
  const cloudsTex = useMemo(() => (cloudy ? cloudTexture() : null), [cloudy]);
  useEffect(() => () => surface.dispose(), [surface]);
  useEffect(() => () => cloudsTex?.dispose(), [cloudsTex]);

  const planet = useRef<Mesh>(null);
  const cloudShell = useRef<Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uAccent,
      uPower: { value: 2.3 },
      uIntensity: { value: atmosphere },
      uTime: { value: 0 },
      uBand: { value: 0 },
    }),
    [atmosphere],
  );

  useFrame((_, dt) => {
    if (q.reduced) return;
    if (planet.current) planet.current.rotation.y += dt * 0.12 * spin;
    if (cloudShell.current) cloudShell.current.rotation.y += dt * 0.2 * spin;
    uniforms.uTime.value += dt;
  });

  const seg = q.tier === 'low' ? 48 : 96;
  return (
    <group>
      <mesh ref={planet}>
        <sphereGeometry args={[radius, seg, seg]} />
        <meshStandardMaterial map={surface} roughness={0.92} metalness={0.02} />
      </mesh>
      {cloudsTex && (
        <mesh ref={cloudShell} scale={1.012}>
          <sphereGeometry args={[radius, 64, 64]} />
          <meshStandardMaterial
            map={cloudsTex}
            transparent
            opacity={0.3 + cloud * 0.55}
            depthWrite={false}
            roughness={1}
          />
        </mesh>
      )}
      {/* Fresnel atmosphere — BackSide additive reading the shared uAccent. */}
      <mesh scale={1.2}>
        <sphereGeometry args={[radius, 64, 64]} />
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
  );
}
