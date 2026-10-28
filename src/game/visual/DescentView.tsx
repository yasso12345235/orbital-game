/**
 * DescentView — lazy entry for the powered-descent scene.
 */
import { useMemo } from 'react';
import { useMission } from '../store';
import { surfaceProfileFor } from '../surface/model';
import { useAccentBridge } from './store-adapters/accent';
import { SceneShell } from './three/core/SceneShell';
import { DescentScene } from './three/scenes/DescentScene';

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

export default function DescentView({
  thrust,
  settled,
  crashed,
}: {
  thrust: number;
  settled: boolean;
  crashed: boolean;
}) {
  useAccentBridge();
  const descent = useMission((s) => s.descent);
  const target = descent?.target ?? 'mars';
  const profile = useMemo(() => surfaceProfileFor(target), [target]);
  if (!descent) return null;

  return (
    <div className="absolute inset-0" data-scene="planet-descent">
      <SceneShell
        className="h-full w-full"
        camera={[7, 28, 24]}
        cameraFov={48}
        lights={false}
        env={false}
        controls="none"
        fallback={<NoWebGL />}
      >
        <DescentScene
          profile={profile}
          altitude={descent.phase === 'flying' ? descent.altitude : 0}
          x={descent.x}
          thrust={thrust}
          settled={settled}
          crashed={crashed}
        />
      </SceneShell>
    </div>
  );
}
