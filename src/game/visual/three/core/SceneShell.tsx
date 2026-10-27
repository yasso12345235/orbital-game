/**
 * SceneShell — the v3 scene contract every screen builds on:
 * BaseCanvas (ACES + post + context-loss + DPR) + StageLights + Environment
 * + a CameraRig or OrbitControls, all quality/reduced-motion aware.
 *
 * Usage:
 *   <SceneShell camera={[0, 1.6, 9]} env={{ pulse: 0.5 }} overlay={hud}>
 *     <Planet target="mars" />
 *   </SceneShell>
 */
import { Suspense, type ReactNode } from 'react';
import { OrbitControls } from '@react-three/drei';
import { BaseCanvas } from '../BaseCanvas';
import { StageLights } from '../StageLights';
import { useVisualQuality } from '../quality';
import type { EffectsProps } from '../post/EffectsRig';
import { Environment, type EnvironmentProps } from './Environment';
import { CameraRig, type CameraRigProps } from './CameraRig';

export interface SceneShellProps {
  children: ReactNode;
  className?: string;
  /** Camera baseline (also the canvas initial position). */
  camera?: [number, number, number];
  cameraFov?: number;
  /** Shared lighting rig, or false when the scene brings its own lights. */
  lights?: 'stage' | false;
  /** Shared world backdrop, or false to skip it entirely. */
  env?: EnvironmentProps | false;
  /** Camera model: cinematic rig (default), drag-orbit, or none. */
  controls?: 'rig' | 'orbit' | 'none';
  rig?: Omit<CameraRigProps, 'base'>;
  orbitAutoRotate?: boolean;
  orbitMinDistance?: number;
  orbitMaxDistance?: number;
  /** Post-processing overrides; `false` disables the stack. */
  effects?: EffectsProps | boolean;
  /** 2D fallback when WebGL is unavailable. */
  fallback?: ReactNode;
  /** Pointer-event source for pointer-events-none hero layers (see BaseCanvas). */
  eventSource?: HTMLElement;
  /** HUD layer rendered above the canvas (absolute; give it pointer-events-none). */
  overlay?: ReactNode;
}

export function SceneShell({
  children,
  className = '',
  camera = [0, 1.2, 9.6],
  cameraFov = 42,
  lights = 'stage',
  env = {},
  controls = 'rig',
  rig,
  orbitAutoRotate = true,
  orbitMinDistance = 3,
  orbitMaxDistance = 26,
  effects = {},
  fallback = null,
  eventSource,
  overlay = null,
}: SceneShellProps) {
  const q = useVisualQuality();

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <BaseCanvas
        className="h-full w-full"
        cameraPosition={camera}
        cameraFov={cameraFov}
        effects={effects}
        fallback={fallback}
        eventSource={eventSource}
      >
        {lights === 'stage' && <StageLights />}
        {env !== false && <Environment {...env} />}
        <Suspense fallback={null}>
          {children}
          {controls === 'rig' && <CameraRig base={camera} {...rig} />}
          {controls === 'orbit' && (
            <OrbitControls
              enablePan={false}
              enableDamping
              autoRotate={orbitAutoRotate && !q.reduced}
              autoRotateSpeed={0.5}
              minDistance={orbitMinDistance}
              maxDistance={orbitMaxDistance}
            />
          )}
        </Suspense>
      </BaseCanvas>
      {overlay}
    </div>
  );
}
