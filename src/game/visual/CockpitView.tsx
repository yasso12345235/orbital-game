/**
 * CockpitView — step 9: the Hangar's round cockpit window. A close-up of the
 * current mission target in the shared SceneShell (read-only), replacing the
 * legacy vanilla GlobeView so the `three` chunk stays fully lazy.
 */
import { useMemo } from 'react';
import { lookupTables, useMission } from '../store';
import { useAccentBridge } from './store-adapters/accent';
import { SceneShell } from './three/core/SceneShell';
import { ParticleField, Planet } from './three/shapes';

export default function CockpitView() {
  useAccentBridge();
  const missionId = useMission((s) => s.missionId);
  const target = useMemo(
    () => (missionId ? lookupTables().missions[missionId]?.target ?? 'earth' : 'earth'),
    [missionId],
  );

  return (
    <div className="absolute inset-0" data-scene="cockpit">
      <SceneShell
        className="h-full w-full"
        camera={[0, 0.5, 5.4]}
        cameraFov={44}
        controls="none"
        env={{ floor: false, particles: false, nebula: false }}
        fallback={<div className="h-full w-full bg-[#03071a]" />}
      >
        <group position={[0.35, -0.5, 0]}>
          <Planet target={target} radius={1.85} spin={0.55} cloud={1} atmosphere={1.5} />
        </group>
        <ParticleField count={320} spread={16} drift={0.2} size={0.5} />
      </SceneShell>
    </div>
  );
}
