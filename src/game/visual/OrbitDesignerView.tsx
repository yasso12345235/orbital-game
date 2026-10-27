/**
 * OrbitDesignerView — lazy entry for the Orbit designer’s LIVE ORBIT panel
 * (step 6). Maps the tuned altitude onto the ring radius exactly like the
 * legacy view did (0.6…1.6 × at 800 km) and tilts the plane by the real
 * inclination slider value.
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

export default function OrbitDesignerView() {
  useAccentBridge();
  const missionId = useMission((s) => s.missionId);
  const offsetKm = useMission((s) => s.altitudeOffsetKm);
  const inclination = useMission((s) => s.inclinationDeg);

  const mission = useMemo(() => (missionId ? lookupTables().missions[missionId] ?? null : null), [missionId]);
  const altitude = Math.max(0, (mission?.altitudeKm ?? 500) + offsetKm);
  const ringScale = Math.max(0.6, Math.min(1.6, altitude / 800));

  return (
    <div className="absolute inset-0" data-scene="orbit-designer">
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
        <OrbitOpsScene target={mission?.target ?? 'earth'} inclination={inclination} ringScale={ringScale} />
      </SceneShell>
    </div>
  );
}
