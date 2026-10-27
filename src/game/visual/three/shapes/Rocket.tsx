/**
 * Shape 16 — Rocket: stacked stages, fairing, fins, stage separation and an
 * exhaust plume whose flicker is driven by the thrust value.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, type Group, type MeshBasicMaterial } from 'three';
import { NEON } from '../../theme/tokens';
import { useVisualQuality } from '../quality';

export interface RocketProps {
  /** Stage separation 0…1 (0 = stacked, 1 = fully apart). */
  sep?: number;
  /** Engine thrust 0…1 (plume size + flicker). */
  thrust?: number;
  radius?: number;
  height?: number;
  fins?: number;
}

export function Rocket({ sep = 0, thrust = 0.8, radius = 0.42, height = 4.4, fins = 3 }: RocketProps) {
  const q = useVisualQuality();
  const lower = useRef<Group>(null);
  const plume = useRef<MeshBasicMaterial>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (lower.current) {
      lower.current.position.y = -sep * 3.4;
      lower.current.rotation.z = sep * 0.5;
      lower.current.rotation.x = sep * 0.18;
    }
    if (plume.current) {
      const fl = 0.62 + Math.sin(t * 36) * 0.16 + Math.sin(t * 91) * 0.1;
      plume.current.opacity = thrust * (q.reduced ? 0.75 : fl) * 0.9;
    }
  });

  const h = height;
  const finCount = Math.max(0, Math.min(6, Math.round(fins)));

  return (
    <group position={[0, -h * 0.45, 0]}>
      {/* ——— Stage 1 (falls away with sep) ——— */}
      <group ref={lower}>
        <mesh position={[0, h * 0.26, 0]}>
          <cylinderGeometry args={[radius, radius, h * 0.52, 28]} />
          <meshStandardMaterial color="#E8EEF8" metalness={0.25} roughness={0.5} />
        </mesh>
        {/* Accent stripe for scale */}
        <mesh position={[0, h * 0.46, 0]}>
          <cylinderGeometry args={[radius * 1.005, radius * 1.005, h * 0.06, 28]} />
          <meshStandardMaterial color="#22304C" metalness={0.4} roughness={0.4} />
        </mesh>
        {Array.from({ length: finCount }, (_, i) => (
          <group key={i} rotation={[0, (i / Math.max(1, finCount)) * Math.PI * 2, 0]}>
            <mesh position={[radius * 0.98, h * 0.1, 0]}>
              <boxGeometry args={[0.05, h * 0.17, radius * 1.05]} />
              <meshStandardMaterial color="#B9C2D8" metalness={0.8} roughness={0.35} />
            </mesh>
          </group>
        ))}
        {/* Engine bell + plume */}
        <mesh position={[0, h * 0.02, 0]}>
          <coneGeometry args={[radius * 0.55, h * 0.1, 18, 1, true]} />
          <meshStandardMaterial color="#8B93A6" metalness={0.9} roughness={0.3} side={DoubleSide} />
        </mesh>
        <mesh position={[0, -0.55, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[radius * 0.58, 1.5, 18, 1, true]} />
          <meshBasicMaterial
            ref={plume}
            color={NEON.orange}
            transparent
            opacity={0.5}
            blending={AdditiveBlending}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* ——— Upper stage + fairing ——— */}
      <mesh position={[0, h * 0.56, 0]}>
        <cylinderGeometry args={[radius * 1.02, radius * 1.02, h * 0.05, 28]} />
        <meshStandardMaterial color="#22304C" metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[0, h * 0.68, 0]}>
        <cylinderGeometry args={[radius * 0.92, radius * 0.92, h * 0.2, 28]} />
        <meshStandardMaterial color="#E8EEF8" metalness={0.25} roughness={0.5} />
      </mesh>
      <mesh position={[0, h * 0.9, 0]}>
        <coneGeometry args={[radius * 0.92, h * 0.26, 28]} />
        <meshStandardMaterial color="#DCE6F5" metalness={0.35} roughness={0.42} />
      </mesh>
    </group>
  );
}
