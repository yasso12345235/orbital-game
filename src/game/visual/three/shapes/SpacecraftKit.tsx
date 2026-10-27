/**
 * Shape 14 — Procedural spacecraft kit: bus, folding solar wings, dish,
 * nozzle pair, RTG with fins, star-tracker mast. Emissive details + engine
 * glow; drives later Builder / Simulation / Results scenes.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { PALETTE } from '../../theme/tokens';
import { useVisualQuality } from '../quality';

export interface SpacecraftKitProps {
  /** 0 = wings folded against the bus, 1 = fully deployed. */
  unfold?: number;
  /** RTG instrument installed (0/1). */
  rtg?: number;
  /** Engine thrust 0…1 (glow). */
  thrust?: number;
  spin?: number;
}

export function SpacecraftKit({ unfold = 1, rtg = 0, thrust = 0.4, spin = 0.2 }: SpacecraftKitProps) {
  const q = useVisualQuality();
  const group = useRef<Group>(null);
  const wingL = useRef<Group>(null);
  const wingR = useRef<Group>(null);
  const dish = useRef<Mesh>(null);
  const glow = useRef<MeshBasicMaterial>(null);
  const nav = useRef<MeshBasicMaterial>(null);
  /** Eased deploy value so design changes (solar fitted/removed) fold smoothly. */
  const foldNow = useRef(unfold);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    // Wings deploy whenever a solar array is fitted — ease toward the target
    // (snap instantly under reduced motion, per the accessibility contract).
    foldNow.current = q.reduced
      ? unfold
      : foldNow.current + (unfold - foldNow.current) * Math.min(1, dt * 5);
    if (group.current && !q.reduced) {
      group.current.rotation.y += dt * spin * 0.5;
      group.current.position.y = Math.sin(t * 0.8) * 0.06;
    }
    const fold = (1 - Math.max(0, Math.min(1, foldNow.current))) * 1.25;
    if (wingL.current) {
      wingL.current.rotation.z = fold;
      if (!q.reduced) wingL.current.rotation.x = Math.sin(t * 0.9) * 0.03;
    }
    if (wingR.current) {
      wingR.current.rotation.z = -fold;
      if (!q.reduced) wingR.current.rotation.x = -Math.sin(t * 0.9) * 0.03;
    }
    if (dish.current && !q.reduced) {
      dish.current.rotation.y = Math.sin(t * 0.5) * 0.35;
      dish.current.rotation.x = -0.6 + Math.sin(t * 0.3) * 0.1;
    }
    if (glow.current) {
      const fl = 0.6 + Math.sin(t * 34) * 0.15;
      glow.current.opacity = thrust * fl * 0.85;
    }
    if (nav.current && !q.reduced) {
      nav.current.color.set(t % 1.6 < 0.8 ? '#2FE39A' : '#123B2A');
    }
  });

  const metal = <meshStandardMaterial color="#C6CEDD" metalness={0.82} roughness={0.32} />;

  return (
    <group ref={group}>
      {/* Bus + gold foil band */}
      <mesh>
        <boxGeometry args={[1.1, 0.68, 0.68]} />
        {metal}
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[1.12, 0.18, 0.7]} />
        <meshStandardMaterial color="#D4A94F" metalness={0.9} roughness={0.35} emissive="#3A2A08" emissiveIntensity={0.5} />
      </mesh>
      {/* Instrument stack */}
      <mesh position={[0.34, -0.42, 0.12]}>
        <cylinderGeometry args={[0.09, 0.09, 0.3, 12]} />
        <meshStandardMaterial color="#2A3147" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* Solar wings — fold against the bus as unfold → 0 */}
      <group ref={wingL} position={[-0.58, 0.05, 0]}>
        <mesh position={[-0.85, 0, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[1.7, 0.025, 0.56]} />
          <meshStandardMaterial color="#17326B" metalness={0.55} roughness={0.28} emissive="#0A1B44" emissiveIntensity={0.9} />
        </mesh>
        <mesh position={[-0.04, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.3, 10]} />
          <meshStandardMaterial color="#8B93A6" metalness={0.9} roughness={0.3} />
        </mesh>
      </group>
      <group ref={wingR} position={[0.58, 0.05, 0]}>
        <mesh position={[0.85, 0, 0]}>
          <boxGeometry args={[1.7, 0.025, 0.56]} />
          <meshStandardMaterial color="#17326B" metalness={0.55} roughness={0.28} emissive="#0A1B44" emissiveIntensity={0.9} />
        </mesh>
        <mesh position={[0.04, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.3, 10]} />
          <meshStandardMaterial color="#8B93A6" metalness={0.9} roughness={0.3} />
        </mesh>
      </group>

      {/* High-gain dish */}
      <group position={[0, 0.42, 0.26]}>
        <mesh ref={dish} rotation={[-0.6, 0, 0]}>
          <coneGeometry args={[0.34, 0.22, 24, 1, true]} />
          <meshStandardMaterial color="#B9C2D8" metalness={0.85} roughness={0.25} side={DoubleSide} />
        </mesh>
        <mesh position={[0, 0.1, 0.05]}>
          <cylinderGeometry args={[0.02, 0.02, 0.26, 8]} />
          <meshStandardMaterial color="#6B7488" metalness={0.8} roughness={0.35} />
        </mesh>
      </group>

      {/* Star-tracker mast */}
      <mesh position={[0.3, 0.52, -0.2]}>
        <cylinderGeometry args={[0.015, 0.015, 0.42, 8]} />
        <meshStandardMaterial color="#8B93A6" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0.3, 0.74, -0.2]}>
        <boxGeometry args={[0.1, 0.1, 0.12]} />
        <meshStandardMaterial color="#2A3147" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* RTG — boom + finned case when installed */}
      {rtg > 0.5 && (
        <group position={[-0.75, 0.28, -0.18]} rotation={[0, 0, -0.35]}>
          <mesh>
            <cylinderGeometry args={[0.03, 0.03, 0.42, 8]} />
            <meshStandardMaterial color="#8B93A6" metalness={0.8} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.32, 0]}>
            <boxGeometry args={[0.24, 0.26, 0.24]} />
            <meshStandardMaterial color="#3D4356" metalness={0.6} roughness={0.5} emissive="#3A2A08" emissiveIntensity={0.4} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[0, -0.32, 0]} rotation={[0, (Math.PI / 2) * i, 0]}>
              <boxGeometry args={[0.02, 0.3, 0.4]} />
              <meshStandardMaterial color="#9AA2B4" metalness={0.7} roughness={0.4} />
            </mesh>
          ))}
        </group>
      )}

      {/* Nozzle pair + plume glow */}
      {[-0.24, 0.24].map((x) => (
        <mesh key={x} position={[x, -0.42, 0]}>
          <coneGeometry args={[0.1, 0.22, 14, 1, true]} />
          <meshStandardMaterial color="#B9C2D8" metalness={0.9} roughness={0.3} side={DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, -0.62, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.2, 0.7, 14, 1, true]} />
        <meshBasicMaterial
          ref={glow}
          color={PALETTE.warn}
          transparent
          opacity={0.3}
          blending={AdditiveBlending}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Nav light */}
      <mesh position={[0.56, -0.2, 0.35]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial ref={nav} color="#2FE39A" />
      </mesh>
    </group>
  );
}
