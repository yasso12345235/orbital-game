/**
 * Shared helpers for the v2 shape library: accent syncing, idle drift,
 * deterministic randomness and vertex displacement.
 */
import { useFrame } from '@react-three/fiber';
import {
  Color,
  LineBasicMaterial,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PointsMaterial,
  type BufferGeometry,
  type Object3D,
} from 'three';
import type { MutableRefObject } from 'react';
import { uAccent } from '../../store-adapters/accent';

type AccentMat =
  | MeshStandardMaterial
  | MeshBasicMaterial
  | LineBasicMaterial
  | PointsMaterial
  | MeshPhysicalMaterial;

/** Copy the live accent into a material's colour (call from useFrame). */
export function syncAccent(mat: AccentMat | null, intensity = 1) {
  if (!mat) return;
  mat.color.copy(uAccent.value).multiplyScalar(intensity);
}

/** Copy the live accent into a material's emissive channel. */
export function syncEmissive(mat: MeshStandardMaterial | MeshPhysicalMaterial | null, intensity = 0.5) {
  if (!mat) return;
  mat.emissive.copy(uAccent.value).multiplyScalar(intensity);
}

/** Idle drift: slow yaw + bobbing with a per-instance phase. */
export function useDrift(
  ref: MutableRefObject<Object3D | null>,
  opts: { speed?: number; bob?: number; phase?: number; disabled?: boolean } = {},
) {
  const { speed = 0.2, bob = 0.12, phase = 0, disabled = false } = opts;
  useFrame((state, dt) => {
    if (disabled || !ref.current) return;
    ref.current.rotation.y += dt * speed;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.8 + phase) * bob;
  });
}

/** Deterministic PRNG (mulberry32) — stable layouts across mounts. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap 3D hash for displacement noise. */
export function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

/** Displace an icosahedron along its normals — lumpy asteroid look. */
export function displaceAsteroid(geo: BufferGeometry, amount: number): BufferGeometry {
  const pos = geo.getAttribute('position');
  const v = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < pos.count; i++) {
    v.x = pos.getX(i);
    v.y = pos.getY(i);
    v.z = pos.getZ(i);
    const n = hash3(v.x * 3.1, v.y * 3.1, v.z * 3.1);
    const n2 = hash3(v.x * 7.7 + 13, v.y * 7.7, v.z * 7.7);
    const d = 1 + (n - 0.5) * amount + (n2 - 0.5) * amount * 0.4;
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    pos.setXYZ(i, (v.x / len) * d, (v.y / len) * d, (v.z / len) * d);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Blend two palette colours by factor (helper for shader-less materials). */
export function mixHex(a: string, b: string, f: number): Color {
  return new Color(a).lerp(new Color(b), f);
}
