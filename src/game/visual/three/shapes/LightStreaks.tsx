/**
 * Shape 10 — Light streaks: instanced stretched quads for warp / speed
 * effects. Streak length is driven by the `speed` prop (time-acceleration).
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, Object3D, PlaneGeometry, type InstancedMesh, type MeshBasicMaterial } from 'three';
import { useVisualQuality } from '../quality';
import { mulberry32, syncAccent } from './util';

export interface LightStreaksProps {
  count?: number;
  /** 0 = idle, 1 = full warp (drives length + velocity). */
  speed?: number;
  spread?: number;
}

export function LightStreaks({ count = 36, speed = 0.6, spread = 14 }: LightStreaksProps) {
  const q = useVisualQuality();
  const cap = Math.max(12, Math.round(q.particles / 300));
  const n = Math.max(6, Math.min(Math.round(count), cap));

  const mesh = useRef<InstancedMesh>(null);
  const mat = useRef<MeshBasicMaterial>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const geo = useMemo(() => new PlaneGeometry(1, 0.045), []);

  const data = useMemo(() => {
    const rnd = mulberry32(21);
    return Array.from({ length: n }, () => ({
      x: (rnd() * 2 - 1) * spread,
      y: (rnd() * 2 - 1) * spread * 0.5,
      z0: rnd() * 40,
      v: 6 + rnd() * 10,
      s: 0.5 + rnd() * 0.9,
    }));
  }, [n, spread]);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    data.forEach((d, i) => {
      dummy.position.set(d.x, d.y, (d.z0 % 40) - 20);
      dummy.scale.set(0.6 * d.s, 1, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [data, dummy]);

  useFrame((state, dt) => {
    syncAccent(mat.current, 1);
    const m = mesh.current;
    if (!m || q.reduced) return;
    const t = state.clock.elapsedTime;
    const len = 0.6 + speed * 5.5;
    void dt;
    data.forEach((d, i) => {
      const z = ((d.z0 + t * d.v * (0.35 + speed)) % 40) - 20;
      dummy.position.set(d.x, d.y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(len * d.s, 1, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, n]}>
      <meshBasicMaterial
        ref={mat}
        color="#46C8FF"
        transparent
        opacity={0.28 + speed * 0.4}
        blending={AdditiveBlending}
        depthWrite={false}
        side={DoubleSide}
      />
    </instancedMesh>
  );
}
