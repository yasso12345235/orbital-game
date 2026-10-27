/**
 * Shape 7 — Wireframe polyhedra: additive-blended edges in the live accent,
 * rotating at different speeds with a small orbiting companion.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { NEON } from '../../theme/tokens';
import { useVisualQuality } from '../quality';
import { syncAccent } from './util';

export type WirePolyKind = 'icosa' | 'dodeca' | 'tetra';

export interface WirePolyProps {
  kind?: WirePolyKind;
  size?: number;
  speed?: number;
  opacity?: number;
}

function polyGeometry(kind: WirePolyKind, size: number) {
  if (kind === 'dodeca') return <dodecahedronGeometry args={[size, 0]} />;
  if (kind === 'tetra') return <tetrahedronGeometry args={[size, 0]} />;
  return <icosahedronGeometry args={[size, 0]} />;
}

export function WirePoly({ kind = 'icosa', size = 1.35, speed = 0.25, opacity = 0.85 }: WirePolyProps) {
  const q = useVisualQuality();
  const main = useRef<Mesh>(null);
  const comp = useRef<Mesh>(null);
  const orbit = useRef<Group>(null);
  const matA = useRef<MeshBasicMaterial>(null);
  const matB = useRef<MeshBasicMaterial>(null);

  useFrame((state, dt) => {
    syncAccent(matA.current, 1);
    syncAccent(matB.current, 0.8);
    if (q.reduced) return;
    const t = state.clock.elapsedTime;
    if (main.current) {
      main.current.rotation.y += dt * speed;
      main.current.rotation.x += dt * speed * 0.35;
    }
    if (comp.current) {
      comp.current.rotation.y -= dt * speed * 1.7;
      comp.current.rotation.z += dt * speed * 0.9;
    }
    if (orbit.current) {
      orbit.current.rotation.y += dt * speed * 0.5;
      orbit.current.rotation.x = Math.sin(t * 0.4) * 0.25;
    }
  });

  return (
    <group>
      <mesh ref={main}>
        {polyGeometry(kind, size)}
        <meshBasicMaterial
          ref={matA}
          color="#46C8FF"
          wireframe
          transparent
          opacity={opacity}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={comp} position={[1.9, 0.25, -0.4]} scale={0.62}>
        {polyGeometry(kind, size)}
        <meshBasicMaterial
          ref={matB}
          color="#46C8FF"
          wireframe
          transparent
          opacity={opacity * 0.7}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <group ref={orbit}>
        <mesh position={[0, 2.05, 0]} scale={0.14}>
          {polyGeometry('tetra', size)}
          <meshBasicMaterial
            color={NEON.violet}
            wireframe
            transparent
            opacity={0.9}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
