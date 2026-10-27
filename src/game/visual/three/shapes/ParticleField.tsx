/**
 * Shape 8 — Particle fields: layered Points (dust + stars) with parallax
 * counter-drift and depth-based sizing. Count is clamped by the quality
 * particle budget (2k / 10k / 30k). Drift is layered rotation + slow bob
 * (shader-less, documented simplification of curl noise).
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, type Group, type PointsMaterial } from 'three';
import { useVisualQuality } from '../quality';
import { mulberry32, syncAccent } from './util';

export interface ParticleFieldProps {
  /** Requested total particles (clamped by the quality tier). */
  count?: number;
  spread?: number;
  /** Drift-speed multiplier. */
  drift?: number;
  /** Point-size multiplier (smaller = finer dust; default 1). */
  size?: number;
}

export function ParticleField({ count = 12000, spread = 24, drift = 1, size = 1 }: ParticleFieldProps) {
  const q = useVisualQuality();
  const n = Math.max(400, Math.min(Math.round(count), q.particles));

  const layers = useMemo(() => {
    const rnd = mulberry32(11);
    const mk = (n2: number, rMax: number, rMin: number) => {
      const arr = new Float32Array(n2 * 3);
      for (let i = 0; i < n2; i++) {
        const th = rnd() * Math.PI * 2;
        const ph = Math.acos(rnd() * 2 - 1);
        const r = rMin + Math.pow(rnd(), 0.6) * (rMax - rMin);
        arr[i * 3] = Math.sin(ph) * Math.cos(th) * r;
        arr[i * 3 + 1] = Math.cos(ph) * r * 0.72;
        arr[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
      }
      return arr;
    };
    const far = Math.round(n * 0.72);
    const near = n - far;
    return { far: mk(far, spread, spread * 0.35), near: mk(near, spread * 0.55, 1.2) };
  }, [n, spread]);

  const gFar = useRef<Group>(null);
  const gNear = useRef<Group>(null);
  const matNear = useRef<PointsMaterial>(null);

  useFrame((state, dt) => {
    syncAccent(matNear.current, 0.95);
    if (q.reduced) return;
    const t = state.clock.elapsedTime;
    if (gFar.current) {
      gFar.current.rotation.y += dt * 0.008 * drift;
      gFar.current.position.y = Math.sin(t * 0.05) * 0.4;
    }
    if (gNear.current) {
      gNear.current.rotation.y -= dt * 0.022 * drift;
      gNear.current.rotation.x = Math.sin(t * 0.07) * 0.05;
    }
  });

  return (
    <group>
      <group ref={gFar}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[layers.far, 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={0.05 * size}
            sizeAttenuation
            transparent
            opacity={0.5}
            color="#CFD8FF"
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      </group>
      <group ref={gNear}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[layers.near, 3]} />
          </bufferGeometry>
          <pointsMaterial
            ref={matNear}
            size={0.08 * size}
            sizeAttenuation
            transparent
            opacity={0.85}
            color="#46C8FF"
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      </group>
    </group>
  );
}
