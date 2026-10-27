/**
 * Shape 4 — Glass crystals: MeshPhysicalMaterial (transmission + iridescence),
 * slowly tumbling pair. Falls back to a plain translucent material when the
 * quality tier disables glass.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { type Mesh } from 'three';
import { useVisualQuality } from '../quality';

export interface CrystalProps {
  size?: number;
  transmission?: number;
  iridescence?: number;
  spin?: number;
}

export function Crystal({ size = 0.9, transmission = 1, iridescence = 1, spin = 0.25 }: CrystalProps) {
  const q = useVisualQuality();
  const main = useRef<Mesh>(null);
  const mate = useRef<Mesh>(null);
  const glass = q.glass;

  useFrame((state, dt) => {
    if (q.reduced) return;
    const t = state.clock.elapsedTime;
    if (main.current) {
      main.current.rotation.y += dt * spin;
      main.current.rotation.x = 0.35 + Math.sin(t * 0.5) * 0.14;
      main.current.position.y = Math.sin(t * 0.8) * 0.1;
    }
    if (mate.current) {
      mate.current.rotation.y -= dt * spin * 0.8;
      mate.current.rotation.z += dt * spin * 0.4;
      mate.current.position.y = -0.35 + Math.cos(t * 0.65) * 0.12;
    }
  });

  const glassProps = {
    transmission: glass ? transmission : 0,
    transparent: !glass,
    opacity: glass ? 1 : 0.28,
    thickness: 1.2,
    ior: 1.35,
    roughness: 0.05,
    iridescence,
    iridescenceIOR: 1.32,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
  } as const;

  return (
    <group>
      <mesh ref={main}>
        <icosahedronGeometry args={[size, 0]} />
        <meshPhysicalMaterial color="#dff1ff" {...glassProps} />
      </mesh>
      <mesh ref={mate} position={[1.7, -0.35, -0.7]} rotation={[0.3, 0.8, 0.1]} scale={0.55}>
        <octahedronGeometry args={[size, 0]} />
        <meshPhysicalMaterial color="#ffe9ff" {...glassProps} thickness={0.9} />
      </mesh>
    </group>
  );
}
