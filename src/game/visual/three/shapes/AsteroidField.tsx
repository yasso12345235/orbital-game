/**
 * Shape 6 — Floating asteroids: noise-displaced icosahedrons in an InstancedMesh
 * (quality-scaled count), per-instance tumble speed and an accent rim emissive.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { IcosahedronGeometry, Object3D, type InstancedMesh, type MeshStandardMaterial } from 'three';
import { uAccent } from '../../store-adapters/accent';
import { useVisualQuality } from '../quality';
import { displaceAsteroid, mulberry32, syncEmissive } from './util';

export interface AsteroidFieldProps {
  /** Requested rock count (scaled down by the quality particle budget). */
  count?: number;
  spread?: number;
  /** Tumble-speed multiplier. */
  tumble?: number;
  size?: number;
}

export function AsteroidField({ count = 220, spread = 7, tumble = 1, size = 0.16 }: AsteroidFieldProps) {
  const q = useVisualQuality();
  // 30 000-particle budget ↔ 300 rocks max; keeps Low tier cheap.
  const cap = Math.max(16, Math.round(q.particles / 100));
  const n = Math.max(8, Math.min(Math.round(count), cap));

  const mesh = useRef<InstancedMesh>(null);
  const mat = useRef<MeshStandardMaterial>(null);
  const dummy = useMemo(() => new Object3D(), []);

  const data = useMemo(() => {
    const rnd = mulberry32(42);
    return Array.from({ length: n }, () => ({
      pos: [
        (rnd() * 2 - 1) * spread,
        (rnd() * 2 - 1) * spread * 0.5,
        (rnd() * 2 - 1) * spread,
      ] as [number, number, number],
      rot: [rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2] as [number, number, number],
      speed: (0.15 + rnd() * 0.75) * tumble,
      scale: size * (0.5 + rnd() * 1.2),
      axis: [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5] as [number, number, number],
      phase: rnd() * Math.PI * 2,
    }));
  }, [n, spread, tumble, size]);

  const geo = useMemo(() => displaceAsteroid(new IcosahedronGeometry(1, 1), 0.5), []);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    data.forEach((d, i) => {
      dummy.position.set(d.pos[0], d.pos[1], d.pos[2]);
      dummy.rotation.set(d.rot[0], d.rot[1], d.rot[2]);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [data, dummy]);

  useFrame((state, dt) => {
    syncEmissive(mat.current, 0.14);
    const m = mesh.current;
    if (!m || q.reduced) return;
    const t = state.clock.elapsedTime;
    void dt;
    data.forEach((d, i) => {
      dummy.position.set(
        d.pos[0] + Math.sin(t * 0.1 + i * 1.7) * spread * 0.02,
        d.pos[1] + Math.cos(t * 0.08 + d.phase) * spread * 0.015,
        d.pos[2],
      );
      dummy.rotation.set(
        d.rot[0] + t * d.speed * d.axis[0],
        d.rot[1] + t * d.speed * d.axis[1],
        d.rot[2] + t * d.speed * d.axis[2],
      );
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, n]}>
      <meshStandardMaterial
        ref={mat}
        color="#4A5164"
        roughness={0.95}
        metalness={0.06}
        emissive="#101828"
        flatShading
      />
    </instancedMesh>
  );
}
