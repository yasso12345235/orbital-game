/** Screen 6 — Orbit Designer: live orbit, sliders, readouts. */
import { Suspense, lazy } from 'react';
import { useMission, lookupTables } from '../store';
import { useLang, useT } from '../hooks';
import { HudFrame, HudSlider, Kpi, LearnBox, PanelTag, RingGauge } from '../components/controls';
import { orbitReadout } from '@engine';

/** v3 step 6 — the live R3F orbit view (lazy; R3F stays out of the main chunk). */
const LazyOrbitDesignerView = lazy(() => import('../visual/OrbitDesignerView'));

export function OrbitScreen() {
  const t = useT();
  const lang = useLang();
  const missionId = useMission((s) => s.missionId);
  const altitudeOffset = useMission((s) => s.altitudeOffsetKm);
  const setAltitudeOffset = useMission((s) => s.setAltitudeOffset);
  const inclination = useMission((s) => s.inclinationDeg);
  const setInclination = useMission((s) => s.setInclination);
  const validate = useMission((s) => s.validate);
  const setScreen = useMission((s) => s.setScreen);
  const beginLaunch = useMission((s) => s.beginLaunch);
  const learnMode = useMission((s) => s.settings.learnMode);
  const sim = useMission((s) => s.sim);
  const launch = useMission((s) => s.launch);

  const mission = missionId ? lookupTables().missions[missionId] : null;
  const altitude = Math.max(0, (mission?.altitudeKm ?? 500) + altitudeOffset);
  const readout = orbitReadout(altitude);
  const canGo = !!validate?.go && !!sim === false && launch === null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr_300px] gap-4">
      <div className="flex flex-col gap-4">
        <HudFrame tag="TARGET ORBIT" tagAr="المدار الهدف">
          <div className="flex items-center gap-3">
            <PanelTag ar="كوكب" en={mission?.target.toUpperCase() ?? 'EARTH'} />
            <span className="ma-num text-[11px] text-[var(--ma-muted)]">{lang === 'ar' ? 'ضبط حر' : 'free tuning'}</span>
          </div>
          <div className="flex justify-center my-3">
            <RingGauge
              value={altitude} max={Math.max(2000, altitude * 1.4)} ar="الارتفاع" en="Altitude" unit="km"
              decimals={0}
            />
          </div>
          <HudSlider
            label="Altitude offset" labelAr="إزاحة الارتفاع" unit="km"
            value={altitudeOffset} min={-200} max={400} step={10}
            onChange={setAltitudeOffset}
            hint={lang === 'ar' ? 'يغيّر السرعة والدورة' : 'Changes velocity and period'}
          />
          <div className="mt-3">
            <HudSlider
              label="Inclination" labelAr="الميل المداري" unit="°"
              value={inclination} min={0} max={180} step={1}
              onChange={setInclination}
              hint={lang === 'ar' ? '97.4° = مدار شمسي متزامن' : '97.4° ≈ sun-synchronous'}
            />
          </div>
        </HudFrame>

        {learnMode && (
          <HudFrame tag="LEARN" tagAr="تعلّم">
            <LearnBox
              formula="v = √(μ / r)   T = 2π√(r³ / μ)"
              substitution={`r = 6371 + ${altitude.toFixed(0)} = ${readout.radiusKm.toFixed(0)} km, μ = 398600 km³/s²`}
              result={`v = ${readout.velocityKmS.toFixed(2)} km/s, T = ${readout.periodMin.toFixed(1)} min`}
              note={lang === 'ar'
                ? 'مدار أعلى = سرعة أقل ودورة أطول. هذا قانون كبلر الثالث.'
                : 'Higher orbit = slower speed, longer period — Kepler’s third law in action.'}
            />
          </HudFrame>
        )}
      </div>

      <HudFrame tag="LIVE ORBIT" tagAr="المدار الحي" className="min-h-[420px] flex flex-col">
        <div className="relative flex-1 rounded-xl overflow-hidden bg-[#03071a] min-h-[380px]">
          <Suspense
            fallback={
              <div className="grid h-full place-items-center text-xs text-[var(--ma-muted)]">Loading orbit…</div>
            }
          >
            <LazyOrbitDesignerView />
          </Suspense>
          <div className="absolute top-3 left-3"><PanelTag ar="مدار حي" en="LIVE ORBIT" /></div>
          <div className="absolute bottom-3 left-3 right-3 flex gap-4 flex-wrap text-[11px] ma-num text-[var(--ma-muted)]">
            <span>h = {altitude.toFixed(0)} km</span>
            <span>i = {inclination.toFixed(0)}°</span>
            <span>v = {readout.velocityKmS.toFixed(2)} km/s</span>
            <span>T = {readout.periodMin.toFixed(1)} min</span>
          </div>
        </div>
      </HudFrame>

      <div className="flex flex-col gap-4">
        <HudFrame tag="READOUTS" tagAr="القراءات">
          <div className="grid grid-cols-2 gap-3">
            <Kpi ar="الارتفاع" en="Altitude" value={altitude.toFixed(0)} unit="km" accent="var(--ma-accent)" />
            <Kpi ar="الميل" en="Inclination" value={inclination.toFixed(0)} unit="°" accent="var(--ma-warn)" />
            <Kpi ar="السرعة" en="Velocity" value={readout.velocityKmS.toFixed(2)} unit="km/s" accent="var(--ma-good)" />
            <Kpi ar="الدورة" en="Period" value={readout.periodMin.toFixed(1)} unit="min" />
          </div>
          <p className="text-[10px] text-[var(--ma-muted)] mt-3">
            {lang === 'ar'
              ? 'ملاحظة: تغيير المدار هنا يحاكي المناورة المدارية بعد الإطلاق؛ دلتا-في المطلوبة لا تتغير في هذه النسخة التعليمية.'
              : 'Note: tuning here simulates post-launch phasing; required dv stays fixed in this educational version.'}
          </p>
        </HudFrame>

        <HudFrame tag="FINAL CLEARANCE" tagAr="التصريح النهائي">
          <p className={`text-sm font-bold ${validate?.go ? 'text-[var(--ma-good)]' : 'text-[var(--ma-bad)]'}`}>
            {validate?.go
              ? (lang === 'ar' ? 'كل الأنظمة خضراء — اذهب للعد التنازلي.' : 'All systems green — proceed to terminal count.')
              : (lang === 'ar' ? 'التصميم غير جاهز بعد.' : 'Design not cleared yet.')}
          </p>
          <div className="flex gap-2 mt-3">
            <button type="button" className="flex-1 py-2 rounded-lg border border-[var(--ma-line)] text-xs uppercase hover:border-[var(--ma-accent)]" onClick={() => setScreen('launcher')}>
              ← {t('launcher')}
            </button>
            <button
              type="button"
              disabled={!canGo}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase ${canGo ? 'bg-[var(--ma-good)] text-[#04122a]' : 'bg-[var(--ma-line)] text-[var(--ma-muted)] cursor-not-allowed'}`}
              onClick={beginLaunch}
            >
              {t('launch')} 🚀
            </button>
          </div>
        </HudFrame>
      </div>
    </div>
  );
}
