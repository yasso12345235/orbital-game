/**
 * Style-guide mount for step 3 (Home scene + wormhole) — the live review
 * surface: the real HomeScene on SceneShell plus a button that replays the
 * wormhole transition exactly as leaving Home would. Lazy-loaded so R3F and
 * the tunnel shader stay out of the main bundle.
 */
import { Suspense, useState } from 'react';
import { useLang } from '../hooks';
import { MISSIONS, useMission } from '../store';
import { useAccentBridge } from './store-adapters/accent';
import { SceneShell } from './three/core/SceneShell';
import { HomeScene } from './three/scenes/HomeScene';
import WormholeOverlay from './WormholeOverlay';

export default function HomeSceneSection() {
  useAccentBridge();
  const lang = useLang();
  const missionId = useMission((s) => s.missionId);
  const target = MISSIONS.find((m) => m.id === missionId)?.target ?? 'earth';
  const [warp, setWarp] = useState(false);

  return (
    <div className="space-y-3" data-home-scene>
      <div className="ma-holo relative h-[380px] overflow-hidden rounded-2xl border border-[var(--ma-line)]">
        <SceneShell
          className="h-full w-full"
          camera={[0, 6, 58]}
          cameraFov={42}
          env={{ floor: false, particles: true, nebula: true }}
          rig={{ drift: 0.6, parallax: 1.2, target: [0, 2.5, 0] }}
          effects={{ motion: 0.06 }}
        >
          <HomeScene target={target} />
        </SceneShell>
        <div className="pointer-events-none absolute left-3 top-2 text-[10px] uppercase tracking-widest text-[var(--ma-muted)]">
          limb · starfield · flyby · meteors — target: <span className="ma-num">{target}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" className="ma-btn" onClick={() => setWarp(true)} data-wormhole-play>
          {lang === 'ar' ? 'تشغيل انتقال الثقب الدودي' : 'Replay wormhole transition'}
        </button>
        <span className="text-[10px] text-[var(--ma-muted)]">
          {lang === 'ar'
            ? 'يملأ الشاشة كلها — يعمل تلقائيًا عند مغادرة الرئيسية (ويُختصر إلى تلاشٍ بسيط مع تقليل الحركة).'
            : 'Plays over the whole viewport — auto-triggers when leaving Home (degrades to a simple fade under reduced motion).'}
        </span>
      </div>
      {warp && (
        <Suspense fallback={null}>
          <WormholeOverlay duration={1400} onDone={() => setWarp(false)} />
        </Suspense>
      )}
    </div>
  );
}
