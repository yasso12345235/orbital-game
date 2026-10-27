/**
 * Shape 2 — Orbit rings: dashed animated flow shader on a torus, travelling
 * satellite markers and a counter-rotating inner ring (locked rings dim).
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, MeshBasicMaterial, type Group, type Mesh } from 'three';
import { uAccent } from '../../store-adapters/accent';
import { useVisualQuality } from '../quality';
import dashVert from '../shaders/dash.vert.glsl?raw';
import dashFrag from '../shaders/dash.frag.glsl?raw';

function DashRing({
  radius,
  thickness = 0.014,
  dashes,
  speed,
  opacity,
}: {
  radius: number;
  thickness?: number;
  dashes: number;
  speed: number;
  opacity: number;
}) {
  const q = useVisualQuality();
  const uniforms = useMemo(
    () => ({
      uAccent,
      uTime: { value: 0 },
      uDashes: { value: dashes },
      uSpeed: { value: speed },
      uOpacity: { value: opacity },
      uEmphasis: { value: 0 },
    }),
    [dashes, speed, opacity],
  );
  useFrame((state, dt) => {
    if (q.reduced) return;
    uniforms.uTime.value += dt;
    uniforms.uEmphasis.value = 0.25 + (Math.sin(state.clock.elapsedTime * 1.2 + radius) * 0.5 + 0.5) * 0.3;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, thickness, 6, 240]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={dashVert}
        fragmentShader={dashFrag}
        transparent
        depthWrite={false}
        side={DoubleSide}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}

export interface OrbitRingProps {
  radius?: number;
  tilt?: number;
  speed?: number;
  dashes?: number;
  satellites?: number;
  /** Locked rings dim (mission-gating hint). */
  locked?: boolean;
}

export function OrbitRing({
  radius = 2.4,
  tilt = 18,
  speed = 0.5,
  dashes = 42,
  satellites = 3,
  locked = false,
}: OrbitRingProps) {
  const q = useVisualQuality();
  const sats = useRef<Group>(null);
  const counter = useRef<Group>(null);

  useFrame((_, dt) => {
    if (q.reduced) return;
    if (sats.current) sats.current.rotation.y += dt * 0.32 * speed;
    if (counter.current) counter.current.rotation.y -= dt * 0.2 * speed;
  });

  const count = Math.max(0, Math.round(satellites));
  const satAngles = useMemo(
    () => Array.from({ length: count }, (_, i) => (i / Math.max(1, count)) * Math.PI * 2),
    [count],
  );
  const satMat = useMemo(() => new MeshBasicMaterial({ color: '#ffffff' }), []);

  return (
    <group rotation={[0, 0, (tilt * Math.PI) / 180]}>
      <DashRing radius={radius} dashes={dashes} speed={speed * 0.22} opacity={locked ? 0.35 : 1} />
      <group ref={counter}>
        <group rotation={[0.35, 0, 0.2]}>
          <DashRing
            radius={radius * 0.74}
            thickness={0.009}
            dashes={Math.round(dashes * 0.6)}
            speed={-speed * 0.3}
            opacity={locked ? 0.2 : 0.6}
          />
        </group>
      </group>
      <group ref={sats}>
        {satAngles.map((a, i) => (
          <group key={i} rotation={[0, a, 0]}>
            <mesh position={[radius, 0, 0]} material={satMat}>
              <sphereGeometry args={[0.055, 10, 10]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
