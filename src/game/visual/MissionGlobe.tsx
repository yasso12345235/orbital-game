/**
 * MissionGlobe — lazy entry for the Mission Select holo panel (step 5).
 * Fills its (relative) parent; the 2D planet blob covers both the chunk
 * loading gap and the WebGL-unavailable fallback.
 */
import { useAccentBridge } from './store-adapters/accent';
import { SceneShell } from './three/core/SceneShell';
import { MissionSelectScene } from './three/scenes/MissionSelectScene';

/** CSS planet blob — fallback when WebGL is unavailable. */
export function PlanetBlob() {
  return (
    <div className="grid h-full w-full place-items-center" aria-hidden>
      <div
        className="h-24 w-24 rounded-full opacity-80"
        style={{
          background:
            'radial-gradient(circle at 35% 30%, var(--ma-accent), #0B1A3D 62%, #02050F 80%)',
          boxShadow: '0 0 50px color-mix(in srgb, var(--ma-accent) 35%, transparent)',
        }}
      />
    </div>
  );
}

export interface MissionGlobeProps {
  /** Selected mission target — swaps the planet in place. */
  target?: string;
}

export default function MissionGlobe({ target = 'earth' }: MissionGlobeProps) {
  useAccentBridge();
  return (
    <div className="absolute inset-0" data-scene="mission-globe">
      <SceneShell
        className="h-full w-full"
        camera={[0, 1.3, 5.9]}
        cameraFov={40}
        env={{ floor: false, particles: false, nebula: false }}
        rig={{ drift: 0.1, parallax: 0.45, target: [0, 0.05, 0] }}
        fallback={<PlanetBlob />}
      >
        <MissionSelectScene target={target} />
      </SceneShell>
    </div>
  );
}
