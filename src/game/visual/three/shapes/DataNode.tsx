/**
 * Shape 13 — Data nodes: a pulsing marker sphere with expanding rings, a
 * leader line and an HTML label (drei <Html>). Reads the live accent.
 */
import { useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, DoubleSide, type LineBasicMaterial, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from 'three';
import { useVisualQuality } from '../quality';
import { syncAccent, syncEmissive } from './util';

export interface DataNodeProps {
  label?: string;
  /** Pulse speed multiplier. */
  pulse?: number;
  /** Expanding rings (1–2). */
  rings?: number;
  position?: [number, number, number];
  /** Leader-line height. */
  leader?: number;
  /** Fixed tint (e.g. event severity); unset follows the live accent. */
  color?: string;
}

export function DataNode({
  label = 'NODE-01',
  pulse = 1,
  rings = 2,
  position = [0, 0, 0],
  leader = 1.35,
  color,
}: DataNodeProps) {
  const q = useVisualQuality();
  const tint = useMemo(() => (color ? new Color(color) : null), [color]);
  const nodeMat = useRef<MeshStandardMaterial>(null);
  const lineMat = useRef<LineBasicMaterial>(null);
  const ringA = useRef<Mesh>(null);
  const ringB = useRef<Mesh>(null);
  const matA = useRef<MeshBasicMaterial>(null);
  const matB = useRef<MeshBasicMaterial>(null);
  const ringMesh = [ringA, ringB];
  const ringMat = [matA, matB];

  useFrame((state) => {
    if (tint) {
      if (nodeMat.current) nodeMat.current.emissive.copy(tint);
      if (lineMat.current) lineMat.current.color.copy(tint).multiplyScalar(0.85);
      ringMat.forEach((m) => m.current?.color.copy(tint));
    } else {
      syncEmissive(nodeMat.current, 0.6);
      syncAccent(lineMat.current, 0.8);
      ringMat.forEach((m) => syncAccent(m.current, 1));
    }
    if (q.reduced) return;
    const t = state.clock.elapsedTime * (0.5 + pulse * 0.7);
    for (let i = 0; i < Math.min(2, rings); i++) {
      const r = ringMesh[i].current;
      const m = ringMat[i].current;
      if (!r || !m) continue;
      const ph = (t * 0.6 + i * 0.5) % 1;
      r.scale.setScalar(1 + ph * 2.6);
      m.opacity = Math.max(0, 1 - ph) * 0.85;
    }
  });

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial ref={nodeMat} color="#0B1A3D" emissive="#46C8FF" emissiveIntensity={1.6} roughness={0.4} />
      </mesh>

      {[0, 1].slice(0, Math.max(0, Math.min(2, rings))).map((i) => (
        <mesh key={i} ref={ringMesh[i]} rotation={[-Math.PI / 2 + 0.4 * i, 0, 0]}>
          <ringGeometry args={[0.17, 0.2, 40]} />
          <meshBasicMaterial
            ref={ringMat[i]}
            color="#46C8FF"
            transparent
            opacity={0.8}
            side={DoubleSide}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Leader line */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array([0, 0.13, 0, 0, leader, 0]), 3]} />
        </bufferGeometry>
        <lineBasicMaterial ref={lineMat} color="#46C8FF" transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} />
      </lineSegments>

      <Html center distanceFactor={9} position={[0, leader + 0.22, 0]} zIndexRange={[20, 0]}>
        <span
          className="whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-widest"
          style={{
            borderColor: 'var(--ma-line)',
            color: 'var(--ma-text)',
            background: 'rgba(5,11,31,0.78)',
          }}
        >
          {label}
        </span>
      </Html>
    </group>
  );
}
