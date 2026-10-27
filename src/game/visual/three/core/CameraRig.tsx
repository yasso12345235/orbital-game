/**
 * CameraRig — cinematic camera: breathing drift + pointer parallax with eased
 * damping. Reduced motion pins the camera at the exact base position (no
 * drift, no parallax), per the accessibility contract.
 *
 * Do not combine with OrbitControls (both own the camera) — SceneShell picks
 * one or the other via its `controls` prop.
 */
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useVisualQuality } from '../quality';

export interface CameraRigProps {
  /** Base camera position (matches the canvas initial position). */
  base?: [number, number, number];
  /** Look-at target. */
  target?: [number, number, number];
  /** Idle breathing amplitude in world units. */
  drift?: number;
  /** Pointer parallax strength (0 disables). */
  parallax?: number;
}

export function CameraRig({
  base = [0, 1.2, 9.6],
  target = [0, 0.2, 0],
  drift = 0.14,
  parallax = 0.4,
}: CameraRigProps) {
  const q = useVisualQuality();
  const tx = target[0];
  const ty = target[1];
  const tz = target[2];
  const focus = useMemo(() => new Vector3(tx, ty, tz), [tx, ty, tz]);
  const goal = useMemo(() => new Vector3(), []);

  useFrame((state, dt) => {
    const cam = state.camera;
    if (q.reduced) {
      cam.position.set(base[0], base[1], base[2]);
      cam.lookAt(focus);
      return;
    }
    const t = state.clock.elapsedTime;
    goal.set(
      base[0] + Math.sin(t * 0.23) * drift + state.pointer.x * parallax,
      base[1] + Math.cos(t * 0.19) * drift * 0.7 + state.pointer.y * parallax * 0.55,
      base[2] + Math.sin(t * 0.13) * drift * 0.6,
    );
    // Frame-rate independent ease toward the moving goal.
    cam.position.lerp(goal, 1 - Math.exp(-dt * 2.4));
    cam.lookAt(focus);
  });

  return null;
}
