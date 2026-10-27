/**
 * BuilderPreview — lazy entry for the Builder screen's live 3D bay (step 5).
 * Fills its (relative) parent; drag-orbit inspection, auto-rotate that
 * respects reduced motion, holo-grid floor and a 2D text fallback.
 */
import { useAccentBridge } from './store-adapters/accent';
import { SceneShell } from './three/core/SceneShell';
import { BuilderScene } from './three/scenes/BuilderScene';

export default function BuilderPreview() {
  useAccentBridge();
  return (
    <div className="absolute inset-0" data-scene="builder-preview">
      <SceneShell
        className="h-full w-full"
        camera={[0, 1.5, 5.6]}
        cameraFov={40}
        controls="orbit"
        orbitMinDistance={3}
        orbitMaxDistance={9}
        env={{ floor: -1.55, particles: true, nebula: true, pulse: 0.3 }}
        effects={{}}
        fallback={
          <div className="grid h-full place-items-center text-xs text-[var(--ma-muted)]">
            <span>
              3D unavailable · <span className="font-ar" dir="rtl">الرسم ثلاثي الأبعاد غير متاح</span>
            </span>
          </div>
        }
      >
        <BuilderScene />
      </SceneShell>
    </div>
  );
}
