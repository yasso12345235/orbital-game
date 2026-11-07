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

  return (
    <group ref={group}>
      {/* Central Probe Bus - Aerospace Carbon-Alloy Chassis */}
      <mesh>
        <boxGeometry args={[1.2, 0.72, 0.72]} />
        <meshStandardMaterial color="#D8DFEE" metalness={0.75} roughness={0.28} />
      </mesh>

      {/* Golden Kapton Multi-Layer Insulation (MLI) Thermal Blanket */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.22, 0.44, 0.74]} />
        <meshStandardMaterial
          color="#E5AA38"
          metalness={0.92}
          roughness={0.25}
          emissive="#593A04"
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* Front Optical Science Camera / Sensor Turret */}
      <group position={[0, -0.15, 0.38]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.11, 0.13, 0.18, 18]} />
          <meshStandardMaterial color="#1A202C" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Optical Sensor Glass Lens with Antireflective Cyan Sheen */}
        <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.09, 18]} />
          <meshStandardMaterial color="#3DE0FF" metalness={0.95} roughness={0.05} emissive="#124E66" emissiveIntensity={0.8} />
        </mesh>
      </group>

      {/* RCS Thruster Quads on 4 Corners */}
      {[
        [-0.58, 0.28, 0.34],
        [0.58, 0.28, 0.34],
        [-0.58, 0.28, -0.34],
        [0.58, 0.28, -0.34],
      ].map(([x, y, z], idx) => (
        <group key={`rcs-${idx}`} position={[x, y, z]}>
          <mesh>
            <boxGeometry args={[0.08, 0.08, 0.08]} />
            <meshStandardMaterial color="#4A5568" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[x > 0 ? 0.05 : -0.05, 0, 0]} rotation={[0, 0, x > 0 ? -Math.PI / 2 : Math.PI / 2]}>
            <coneGeometry args={[0.025, 0.06, 8, 1, true]} />
            <meshStandardMaterial color="#718096" metalness={0.9} roughness={0.2} side={DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* High-Efficiency Segmented Solar Array Wings */}
      <group ref={wingL} position={[-0.62, 0.05, 0]}>
        {/* Main Left Wing Panel with Photovoltaic Blue Cells */}
        <mesh position={[-0.95, 0, 0]}>
          <boxGeometry args={[1.85, 0.03, 0.62]} />
          <meshStandardMaterial
            color="#0C2356"
            metalness={0.65}
            roughness={0.22}
            emissive="#061233"
            emissiveIntensity={0.8}
          />
        </mesh>
        {/* Photovoltaic Grid Ribs */}
        {[-1.5, -1.15, -0.8, -0.45].map((pos, i) => (
          <mesh key={`rib-l-${i}`} position={[pos, 0.018, 0]}>
            <boxGeometry args={[0.02, 0.005, 0.6]} />
            <meshStandardMaterial color="#889BBF" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
        {/* Articulated Deployable Hinge Mast */}
        <mesh position={[-0.05, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.25, 12]} />
          <meshStandardMaterial color="#A0AEC0" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      <group ref={wingR} position={[0.62, 0.05, 0]}>
        {/* Main Right Wing Panel with Photovoltaic Blue Cells */}
        <mesh position={[0.95, 0, 0]}>
          <boxGeometry args={[1.85, 0.03, 0.62]} />
          <meshStandardMaterial
            color="#0C2356"
            metalness={0.65}
            roughness={0.22}
            emissive="#061233"
            emissiveIntensity={0.8}
          />
        </mesh>
        {/* Photovoltaic Grid Ribs */}
        {[0.45, 0.8, 1.15, 1.5].map((pos, i) => (
          <mesh key={`rib-r-${i}`} position={[pos, 0.018, 0]}>
            <boxGeometry args={[0.02, 0.005, 0.6]} />
            <meshStandardMaterial color="#889BBF" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
        {/* Articulated Deployable Hinge Mast */}
        <mesh position={[0.05, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.25, 12]} />
          <meshStandardMaterial color="#A0AEC0" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* High-Gain Cassegrain Parabolic Antenna Dish */}
      <group position={[0, 0.44, 0.22]}>
        <mesh ref={dish} rotation={[-0.6, 0, 0]}>
          <coneGeometry args={[0.38, 0.24, 28, 1, true]} />
          <meshStandardMaterial color="#E2E8F0" metalness={0.85} roughness={0.22} side={DoubleSide} />
        </mesh>
        {/* Feed Horn & Sub-reflector Struts */}
        <mesh position={[0, 0.12, 0.06]}>
          <cylinderGeometry args={[0.018, 0.018, 0.28, 8]} />
          <meshStandardMaterial color="#CBD5E0" metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.24, 0.12]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color="#D4A94F" metalness={0.9} roughness={0.3} />
        </mesh>
      </group>

      {/* Star Tracker Navigation Sensor */}
      <mesh position={[0.32, 0.54, -0.2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.44, 8]} />
        <meshStandardMaterial color="#718096" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[0.32, 0.76, -0.2]}>
        <boxGeometry args={[0.12, 0.12, 0.14]} />
        <meshStandardMaterial color="#1A202C" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* RTG Nuclear Power Unit (when fitted) */}
      {rtg > 0.5 && (
        <group position={[-0.78, 0.28, -0.18]} rotation={[0, 0, -0.32]}>
          <mesh>
            <cylinderGeometry args={[0.035, 0.035, 0.46, 10]} />
            <meshStandardMaterial color="#718096" metalness={0.85} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.34, 0]}>
            <boxGeometry args={[0.26, 0.28, 0.26]} />
            <meshStandardMaterial color="#2D3748" metalness={0.7} roughness={0.4} emissive="#593A04" emissiveIntensity={0.5} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={`rtg-fin-${i}`} position={[0, -0.34, 0]} rotation={[0, (Math.PI / 2) * i, 0]}>
              <boxGeometry args={[0.025, 0.32, 0.44]} />
              <meshStandardMaterial color="#A0AEC0" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
        </group>
      )}

      {/* Dual Main Propulsion Nozzles + Plume Glow */}
      {[-0.26, 0.26].map((x) => (
        <mesh key={`nozzle-${x}`} position={[x, -0.44, 0]}>
          <coneGeometry args={[0.12, 0.26, 18, 1, true]} />
          <meshStandardMaterial color="#CBD5E0" metalness={0.95} roughness={0.18} side={DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, -0.66, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.22, 0.8, 16, 1, true]} />
        <meshBasicMaterial
          ref={glow}
          color={PALETTE.warn}
          transparent
          opacity={0.4}
          blending={AdditiveBlending}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Navigation Strobe Beacons (Green & Cyan) */}
      <mesh position={[0.61, -0.2, 0.37]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshBasicMaterial ref={nav} color="#2FE39A" />
      </mesh>
      <mesh position={[-0.61, -0.2, 0.37]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshBasicMaterial color="#3DE0FF" />
      </mesh>
    </group>
  );
}
