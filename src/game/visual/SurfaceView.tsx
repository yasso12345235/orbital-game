/**
 * SurfaceView — lazy entry for the planetary expedition scene. Keeps three.js
 * out of the main bundle and only mounts when the Surface screen is open.
 */
import { useMemo } from 'react';
import { useMission } from '../store';
import { surfaceNodes } from '../surface/nodes';
import { surfaceProfileFor } from '../surface/model';
import { useAccentBridge } from './store-adapters/accent';
import { SceneShell } from './three/core/SceneShell';
import { SurfaceScene } from './three/scenes/SurfaceScene';
import type { SurfaceInput } from './three/scenes/SurfaceScene';
import type { SurfaceNode } from '../surface/engine';

function NoWebGL() {
  return (
    <div className="grid h-full place-items-center text-xs text-[var(--ma-muted)]">
      <span>
        3D unavailable ·{' '}
        <span className="font-ar" dir="rtl">
          الرسم ثلاثي الأبعاد غير متاح
        </span>
      </span>
    </div>
  );
}

export default function SurfaceView({
  input,
  onPose,
  onNear,
}: {
  input: { current: SurfaceInput };
  onPose: (x: number, z: number) => void;
  onNear: (node: SurfaceNode | null) => void;
}) {
  useAccentBridge();
  const surface = useMission((s) => s.surface);
  const target = surface?.target ?? 'earth';
  const seed = surface?.seed ?? 1;
  const profile = useMemo(() => surfaceProfileFor(target), [target]);
  const nodes = useMemo(() => surfaceNodes(seed, target), [seed, target]);

  if (!surface) return null;

  return (
    <div className="absolute inset-0" data-scene="planet-surface">
      <SceneShell
        className="h-full w-full"
        camera={[surface.x, 3.7, surface.z + 7.6]}
        cameraFov={58}
        lights={false}
        env={false}
        controls="none"
        fallback={<NoWebGL />}
      >
        <SurfaceScene
          surface={surface}
          profile={profile}
          nodes={nodes}
          input={input}
          onPose={onPose}
          onNear={onNear}
        />
      </SceneShell>
    </div>
  );
}
