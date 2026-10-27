/**
 * TechBackdrop — step 8: a quiet starfield/nebula layer behind the tech tree.
 * No lights, no post stack, no interaction: the SVG tree stays the hero and
 * every node remains readable above it.
 */
import { useAccentBridge } from './store-adapters/accent';
import { SceneShell } from './three/core/SceneShell';

export default function TechBackdrop() {
  useAccentBridge();
  return (
    <div className="absolute inset-0" data-scene="tech-backdrop">
      <SceneShell
        className="h-full w-full"
        camera={[0, 1.4, 9]}
        cameraFov={50}
        controls="none"
        lights={false}
        env={{ floor: false, pulse: 0 }}
        effects={false}
        fallback={null}
      >
        <></>
      </SceneShell>
    </div>
  );
}
