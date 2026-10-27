/**
 * Style-guide mount for step 7 — scrub the launch cinematic with a local
 * timeline. Progress only ever drives visuals; no mission state is touched.
 */
import { useEffect, useRef, useState } from 'react';
import { HudSlider } from '../components/controls';
import { useLang } from '../hooks';
import { useAccentBridge } from './store-adapters/accent';
import { SceneShell } from './three/core/SceneShell';
import { LaunchScene, type LaunchCallout } from './three/scenes/LaunchScene';

const CALLOUTS: { at: number; text: string; ar: string }[] = [
  { at: 0.02, text: 'TERMINAL COUNT', ar: 'العد التنازلي النهائي' },
  { at: 0.18, text: 'IGNITION', ar: 'الإشعال' },
  { at: 0.32, text: 'TOWER CLEAR', ar: 'تجاوز البرج' },
  { at: 0.58, text: 'MAX-Q', ar: 'أقصى ضغط ديناميكي' },
  { at: 0.74, text: 'STAGE SEPARATION', ar: 'فصل المرحلة' },
  { at: 0.9, text: 'ORBIT INSERTION', ar: 'الوصول للمدار' },
];

export default function LaunchSection() {
  useAccentBridge();
  const lang = useLang();
  const [p, setP] = useState(0.22);
  const [playing, setPlaying] = useState(false);
  const pRef = useRef(p);
  pRef.current = p;

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const t0 = performance.now();
    const start = pRef.current >= 0.999 ? 0 : pRef.current;
    const loop = (t: number) => {
      const next = Math.min(1, start + (t - t0) / 20000);
      setP(next);
      if (next >= 1) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const callout = CALLOUTS.filter((c) => p >= c.at).pop() ?? CALLOUTS[0];

  return (
    <div className="space-y-3" data-launch-section>
      <div className="ma-holo relative h-[340px] overflow-hidden rounded-2xl border border-[var(--ma-line)]">
        <div className="absolute inset-0">
          <SceneShell
            className="h-full w-full"
            camera={[8.6, 3.1, 10.8]}
            cameraFov={46}
            controls="none"
            env={false}
            fallback={
              <div className="grid h-full place-items-center text-xs text-white/70">3D unavailable</div>
            }
          >
            <LaunchScene progress={p} launcherId="electron" shake={playing ? 0.35 : 0} />
          </SceneShell>
        </div>
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 text-center">
          <div className="ma-hudtag" dir="ltr">{callout.text}</div>
          <div className="mt-1 text-[11px] text-white/80 font-ar" dir="rtl">
            {lang === 'ar' ? callout.ar : ''}
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between text-[10px] uppercase tracking-widest text-white/60">
          <span>electron · 300 kg LEO</span>
          <span className="ma-num">P {(p * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
        <HudSlider
          label="Timeline"
          labelAr="الخط الزمني"
          unit="%"
          value={Math.round(p * 100)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => {
            setPlaying(false);
            setP(v / 100);
          }}
          hint={lang === 'ar' ? 'اسحب يدوياً أو شغّل السينمائي' : 'Scrub manually or play the cinematic'}
        />
        <button
          type="button"
          className={`ma-chip ${playing ? '' : 'ma-chip-ghost'} mb-1`}
          onClick={() => {
            if (playing) {
              setPlaying(false);
              return;
            }
            if (pRef.current >= 0.999) setP(0);
            setPlaying(true);
          }}
          aria-pressed={playing}
        >
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
      </div>

      <p className="text-[10px] text-[var(--ma-muted)]">
        {lang === 'ar'
          ? 'نفس سينمائي المحاكاة: سقف الصاروخ مشتق من سعة الإطلاق الحقيقية، والتربة والمنصة تسقط بينما تبقى المركبة في الإطار؛ مكالمات الحدث بنفس عتبات النسخة السابقة. تقليل الحركة يعطّل الاهتزاز/الانجراف.'
          : 'The same scene the Simulation plays: stack height derives from the real launcher capacity, the pad and ground fall away while the vehicle stays framed, and callouts use the legacy thresholds. Reduced motion disables shake and idle drift.'}
      </p>
    </div>
  );
}
