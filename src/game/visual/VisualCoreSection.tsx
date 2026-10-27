/**
 * Style-guide mount for the v3 visual core — the live review surface.
 * Runs on SceneShell (Environment + CameraRig + graded post) and stays
 * lazy-loaded so R3F/drei/postprocessing never enter the initial bundle
 * (performance budget: initial JS < 400 KB gzip).
 */
import { useAccentBridge } from './store-adapters/accent';
import { SceneShell } from './three/core/SceneShell';
import { useVisualQuality } from './three/quality';
import { VisualCoreProbe } from './three/scenes/VisualCoreProbe';

export default function VisualCoreSection() {
  useAccentBridge();
  const q = useVisualQuality();

  return (
    <div className="ma-holo relative h-[380px] overflow-hidden rounded-2xl border border-[var(--ma-line)]">
      <SceneShell
        className="h-full w-full"
        camera={[0, 1.6, 9.5]}
        lights={false}
        env={{ pulse: 0.45, nebula: true, particles: true, floor: -2.2 }}
        rig={{ drift: 0.16, parallax: 0.5, target: [0, 0.3, 0] }}
        effects={{ motion: 0.1 }}
        overlay={
          <>
            <div className="pointer-events-none absolute left-3 top-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--ma-muted)]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: 'var(--ma-accent)', boxShadow: '0 0 10px var(--ma-accent)' }}
              />
              <span>
                uAccent ↔ --ma-accent · bloom · grade · vignette · tier: {q.tier}
                {q.reduced ? ' · reduced-motion' : ''}
              </span>
            </div>
            <div className="pointer-events-none absolute bottom-2 right-3 text-[10px] uppercase tracking-widest text-[var(--ma-muted)]">
              env: nebula + dust + grid · rig: drift {q.reduced ? 'off' : 'on'} · dpr ≤ {q.dprMax} · aa{' '}
              {q.antialias ? 'on' : 'off'}
            </div>
          </>
        }
      >
        <VisualCoreProbe quality={q} />
      </SceneShell>
    </div>
  );
}
