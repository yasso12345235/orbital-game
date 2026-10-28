/** Screen 8 — Results: score count-up, badges, failure timeline, improvement report, debrief. */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useMission, MISSIONS, lookupTables } from '../store';
import { useLang, useT } from '../hooks';
import { Bi, HudFrame, Kpi, PanelTag, fmt } from '../components/controls';
import { sound } from '../audio';
import { surfaceProfileFor } from '../surface/model';
import type { SimEventEntry } from '@engine';

/** v3 step 8 — orbital replay of the finished mission (lazy; R3F stays out of index). */
const LazyResultsView = lazy(() => import('../visual/ResultsView'));

export function ResultsScreen() {
  const t = useT();
  const lang = useLang();
  const result = useMission((s) => s.result);
  const validate = useMission((s) => s.validate);
  const design = useMission((s) => s.design);
  const newMission = useMission((s) => s.newMission);
  const setScreen = useMission((s) => s.setScreen);
  const selectMission = useMission((s) => s.selectMission);
  const surface = useMission((s) => s.surface);
  const descent = useMission((s) => s.descent);
  const startExpedition = useMission((s) => s.startExpedition);
  const endDay = useMission((s) => s.sim?.elapsedDays ?? 0);
  const [shown, setShown] = useState(0);

  // score count-up + jingle
  useEffect(() => {
    if (!result) return;
    let raf = 0;
    const t0 = performance.now();
    const dur = 1400;
    const loop = (now: number) => {
      const f = Math.min(1, (now - t0) / dur);
      setShown(result.score.total * (1 - Math.pow(1 - f, 3)));
      if (f < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [result]);

  if (!result) {
    return (
      <div className="ma-panel p-8 text-center">
        <p className="text-sm text-[var(--ma-muted)]">{lang === 'ar' ? 'لا نتائج بعد.' : 'No results yet.'}</p>
        <button type="button" className="mt-4 px-6 py-2 rounded-full bg-[var(--ma-accent)] text-[#04122a] text-xs font-bold uppercase" onClick={() => setScreen('missionSelect')}>
          {t('newMission')}
        </button>
      </div>
    );
  }

  const mission = MISSIONS.find((m) => m.id === result.missionId);
  const firstFailure = result.timeline.find((e) => e.severity === 'critical');

  return (
    <div className="ma-enter flex flex-col gap-4">
      {/* Verdict header + orbital replay */}
      <section className="ma-panel overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="text-center lg:text-left">
            <PanelTag ar={result.survived ? 'نجحت' : 'فشلت'} en={result.survived ? 'MISSION SUCCESS' : 'MISSION FAILED'} />
            <h2 className="ma-title text-4xl mt-3">{lang === 'ar' ? mission?.nameAr ?? mission?.name : mission?.name}</h2>
            <p className="text-[var(--ma-muted)] text-sm mt-1">
              {lang === 'ar' ? 'مستوى ' : 'Level '}{result.difficulty} · {t('duration')} {mission?.durationDays} {t('days')}
            </p>
            <div className="mt-5 flex items-center justify-center gap-8 lg:justify-start">
              <div className="text-center">
                <div className="ma-kpi-num ma-num text-6xl" style={{ color: result.survived ? 'var(--ma-good)' : 'var(--ma-bad)' }}>
                  {shown.toFixed(0)}
                </div>
                <p className="ma-kpi-label uppercase">{t('score')} / 100</p>
              </div>
              <div className="relative text-center">
                <div className="ma-shine inline-block rounded-xl px-3">
                  <div className="ma-kpi-num ma-num text-6xl" style={{ color: 'var(--ma-accent)' }}>{result.grade}</div>
                </div>
                <SparkBurst active={result.survived} />
                <p className="ma-kpi-label uppercase">{t('grade')}</p>
              </div>
            </div>
          </div>

          <div className="ma-holo relative h-[230px] overflow-hidden rounded-xl border border-[var(--ma-line)]">
            <Suspense
              fallback={
                <div className="grid h-full place-items-center text-[10px] uppercase tracking-widest text-[var(--ma-muted)]">
                  {lang === 'ar' ? 'جارٍ تحميل إعادة المدار…' : 'Loading orbit replay…'}
                </div>
              }
            >
              <LazyResultsView />
            </Suspense>
            <div className="pointer-events-none absolute inset-x-3 top-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-white/70">
              <span>{lang === 'ar' ? 'إعادة المدار' : 'Orbit replay'}</span>
              <span className="ma-num">D{endDay.toFixed(1)}</span>
            </div>
            <div className="pointer-events-none absolute inset-x-3 bottom-2 flex flex-wrap items-center gap-3 text-[10px] text-white/60">
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--ma-warn)', boxShadow: '0 0 8px var(--ma-warn)' }} />
                {lang === 'ar' ? 'تحذير' : 'warning'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--ma-bad)', boxShadow: '0 0 8px var(--ma-bad)' }} />
                {lang === 'ar' ? 'حرج' : 'critical'}
              </span>
              <span className="opacity-70">{lang === 'ar' ? 'اسحب للتدوير' : 'drag to orbit'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t('science')} value={result.score.science.toFixed(1)} max={40} detail={`${result.scienceReturnedGb.toFixed(1)} / ${result.scienceGoalGb} Gb`} />
        <KpiCard label={t('budget')} value={result.score.budget.toFixed(1)} max={25} detail={`${fmt(result.costTotal)} / ${fmt(result.budgetCap)}`} />
        <KpiCard label={t('safety')} value={result.score.safety.toFixed(1)} max={25} detail={`R ${Math.round((validate?.budget.reliability ?? 0) * 100)}%`} />
        <KpiCard label={t('innovation')} value={result.score.innovation.toFixed(1)} max={10} detail={result.survived ? 'nominal' : 'reduced'} />
      </section>

      {/* Next phase — leave orbit and land on the chosen world. */}
      <section className="ma-panel ma-expedition p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <PanelTag ar="المرحلة التالية" en="NEXT PHASE · SURFACE" />
            <h3 className="ma-title mt-2 text-xl">
              {surface && surface.status === 'active'
                ? (lang === 'ar' ? 'بعثة سطحية جارية' : 'Surface expedition in progress')
                : (lang === 'ar' ? 'اهبط وتَعش على السطح' : 'Land and survive on the surface')}
            </h3>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--ma-muted)]">
              {(() => {
                const p = surfaceProfileFor(mission?.target);
                return lang === 'ar'
                  ? `${p.nameAr} · جذب ${p.gravity.toFixed(2)} م/ث² · ${p.hazardAr}`
                  : `${p.nameEn} · gravity ${p.gravity.toFixed(2)} m/s² · ${p.hazardEn}`;
              })()}
            </p>
            {surface && (
              <p className="mt-2 text-[11px] text-[var(--ma-gold)]">
                {lang === 'ar'
                  ? `${surface.callsign} · ${surface.modules.length} وحدة · ${surface.gathered} عيّنة`
                  : `${surface.callsign} · ${surface.modules.length} modules · ${surface.gathered} samples`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {descent?.phase === 'flying' ? (
              <button
                type="button"
                className="ma-cta-gold ma-tap rounded-full px-7 py-3 text-xs font-bold uppercase tracking-widest"
                onClick={() => setScreen('descent')}
              >
                {lang === 'ar' ? 'متابعة الهبوط' : 'RESUME DESCENT'}
              </button>
            ) : surface && surface.status === 'active' ? (
              <>
                <button
                  type="button"
                  className="ma-cta-gold ma-tap rounded-full px-7 py-3 text-xs font-bold uppercase tracking-widest"
                  onClick={() => setScreen('surface')}
                >
                  {lang === 'ar' ? 'متابعة عمليات السطح' : 'RESUME SURFACE OPS'}
                </button>
                <button
                  type="button"
                  className="ma-tap rounded-full border border-[var(--ma-line)] px-5 py-3 text-xs uppercase tracking-widest"
                  onClick={startExpedition}
                >
                  {lang === 'ar' ? 'هبوط جديد' : 'NEW DESCENT'}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="ma-cta-gold ma-tap rounded-full px-7 py-3 text-xs font-bold uppercase tracking-widest"
                onClick={startExpedition}
              >
                {lang === 'ar' ? 'ابدأ بعثة السطح' : 'BEGIN SURFACE EXPEDITION'}
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Failure / debrief */}
        <HudFrame tag="DEBRIEF" tagAr="التقرير">
          {firstFailure ? (
            <>
              <p className="text-[var(--ma-bad)] font-bold text-sm">✕ {t('firstFailure')} — D{firstFailure.day.toFixed(1)}</p>
              <p className="text-[13px] mt-2">{firstFailure.message}</p>
              <DebriefFix failure={firstFailure} />
            </>
          ) : (
            <p className="text-[var(--ma-good)] font-bold text-sm">✔ {t('noFailure')}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {result.badges.map((b) => (
              <span key={b} className="badge-px anim-pop" style={{ animationDelay: `${0.3 + result.badges.indexOf(b) * 0.15}s` }}>{b}</span>
            ))}
          </div>
        </HudFrame>

        {/* Timeline */}
        <HudFrame tag="TIMELINE" tagAr="الخط الزمني">
          <div className="max-h-[240px] overflow-auto ma-scroll space-y-1 pr-1">
            {result.timeline.map((e, i) => (
              <div key={i} className="flex gap-2 text-[11px]">
                <span className="ma-num shrink-0" style={{ color: e.severity === 'critical' ? 'var(--ma-bad)' : e.severity === 'warn' ? 'var(--ma-warn)' : 'var(--ma-muted)' }}>
                  D{e.day.toFixed(1)}
                </span>
                <span className="opacity-90">{e.message}</span>
              </div>
            ))}
          </div>
        </HudFrame>
      </div>

      {/* Improvement report */}
      <HudFrame tag="IMPROVEMENT REPORT" tagAr={t('improve')}>
        <ul className="space-y-2">
          {(validate?.checks ?? []).filter((c) => c.severity !== 'ok').map((c) => (
            <li key={c.id} className="text-[12px] flex gap-2">
              <span style={{ color: c.severity === 'fail' ? 'var(--ma-bad)' : 'var(--ma-warn)' }}>{c.severity === 'fail' ? '✕' : '!'}</span>
              <span>{c.message}</span>
            </li>
          ))}
          {result.timeline.some((e) => e.kind === 'storage') && (
            <li className="text-[12px]">⚠ {lang === 'ar' ? 'فقدت علمًا بسبب امتلاء الذاكرة — أضف COM أكثر أو حمولة أكبر.' : 'Science was lost to full storage — add COM downlinks or bigger payload memory.'}</li>
          )}
          <li className="text-[12px] text-[var(--ma-muted)]">
            {lang === 'ar'
              ? 'قاعدة عامة: هامش الكتلة 10٪ وهامش دلتا-في 200 م/ث يبقيان المهمة آمنة.'
              : 'Rule of thumb: 10% mass margin and 200 m/s dv margin keep a mission safe.'}
          </li>
        </ul>
      </HudFrame>

      <div className="flex flex-wrap gap-3 justify-center">
        <button type="button" className="ma-tap ma-cta-gold px-8 py-3 rounded-full font-bold text-xs uppercase tracking-widest" onClick={newMission}>
          {t('newMission')}
        </button>
        <button
          type="button"
          className="ma-tap px-6 py-3 rounded-full border border-[rgba(233,195,124,0.55)] text-[var(--ma-gold-hi)] text-xs uppercase tracking-widest"
          onClick={() => {
            if (result.missionId) {
              selectMission(result.missionId);
              setScreen('builder');
            }
          }}
        >
          {t('retry')}
        </button>
        <button type="button" className="ma-tap px-6 py-3 rounded-full border border-[var(--ma-line)] text-xs uppercase tracking-widest" onClick={() => setScreen('hangar')}>
          {t('toHangar')}
        </button>
      </div>
    </div>
  );
}

function KpiCard({ label, value, max, detail }: { label: string; value: string; max: number; detail: string }) {
  const frac = Math.min(1, Number(value) / max);
  return (
    <div className="ma-panel p-4">
      <p className="ma-kpi-label uppercase">{label}</p>
      <p className="ma-kpi-num ma-num text-3xl">
        {value}
        <span className="text-[0.4em] opacity-60 ml-1">/ {max}</span>
      </p>
      <div className="h-1.5 rounded bg-[#141E3C] mt-2 overflow-hidden">
        <div className="h-full" style={{ width: `${frac * 100}%`, background: 'var(--ma-accent)', transition: 'width 1.1s ease-out' }} />
      </div>
      <p className="ma-num text-[10px] text-[var(--ma-muted)] mt-1">{detail}</p>
    </div>
  );
}

/** Debrief fix suggestion with numbers, derived from the failure kind. */
function DebriefFix({ failure }: { failure: SimEventEntry }) {
  const lang = useLang();
  const tables = lookupTables();
  void tables;
  const fixes: Record<string, { en: string; ar: string }> = {
    power_loss: {
      en: 'Physics cause: battery empty because load exceeded solar generation. Fix: add solar area (each extra m² at this target adds A·η·flux W) or cut payload power draw, then re-check the battery vs eclipse sizing.',
      ar: 'السبب: فرغت البطارية لأن الحمل تجاوز التوليد الشمسي. الحل: أضف مساحة ألواح (كل متر مربع يضيف A·η·flux واط) أو قلل استهلاك الحمولة ثم أعد فحص البطارية مقابل الظل.',
    },
    debris: {
      en: 'Physics cause: debris strike with no propellant for an avoidance burn. Fix: carry more propellant (each 10 kg ≈ dv per the rocket equation) or add margin to the tank capacity.',
      ar: 'السبب: اصطدام حطام دون وقود لمناورة تفادٍ. الحل: احمل وقودًا أكثر (كل 10 كغ ≈ دلتا-في حسب معادلة الصاروخ) أو كبّر الخزان.',
    },
  };
  const f = fixes[failure.kind] ?? {
    en: 'Review the subsystem tied to this event, re-run ANALYSE, and confirm all checks are green before launch.',
    ar: 'راجع النظام المرتبط بهذا الحدث، أعد التحليل، وتأكد أن كل الفحوصات خضراء قبل الإطلاق.',
  };
  return <p className="text-[12px] mt-3 p-3 rounded-lg border border-[var(--ma-line)] text-[var(--ma-muted)]">{lang === 'ar' ? f.ar : f.en}</p>;
}

/** Little celebration burst behind the grade (pure CSS particles — no extra deps). */
function SparkBurst({ active }: { active: boolean }) {
  const sparks = useMemo(
    () => Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      const d = 46 + (i % 3) * 22;
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d - 10, delay: 0.5 + (i % 4) * 0.18 };
    }),
    [],
  );
  if (!active) return null;
  return (
    <span className="absolute inset-0 pointer-events-none" aria-hidden>
      {sparks.map((s, i) => (
        <span
          key={i}
          className="ma-spark"
          style={{ ['--dx' as string]: `${s.dx.toFixed(0)}px`, ['--dy' as string]: `${s.dy.toFixed(0)}px`, animationDelay: `${s.delay}s` }}
        />
      ))}
    </span>
  );
}
