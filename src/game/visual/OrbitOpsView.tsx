/**
 * OrbitOpsView — lazy entry for the Simulation centre panel (step 6).
 * Reads the live mission state (read-only) and hands the scene its target
 * planet + the real orbital inclination.
 */
import { useMemo } from 'react';
import { lookupTables, useMission } from '../store';
import { useAccentBridge } from './store-adapters/accent';
import { SceneShell } from './three/core/SceneShell';
import { OrbitOpsScene } from './three/scenes/OrbitOpsScene';

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

export default function OrbitOpsView() {
  useAccentBridge();
  const missionId = useMission((s) => s.missionId);
  const inclination = useMission((s) => s.inclinationDeg);
  const target = useMemo(
    () => (missionId ? lookupTables().missions[missionId]?.target ?? 'earth' : 'earth'),
    [missionId],
  );

  return (
    <div className="absolute inset-0" data-scene="orbit-ops">
      <SceneShell
        className="h-full w-full"
        camera={[0, 2.2, 7.4]}
        cameraFov={42}
        controls="orbit"
        orbitMinDistance={4}
        orbitMaxDistance={14}
        env={{ floor: false, particles: false, nebula: false }}
        rig={{ drift: 0.08, parallax: 0.35, target: [0, 0, 0] }}
        fallback={<NoWebGL />}
      >
        <OrbitOpsScene target={target} inclination={inclination} live />
      </SceneShell>
    </div>
  );
}
