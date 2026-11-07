/**
 * FlightView — lazy R3F entry for the interactive flight simulation.
 * Wraps FlightScene in SceneShell with the camera rig disabled (the scene
 * owns camera control via its mode system).
 */
import { useAccentBridge } from './store-adapters/accent';
import { SceneShell } from './three/core/SceneShell';
import { FlightScene, type CameraMode } from './three/scenes/FlightScene';

function NoWebGL() {
  return (
    <div className="grid h-full place-items-center text-xs text-white/70">
      <span>3D unavailable</span>
    </div>
  );
}

interface FlightViewProps {
  mode: CameraMode;
  setMode: (m: CameraMode) => void;
}

export default function FlightView({ mode, setMode }: FlightViewProps) {
  useAccentBridge();
  return (
    <div className="absolute inset-0" data-scene="flight">
      <SceneShell
        className="h-full w-full"
        camera={[0, 6431, -220]}
        cameraFov={46}
        controls="none"
        env={false}
        fallback={<NoWebGL />}
      >
        <FlightScene mode={mode} setMode={setMode} />
      </SceneShell>
    </div>
  );
}
