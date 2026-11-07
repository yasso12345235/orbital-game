/**
 * Shape 16 — Advanced Rocket: stacked stages, titanium grid fins, multi-engine
 * octaweb cluster, fairing details, stage separation and dual-layer shock-diamond
 * exhaust plume.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, type Group, type MeshBasicMaterial, type PointLight } from 'three';
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

export function Rocket({ sep = 0, thrust = 0.8, radius = 0.44, height = 4.6, fins = 4 }: RocketProps) {
  const q = useVisualQuality();
  const lower = useRef<Group>(null);
  const plumeOuter = useRef<MeshBasicMaterial>(null);
  const plumeCore = useRef<MeshBasicMaterial>(null);
  const lightRef = useRef<PointLight>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (lower.current) {
      lower.current.position.y = -sep * 3.8;
      lower.current.rotation.z = sep * 0.45;
      lower.current.rotation.x = sep * 0.22;
    }
    const fl = 0.65 + Math.sin(t * 42) * 0.18 + Math.sin(t * 88) * 0.12;
    const effThrust = thrust * (q.reduced ? 0.8 : fl);

    if (plumeOuter.current) {
      plumeOuter.current.opacity = effThrust * 0.9;
    }
    if (plumeCore.current) {
      plumeCore.current.opacity = effThrust * 0.95;
    }
    if (lightRef.current) {
      lightRef.current.intensity = effThrust * 3.2;
    }
  });

  const h = height;
  const finCount = Math.max(0, Math.min(6, Math.round(fins)));

  return (
    <group position={[0, -h * 0.45, 0]}>
      {/* ——— Stage 1 (Booster Stage) ——— */}
      <group ref={lower}>
        {/* Main Booster Fuel/Oxidizer Core */}
        <mesh position={[0, h * 0.27, 0]}>
          <cylinderGeometry args={[radius, radius, h * 0.54, 32]} />
          <meshStandardMaterial color="#F0F4FA" metalness={0.4} roughness={0.35} />
        </mesh>

        {/* Aerodynamic Cable Raceways (runs along rocket sides) */}
        <mesh position={[radius * 0.96, h * 0.27, 0]}>
          <boxGeometry args={[radius * 0.12, h * 0.52, radius * 0.08]} />
          <meshStandardMaterial color="#222D42" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[-radius * 0.96, h * 0.27, 0]}>
          <boxGeometry args={[radius * 0.12, h * 0.52, radius * 0.08]} />
          <meshStandardMaterial color="#222D42" metalness={0.6} roughness={0.4} />
        </mesh>

        {/* Interstage Carbon Ring & Logo Stripe */}
        <mesh position={[0, h * 0.52, 0]}>
          <cylinderGeometry args={[radius * 1.015, radius * 1.015, h * 0.05, 32]} />
          <meshStandardMaterial color="#141B2D" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0, h * 0.18, 0]}>
          <cylinderGeometry args={[radius * 1.008, radius * 1.008, h * 0.02, 32]} />
          <meshStandardMaterial color={NEON.cyan} emissive={NEON.cyan} emissiveIntensity={0.4} />
        </mesh>

        {/* Titanium Grid Fins / Stabilizers */}
        {Array.from({ length: finCount }, (_, i) => {
          const angle = (i / Math.max(1, finCount)) * Math.PI * 2;
          return (
            <group key={`fin-${i}`} rotation={[0, angle, 0]}>
              <mesh position={[radius * 1.02, h * 0.48, 0]} rotation={[0, 0, 0.08]}>
                <boxGeometry args={[radius * 0.35, h * 0.08, 0.04]} />
                <meshStandardMaterial color="#3A4860" metalness={0.85} roughness={0.25} />
              </mesh>
              {/* Grid perforations effect */}
              <mesh position={[radius * 1.18, h * 0.48, 0]}>
                <boxGeometry args={[radius * 0.22, h * 0.06, 0.02]} />
                <meshStandardMaterial color="#1E283A" metalness={0.9} roughness={0.2} />
              </mesh>
            </group>
          );
        })}

        {/* Octaweb Engine Cluster Skirt & Base */}
        <mesh position={[0, h * 0.03, 0]}>
          <cylinderGeometry args={[radius * 0.98, radius * 0.9, h * 0.06, 32]} />
          <meshStandardMaterial color="#1E2433" metalness={0.85} roughness={0.3} />
        </mesh>

        {/* Center Main Engine Bell */}
        <mesh position={[0, -h * 0.02, 0]}>
          <coneGeometry args={[radius * 0.35, h * 0.14, 20, 1, true]} />
          <meshStandardMaterial color="#7D8599" metalness={0.95} roughness={0.2} side={DoubleSide} />
        </mesh>

        {/* Surrounding Cluster Engine Bells */}
        {Array.from({ length: 4 }, (_, i) => {
          const a = (i / 4) * Math.PI * 2;
          const r = radius * 0.48;
          return (
            <mesh key={`eng-${i}`} position={[Math.cos(a) * r, -h * 0.015, Math.sin(a) * r]}>
              <coneGeometry args={[radius * 0.22, h * 0.12, 16, 1, true]} />
              <meshStandardMaterial color="#6B7387" metalness={0.95} roughness={0.2} side={DoubleSide} />
            </mesh>
          );
        })}

        {/* --- High-Detail Dual Layer Supersonic Exhaust Plume --- */}
        {/* Outer Expanding Plasma Flame */}
        <mesh position={[0, -1.1, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[radius * 0.85, 2.3, 20, 1, true]} />
          <meshBasicMaterial
            ref={plumeOuter}
            color={NEON.orange}
            transparent
            opacity={0.65}
            blending={AdditiveBlending}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Inner White-Hot Supersonic Core with Mach Shock Diamonds */}
        <mesh position={[0, -0.65, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[radius * 0.42, 1.4, 18, 1, true]} />
          <meshBasicMaterial
            ref={plumeCore}
            color="#FFFFFF"
            transparent
            opacity={0.85}
            blending={AdditiveBlending}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Shock Diamonds (Mach disks) */}
        {[0.35, 0.75, 1.15].map((d, idx) => (
          <mesh key={`mach-${idx}`} position={[0, -d, 0]} rotation={[Math.PI / 4, 0, 0]}>
            <octahedronGeometry args={[radius * (0.22 - idx * 0.04), 0]} />
            <meshBasicMaterial color="#E0F7FF" blending={AdditiveBlending} transparent opacity={0.8} />
          </mesh>
        ))}

        {/* Dynamic Launch Light */}
        <pointLight ref={lightRef} position={[0, -0.8, 0]} distance={15} color="#FF8A2F" intensity={2.5} />
      </group>

      {/* ——— Upper Stage 2 ——— */}
      <mesh position={[0, h * 0.58, 0]}>
        <cylinderGeometry args={[radius * 0.94, radius * 0.94, h * 0.16, 32]} />
        <meshStandardMaterial color="#EBF0F8" metalness={0.4} roughness={0.35} />
      </mesh>

      {/* Upper Stage Avionics Collar */}
      <mesh position={[0, h * 0.67, 0]}>
        <cylinderGeometry args={[radius * 0.95, radius * 0.95, h * 0.03, 32]} />
        <meshStandardMaterial color="#2B364A" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ——— Aerodynamic Payload Fairing / Nosecone ——— */}
      <mesh position={[0, h * 0.77, 0]}>
        <cylinderGeometry args={[radius * 0.96, radius * 0.96, h * 0.18, 32]} />
        <meshStandardMaterial color="#F4F7FC" metalness={0.35} roughness={0.35} />
      </mesh>

      {/* Fairing Split Seam */}
      <mesh position={[0, h * 0.77, 0]}>
        <boxGeometry args={[radius * 1.95, h * 0.18, 0.015]} />
        <meshStandardMaterial color="#1C2436" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Fairing Ogive Nose Cone */}
      <mesh position={[0, h * 0.93, 0]}>
        <coneGeometry args={[radius * 0.96, h * 0.28, 32]} />
        <meshStandardMaterial color="#F4F7FC" metalness={0.4} roughness={0.3} />
      </mesh>

      {/* Nose Tip Aerodynamic Spike */}
      <mesh position={[0, h * 1.08, 0]}>
        <cylinderGeometry args={[0.02, 0.04, h * 0.08, 12]} />
        <meshStandardMaterial color="#6E7B95" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}
