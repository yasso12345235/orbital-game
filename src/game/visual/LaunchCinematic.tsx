/**
 * LaunchCinematic — lazy entry for the Simulation launch phase (step 7).
 * Wraps the R3F launch scene in the SceneShell contract with the camera rig
 * disabled (the scene owns the camera for the ascent) and a 2D fallback.
 */
import { useAccentBridge } from './store-adapters/accent';
import { SceneShell } from './three/core/SceneShell';
import { LaunchScene, type LaunchCallout } from './three/scenes/LaunchScene';

export interface LaunchCinematicProps {
  progress: number;
  launcherId: string;
  shake?: number;
  onCallout?: (c: LaunchCallout) => void;
}

function NoWebGL() {
  return (
    <div className="grid h-full place-items-center text-xs text-white/70">
      <span>
        3D unavailable ·{' '}
        <span className="font-ar" dir="rtl">
          الرسم ثلاثي الأبعاد غير متاح
        </span>
      </span>
    </div>
  );
}

export default function LaunchCinematic({ progress, launcherId, shake, onCallout }: LaunchCinematicProps) {
  useAccentBridge();
  return (
    <div className="absolute inset-0" data-scene="launch-cinematic">
      <SceneShell
        className="h-full w-full"
        camera={[8.6, 3.1, 10.8]}
        cameraFov={46}
        controls="none"
        env={false}
        fallback={<NoWebGL />}
      >
        <LaunchScene progress={progress} launcherId={launcherId} shake={shake} onCallout={onCallout} />
      </SceneShell>
    </div>
  );
}
