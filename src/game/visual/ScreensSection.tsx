/**
 * Style-guide mount for step 5 (Mission Select + Builder scenes) — the live
 * review surface: the mission globe with a target switcher, and the builder
 * preview driven by the real stored design. Lazy-loaded like every visual
 * chunk so R3F stays out of the main bundle.
 */
import { useState } from 'react';
import { useLang } from '../hooks';
import { useAccentBridge } from './store-adapters/accent';
import BuilderPreview from './BuilderPreview';
import MissionGlobe from './MissionGlobe';

const TARGETS = ['moon', 'venus', 'mars', 'jupiter'];

export default function ScreensSection() {
  useAccentBridge();
  const lang = useLang();
  const [target, setTarget] = useState('mars');

  return (
    <div className="space-y-3" data-screens-section>
      <div className="flex flex-wrap items-center gap-2">
        {TARGETS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTarget(t)}
            className={`px-3 py-1.5 rounded-lg border text-[11px] uppercase ${
              target === t
                ? 'border-[var(--ma-accent)] text-[var(--ma-accent)]'
                : 'border-[var(--ma-line)] text-[var(--ma-muted)]'
            }`}
          >
            {t}
          </button>
        ))}
        <span className="text-[10px] text-[var(--ma-muted)]">
          {lang === 'ar'
            ? 'بدّل الهدف — الكوكب يتبدّل في مكانه دون إعادة إنشاء الكانفس.'
            : 'Swap the target — the planet changes in place, no canvas remount.'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="ma-holo relative h-[300px] overflow-hidden rounded-2xl border border-[var(--ma-line)]">
          <MissionGlobe target={target} />
          <div className="pointer-events-none absolute left-3 top-2 text-[10px] uppercase tracking-widest text-[var(--ma-muted)]">
            mission globe · rings + dust · target: <span className="ma-num">{target}</span>
          </div>
        </div>
        <div className="ma-holo relative h-[300px] overflow-hidden rounded-2xl border border-[var(--ma-line)]">
          <BuilderPreview />
          <div className="pointer-events-none absolute left-3 top-2 text-[10px] uppercase tracking-widest text-[var(--ma-muted)]">
            {lang === 'ar'
              ? 'معاينة البناء · اسحب للتدوير · تتغذى من التصميم الفعلي'
              : 'builder preview · drag to orbit · fed by the live design'}
          </div>
        </div>
      </div>
    </div>
  );
}
