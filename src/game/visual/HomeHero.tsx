/**
 * HomeHero — lazy entry that gives the Home screen its living 3D backdrop on
 * the SceneShell contract (step 3). The hero layer is pointer-events-none, so
 * the camera rig reads pointer moves from the document instead of the canvas.
 */
import { useAccentBridge } from './store-adapters/accent';
import { SceneShell } from './three/core/SceneShell';
import { HomeScene } from './three/scenes/HomeScene';

export interface HomeHeroProps {
  /** Peek target driving the planet limb texture. */
  target?: string;
  className?: string;
}

export default function HomeHero({ target = 'earth', className = '' }: HomeHeroProps) {
  useAccentBridge();
  return (
    <div className={`pointer-events-none ${className}`} data-scene="home-hero" aria-hidden>
      <SceneShell
        className="h-full w-full"
        camera={[0, 6, 58]}
        cameraFov={42}
        env={{ floor: false, particles: true, nebula: true }}
        rig={{ drift: 0.6, parallax: 1.2, target: [0, 2.5, 0] }}
        effects={{ motion: 0.06 }}
        eventSource={typeof document === 'undefined' ? undefined : document.body}
      >
        <HomeScene target={target} />
      </SceneShell>
    </div>
  );
}
