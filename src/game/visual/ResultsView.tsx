/**
 * ResultsView — step 8: the debrief's orbital replay. Reuses the live ops
 * scene (planet + mission-window ring + severity-tinted event nodes) paused on
 * the final day, because `endMission` leaves the sim in the store. Drag-orbit
 * inspection keeps it a debrief tool rather than a poster.
 */
import { useMemo } from 'react';
import { lookupTables, useMission } from '../store';
import { useAccentBridge } from './store-adapters/accent';
import { SceneShell } from './three/core/SceneShell';
import { OrbitOpsScene } from './three/scenes/OrbitOpsScene';
import { Nebula } from './three/shapes';

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

export default function ResultsView() {
  useAccentBridge();
  const missionId = useMission((s) => s.result?.missionId ?? s.missionId);
  const inclination = useMission((s) => s.inclinationDeg);
  const target = useMemo(
    () => (missionId ? lookupTables().missions[missionId]?.target ?? 'earth' : 'earth'),
    [missionId],
  );

  return (
    <div className="absolute inset-0" data-scene="results-replay">
      <SceneShell
        className="h-full w-full"
        camera={[0, 2.4, 8.6]}
        cameraFov={40}
        controls="orbit"
        orbitMinDistance={4.5}
        orbitMaxDistance={13}
        env={{ floor: false, particles: false, nebula: false }}
        fallback={<NoWebGL />}
      >
        <Nebula intensity={0.28} />
        <OrbitOpsScene target={target} inclination={inclination} live />
      </SceneShell>
    </div>
  );
}
