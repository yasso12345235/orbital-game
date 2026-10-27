/** Screen 7 — Simulation: launch cinematic → operations (telemetry, events, timeline). */
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useMission, lookupTables, linkInfoFor } from '../store';
import { useLang, useT } from '../hooks';
import { Bi, HudFrame, Kpi, PanelTag, RadialGauge, Sparkline, fmt } from '../components/controls';
import { Icon } from '../components/Icon';
import { MissionActions } from '../components/MissionControl';
import { useLaunchProgress } from '../visual/useLaunchProgress';
import { sound } from '../audio';
import type { SimEventEntry } from '@engine';

/** v3 step 6 — the live ops orbit view (lazy; R3F stays out of the main chunk). */
const LazyOrbitOpsView = lazy(() => import('../visual/OrbitOpsView'));
/** v3 step 7 — the launch cinematic (lazy; owns its camera timeline). */
const LazyLaunchCinematic = lazy(() => import('../visual/LaunchCinematic'));

export function SimulationScreen() {
  const t = useT();
  const lang = useLang();
  const launch = useMission((s) => s.launch);
  if (!launch || launch.phase === 'ended') return <PreLaunchNote />;
  return launch.phase === 'launch' ? <LaunchPhase /> : <OpsPhase />;
}

function PreLaunchNote() {
  const lang = useLang();
  const setScreen = useMission((s) => s.setScreen);
  return (
    <div className="ma-panel p-8 text-center">
      <p className="text-sm text-[var(--ma-muted)]">{lang === 'ar' ? 'لا توجد محاكاة جارية.' : 'No simulation running.'}</p>
      <button type="button" className="ma-btn mt-4" onClick={() => setScreen('missionSelect')}>
        {lang === 'ar' ? 'اختر مهمة' : 'Pick a mission'}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phase 1 — launch cinematic                                          */
/* ------------------------------------------------------------------ */
function LaunchPhase() {
  const t = useT();
  const lang = useLang();
  const launch = useMission((s) => s.launch)!;
  const launcherId = useMission((s) => s.launcherId) ?? 'electron';
  const missionId = useMission((s) => s.missionId);
  const skipLaunch = useMission((s) => s.skipLaunch);
  const endMission = useMission((s) => s.endMission);
  const validate = useMission((s) => s.validate);
  const soundOn = useMission((s) => s.settings.sound);

  const [countdown, setCountdown] = useState(10);
  const [callout, setCallout] = useState({ text: 'TERMINAL COUNT', ar: 'العد التنازلي النهائي' });
  const [shaking, setShaking] = useState(false);
  const endedRef = useRef(false);

  const mission = missionId ? lookupTables().missions[missionId] : null;
  const launcher = lookupTables().launchers[launcherId];

  const progress = useLaunchProgress(countdown === 0, 26, () => {
    if (!endedRef.current) {
      endedRef.current = true;
      skipLaunch();
    }
  });

  // T-10 countdown with ticks
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => {
      setCountdown((c) => c - 1);
      if (soundOn) sound.play(countdown <= 3 ? 'alarm' : 'tick');
    }, 750);
    return () => clearTimeout(id);
  }, [countdown, soundOn]);

  // ignition rumble + shake
  useEffect(() => {
    if (countdown === 0) {
      setShaking(true);
      if (soundOn) sound.play('rumble');
      const id = setTimeout(() => setShaking(false), 4000);
      return () => clearTimeout(id);
    }
  }, [countdown, soundOn]);

  // launch failure → cut to results shortly after ignition
  useEffect(() => {
    if (launch.launchFailed && progress > 0.4 && !endedRef.current) {
      endedRef.current = true;
      setCallout({ text: 'ANOMALY — VEHICLE LOST', ar: 'خلل — فقدان المركبة' });
      if (soundOn) sound.play('failure');
      setTimeout(() => endMission(), 1600);
    }
  }, [launch.launchFailed, progress, endMission, soundOn]);

  const rumbleRef = useRef(0);
  useEffect(() => {
    if (!soundOn) return;
    const level = progress > 0.14 && progress < 0.7 ? 0.8 : progress >= 0.7 ? 0.3 : 0;
    if (level !== rumbleRef.current) {
      rumbleRef.current = level;
      if (level > 0) sound.startRumble();
      sound.setRumble(level);
      if (level === 0) sound.stopRumble();
    }
  }, [progress, soundOn]);

  return (
    <div className="relative min-h-[70vh] rounded-2xl overflow-hidden bg-[#050B1F]">
      <Suspense
        fallback={
          <div className="absolute inset-0 grid place-items-center text-[11px] uppercase tracking-widest text-white/50">
            Loading launch…
          </div>
        }
      >
        <LazyLaunchCinematic
          progress={progress}
          launcherId={launcherId}
          shake={shaking ? 0.6 * (1 - progress) : 0}
          onCallout={(c) => setCallout(c)}
        />
      </Suspense>
      {/* T-10 overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center">
          <div className="ma-kpi-num ma-num text-6xl" style={{ color: '#fff', textShadow: '0 0 30px rgba(255,255,255,0.6)' }}>
            {countdown > 0 ? `${t('tMinus')}${countdown}` : `T+${Math.round(progress * 26)}s`}
          </div>
          <div className="ma-hudtag mt-1" dir="ltr">{callout.text}</div>
          <div className="text-[11px] text-white/80 font-ar">{lang === 'ar' ? callout.ar : ''}</div>
        </div>

        {/* GO/NO-GO checklist */}
        <div className="absolute bottom-6 left-6 ma-panel p-3 max-w-[240px]">
          <p className="text-[10px] uppercase tracking-widest text-[var(--ma-muted)] mb-2">{t('goNogo')}</p>
          <ul className="space-y-1">
            {launch.goNoGo.map((g) => (
              <li key={g.name} className="flex items-center justify-between text-[11px] ma-num" dir="ltr">
                <span>{g.name}</span>
                <span style={{ color: g.go ? 'var(--ma-good)' : 'var(--ma-bad)' }}>{g.go ? 'GO' : 'NO-GO'}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="absolute bottom-6 right-6 text-right text-white/90 text-[11px] ma-num">
          <p>{launcher?.name} → {mission?.target.toUpperCase()}</p>
          <p>{lang === 'ar' ? 'T−10 ← الإطلاق ← المدار' : 'T−10 → liftoff → orbit'}</p>
        </div>

        <div className="absolute top-6 right-6 pointer-events-auto">
          <button type="button" className="ma-btn-ghost" onClick={skipLaunch}>
            {lang === 'ar' ? 'تخطي التسلسل »' : 'Skip sequence »'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phase 2 — operations                                                */
/* ------------------------------------------------------------------ */
function OpsPhase() {
  const t = useT();
  const lang = useLang();
  const sim = useMission((s) => s.sim);
  const tick = useMission((s) => s.tick);
  const missionId = useMission((s) => s.missionId);
  const design = useMission((s) => s.design);
  const validate = useMission((s) => s.validate);
  const endMission = useMission((s) => s.endMission);
  const learnMode = useMission((s) => s.settings.learnMode);
  const altitudeOffsetKm = useMission((s) => s.altitudeOffsetKm);
  const inclinationDeg = useMission((s) => s.inclinationDeg);
  const logRef = useRef<HTMLDivElement>(null);

  const mission = missionId ? lookupTables().missions[missionId] : null;
  const link = missionId ? linkInfoFor(missionId, design) : null;

  // Real telemetry history (battery/science/fuel/dv) sampled per simulated tick.
  const series = useTelemetrySeries(
    sim
      ? {
        battery: sim.batteryCapacityWh > 0 ? (sim.batteryChargeWh / sim.batteryCapacityWh) * 100 : 0,
        science: sim.dataReturnedGb,
        fuel: sim.propRemainingKg,
        dv: sim.dvRemainingMps,
      }
      : null,
    sim ? Math.round(sim.elapsedDays * 10) : -1,
  );

  // Simulation clock: 1 day per second at ×1
  useEffect(() => {
    const id = window.setInterval(() => {
      const st = useMission.getState();
      const scale = st.sim?.timeScale ?? 1;
      st.tick(0.1 * scale);
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  // auto-scroll event log
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [sim?.eventLog.length]);

  if (!sim || !mission) return <PreLaunchNote />;

  const batteryPct = sim.batteryCapacityWh > 0 ? (sim.batteryChargeWh / sim.batteryCapacityWh) * 100 : 0;
  const goalFrac = mission.scienceGoalGb > 0 ? Math.min(1, sim.dataReturnedGb / mission.scienceGoalGb) : 0;
  const timelineFrac = Math.min(1, sim.elapsedDays / sim.durationDays);
  const isCritical = sim.eventLog.slice(-3).some((e) => e.severity === 'critical') && !sim.safeMode;

  const dvFrac = validate && validate.budget.availableDvMps > 0 ? sim.dvRemainingMps / validate.budget.availableDvMps : 0;
  const altitudeKm = mission.altitudeKm + altitudeOffsetKm;
  const inclination = inclinationDeg || mission.inclinationDeg;
  const dvPct = Math.min(100, dvFrac * 100);
  const powerTone = batteryPct <= 20 ? 'bad' as const : batteryPct <= 40 ? 'warn' as const : undefined;
  const nf = new Intl.NumberFormat('en-US');
  const fmtRangeKm = (km: number) => km >= 1e6 ? `${(km / 1e6).toFixed(2)}M km` : `${nf.format(Math.round(km))} km`;
  const fmtDelayS = (s: number) => (s >= 1 ? `${s.toFixed(1)} s` : `${Math.max(1, Math.round(s * 1000))} ms`);
  const fmtRate = (mbps: number) => (mbps >= 1000 ? `${(mbps / 1000).toFixed(2)} Gbps` : mbps >= 1 ? `${mbps.toFixed(1)} Mbps` : `${Math.max(0, mbps * 1000).toFixed(0)} kbps`);

  return (
    <div className={`grid grid-cols-1 xl:grid-cols-[290px_1fr_290px] gap-4 ${isCritical ? 'ma-critical-flash' : ''}`}>
      {/* LEFT: power + event log */}
      <div className="flex flex-col gap-4">
        <HudFrame tag="POWER" tagAr="الطاقة" tone={powerTone}>
          <div className="flex items-center justify-between gap-2">
            <RadialGauge
              value={batteryPct}
              ar="البطارية"
              en="Battery"
              size={104}
              lowAt={20}
              warnAt={40}
              note={`${sim.batteryChargeWh.toFixed(0)} / ${sim.batteryCapacityWh.toFixed(0)} Wh`}
            />
            <div className="min-w-0 flex-1 space-y-1.5 text-[12px] ma-num">
              <div className="flex justify-between gap-2"><span className="text-[var(--ma-muted)]">{t('generation')}</span><span>{fmt(validate?.budget.generationW ?? 0)} W</span></div>
              <div className="flex justify-between gap-2"><span className="text-[var(--ma-muted)]">{t('load')}</span><span>{fmt(validate?.budget.loadW ?? 0)} W{sim.safeMode ? ' ×0.6' : ''}</span></div>
              <div className="flex justify-between gap-2"><span className="text-[var(--ma-muted)]">{lang === 'ar' ? 'الهامش' : 'Margin'}</span><span style={{ color: (validate?.budget.powerMarginW ?? 0) < 0 ? 'var(--ma-bad)' : 'var(--ma-good)' }}>{fmt(validate?.budget.powerMarginW ?? 0)} W</span></div>
            </div>
          </div>
          <div className="mt-3">
            <Sparkline data={series.battery} label={t('battery')} unit="%" min={0} max={100} tone={batteryPct <= 20 ? 'bad' : batteryPct <= 40 ? 'warn' : 'accent'} />
          </div>
          {sim.safeMode && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-[var(--ma-warn)]">
              <Icon name="warning" size={13} className="mt-[1px]" />
              <span>{t('safeMode')} — {lang === 'ar' ? 'علم أقل، خطر أقل.' : 'less science, less risk.'}</span>
            </p>
          )}
        </HudFrame>

        <HudFrame tag="EVENT LOG" tagAr="سجل الأحداث" className="flex-1 min-h-[260px] flex flex-col">
          <div ref={logRef} className="flex-1 overflow-auto ma-scroll space-y-1.5 max-h-[320px] pr-1">
            {sim.eventLog.map((e, i) => <LogRow key={i} e={e} />)}
          </div>
        </HudFrame>
      </div>

      {/* CENTER: globe + clock */}
      <div className="flex flex-col gap-4 min-w-0">
        <HudFrame tag="ORBIT VIEW" tagAr="عرض المدار" tight className="flex-1 flex flex-col" tone={isCritical ? 'bad' : undefined}>
          <div className="relative flex-1 min-h-[360px] rounded-xl overflow-hidden bg-[#03071a]">
            <Suspense
              fallback={
                <div className="ma-loading">
                  <span className="ma-loading-ring" aria-hidden />
                  <span>{lang === 'ar' ? 'جارٍ تحميل المدار' : 'Loading orbit'}</span>
                </div>
              }
            >
              <LazyOrbitOpsView />
            </Suspense>
            <div className="absolute top-3 start-3"><PanelTag ar="مدار حي" en={mission.target.toUpperCase()} /></div>
            <OrbitRadar frac={timelineFrac} events={sim.eventLog} target={mission.target} label={t('orbitMap')} day={sim.elapsedDays} duration={sim.durationDays} />
            {isCritical && (
              <div className="absolute bottom-3 start-3 flex items-center gap-2 rounded-full border border-[var(--ma-bad)] bg-[rgba(20,4,10,0.82)] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--ma-bad)] backdrop-blur-sm">
                <Icon name="warning" size={13} />
                {lang === 'ar' ? 'تحذير حرج — راجع السجل' : 'Critical alert — check log'}
              </div>
            )}
          </div>

          {/* Real telemetry strip (mono), all values bound to mission state. */}
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-[color-mix(in_srgb,var(--ma-line)_82%,transparent)] bg-[rgba(4,9,20,0.55)] px-3 py-2 sm:grid-cols-3 lg:grid-cols-6" aria-label={t('telemetry')}>
            <Telemetry label="ALT" ar="الارتفاع" value={`${fmt(altitudeKm)} km`} />
            <Telemetry label="INC" ar="الميل" value={`${inclination.toFixed(1)}°`} />
            <Telemetry label="RANGE" ar="المدى" value={link ? fmtRangeKm(link.distanceKm) : '—'} />
            <Telemetry label="DELAY" ar="التأخير" value={link ? fmtDelayS(link.lightDelayS) : '—'} />
            <Telemetry label="RATE" ar="المعدل" value={link ? fmtRate(link.rateMbps) : '—'} />
            <Telemetry label="DAY" ar="اليوم" value={`D${sim.elapsedDays.toFixed(1)} / ${sim.durationDays}`} />
          </div>
        </HudFrame>

        {/* Mission clock + timeline */}
        <HudFrame tag="MISSION CLOCK" tagAr="ساعة المهمة" tight>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="ma-kpi-num ma-num text-3xl">
                D{sim.elapsedDays.toFixed(1)}
                <span className="text-[0.5em] opacity-60 ml-2">/ {sim.durationDays}</span>
              </div>
              <p className="ma-kpi-label uppercase">{t('missionClock')}</p>
            </div>
            <div className="text-right">
              <div className="ma-kpi-num ma-num text-3xl" style={{ color: sim.timeScale === 1 ? 'var(--ma-accent)' : sim.timeScale === 10 ? 'var(--ma-warn)' : 'var(--ma-bad)' }}>
                ×{sim.timeScale}
              </div>
              <p className="ma-kpi-label uppercase">{t('timeWarp')}</p>
            </div>
          </div>
          {/* timeline */}
          <div className="relative mt-3 h-6">
            <div className="absolute inset-x-0 top-1/2 h-1 rounded bg-[#141E3C]" />
            <div className="absolute top-1/2 h-1 rounded" style={{ width: `${timelineFrac * 100}%`, background: 'linear-gradient(90deg, var(--ma-accent), var(--ma-good))', transition: 'width 0.3s linear' }} />
            {sim.eventLog.filter((e) => e.severity !== 'info').map((e, i) => {
              const f = Math.min(1, e.day / sim.durationDays);
              return (
                <button
                  key={i}
                  type="button"
                  className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                  style={{ left: `${f * 100}%`, background: e.severity === 'critical' ? 'var(--ma-bad)' : 'var(--ma-warn)', boxShadow: '0 0 8px currentColor' }}
                  title={`D${e.day.toFixed(1)} — ${e.message}`}
                  aria-label={`${t('timeline')} event day ${e.day.toFixed(1)}`}
                />
              );
            })}
            <span className="absolute right-0 -top-1 text-[9px] ma-num text-[var(--ma-muted)]">{sim.durationDays}d</span>
          </div>
        </HudFrame>
      </div>

      {/* RIGHT: data + link + dv */}
      <div className="flex flex-col gap-4">
        <HudFrame tag="SCIENCE" tagAr="العلم" tone={goalFrac >= 1 ? 'good' : undefined}>
          <div className="flex items-center justify-between gap-3">
            <RadialGauge
              value={goalFrac * 100}
              ar="العلم"
              en="Returned"
              size={104}
              tone="good"
              note={`${sim.dataReturnedGb.toFixed(1)} / ${mission.scienceGoalGb} Gb`}
            />
            <div className="min-w-0 flex-1 text-[11px] ma-num">
              <div className="flex justify-between gap-2"><span className="text-[var(--ma-muted)]">{t('stored')}</span><span>{sim.dataStoredGb.toFixed(1)} Gb</span></div>
              <div className="mt-1 flex justify-between gap-2"><span className="text-[var(--ma-muted)]">{t('dataReturned')}</span><span style={{ color: 'var(--ma-good)' }}>{sim.dataReturnedGb.toFixed(1)} Gb</span></div>
              <div className="mt-1 flex justify-between gap-2"><span className="text-[var(--ma-muted)]">{lang === 'ar' ? 'الهدف' : 'Goal'}</span><span>{goalFrac > 0 ? (goalFrac * 100).toFixed(0) : 0}%</span></div>
            </div>
          </div>
          <div className="mt-3">
            <Sparkline data={series.science} label={t('dataReturned')} unit="Gb" min={0} max={Math.max(mission.scienceGoalGb, 1)} tone="good" decimals={1} />
          </div>
        </HudFrame>

        <HudFrame tag="LINK" tagAr="الوصلة">
          <div className="grid grid-cols-1 gap-2 text-[12px] ma-num">
            <div className="flex justify-between"><span className="text-[var(--ma-muted)]">{lang === 'ar' ? 'المعدل' : 'Rate'}</span><span>{link ? fmtRate(link.rateMbps) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-[var(--ma-muted)]">{t('lightDelay')}</span><span>{link ? fmtDelayS(link.lightDelayS) : '—'}</span></div>
            <div className="flex justify-between"><span className="text-[var(--ma-muted)]">{lang === 'ar' ? 'المسافة' : 'Range'}</span><span>{link ? fmtRangeKm(link.distanceKm) : '—'}</span></div>
          </div>
        </HudFrame>

        <HudFrame tag="DELTA-V" tagAr="الدفع المتبقي" tone={dvPct <= 20 ? 'bad' : dvPct <= 40 ? 'warn' : undefined}>
          <div className="flex items-center justify-between gap-3">
            <RadialGauge
              value={dvPct}
              ar="الوقود"
              en="Δv remaining"
              size={104}
              lowAt={20}
              warnAt={40}
              note={`${sim.dvRemainingMps.toFixed(0)} m/s`}
            />
            <div className="min-w-0 flex-1 text-[11px] ma-num">
              <div className="flex justify-between gap-2"><span className="text-[var(--ma-muted)]">{t('fuel')}</span><span>{sim.propRemainingKg.toFixed(1)} kg</span></div>
              <div className="mt-1 flex justify-between gap-2"><span className="text-[var(--ma-muted)]">{lang === 'ar' ? 'المتاح' : 'Available'}</span><span>{validate ? `${fmt(validate.budget.availableDvMps)} m/s` : '—'}</span></div>
              <div className="mt-1 flex justify-between gap-2"><span className="text-[var(--ma-muted)]">{lang === 'ar' ? 'المطلوب' : 'Required'}</span><span>{mission.requiredDvMps} m/s</span></div>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-[var(--ma-muted)]">
            {lang === 'ar' ? 'أوامر FIRE تستهلك وقودًا وفق معادلة الصاروخ.' : 'FIRE commands burn propellant via the rocket equation.'}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Sparkline data={series.fuel} label={t('fuel')} unit="kg" tone={sim.propRemainingKg <= 0 ? 'bad' : 'warn'} decimals={1} />
            <Sparkline data={series.dv} label={t('dv')} unit="m/s" min={0} max={validate?.budget.availableDvMps ?? undefined} tone={dvPct <= 20 ? 'bad' : 'accent'} />
          </div>
        </HudFrame>

        {learnMode && <LearnOps simDays={sim.elapsedDays} />}

        <HudFrame tag="ACTIONS" tagAr="إجراءات" tight>
          <button
            type="button"
            className="ma-btn-ghost w-full"
            style={{ borderColor: 'color-mix(in srgb, var(--ma-warn) 65%, var(--ma-line))', color: 'var(--ma-warn)' }}
            onClick={() => endMission()}
          >
            {lang === 'ar' ? 'إنهاء المهمة الآن' : 'End mission now'}
          </button>
        </HudFrame>
      </div>

      {/* v3 control surface — mission commands live with the mission itself */}
      <div className="xl:col-span-3">
        <MissionActions />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ops helpers — real telemetry history, mini orbit radar, strip       */
/* ------------------------------------------------------------------ */
type TelemetrySnapshot = { battery: number; science: number; fuel: number; dv: number };
type TelemetrySeries = { battery: number[]; science: number[]; fuel: number[]; dv: number[] };

/** Keeps a short history sampled from the real simulation (per 0.1 day). */
function useTelemetrySeries(snapshot: TelemetrySnapshot | null, stamp: number): TelemetrySeries {
  const [series, setSeries] = useState<TelemetrySeries>({ battery: [], science: [], fuel: [], dv: [] });
  const snapRef = useRef(snapshot);
  const lastStamp = useRef(-1);
  snapRef.current = snapshot;
  useEffect(() => {
    const s = snapRef.current;
    if (!s || stamp === lastStamp.current) return;
    lastStamp.current = stamp;
    setSeries((prev) => ({
      battery: [...prev.battery, s.battery].slice(-48),
      science: [...prev.science, s.science].slice(-48),
      fuel: [...prev.fuel, s.fuel].slice(-48),
      dv: [...prev.dv, s.dv].slice(-48),
    }));
  }, [stamp]);
  return series;
}

function Telemetry({ label, ar, value }: { label: string; ar: string; value: string }) {
  const lang = useLang();
  return (
    <div className="flex items-baseline justify-between gap-2 text-[10px]">
      <span className="uppercase tracking-[0.14em] text-[var(--ma-muted)]" title={lang === 'ar' ? ar : label}>{label}</span>
      <span className="ma-num text-[var(--ma-text)]">{value}</span>
    </div>
  );
}

/**
 * Compact orbit mini-map: the spacecraft marker and the event ticks are placed
 * from real simulation progress (`day / duration`), not decorative motion.
 */
function OrbitRadar({ frac, events, target, label, day, duration }: { frac: number; events: SimEventEntry[]; target: string; label: string; day: number; duration: number }) {
  const lang = useLang();
  const f = Math.max(0, Math.min(1, frac));
  const angle = f * 360 - 90;
  const rad = (angle * Math.PI) / 180;
  const px = 50 + Math.cos(rad) * 34;
  const py = 50 + Math.sin(rad) * 34;
  const marks = events.filter((e) => e.severity !== 'info').slice(-12);
  return (
    <div
      className="absolute bottom-3 end-3 w-[122px] rounded-xl border border-[color-mix(in_srgb,var(--ma-accent)_26%,var(--ma-line))] bg-[rgba(4,9,20,0.74)] p-1.5 backdrop-blur-sm sm:w-[136px]"
      aria-label={`${label} — ${lang === 'ar' ? 'اليوم' : 'day'} ${day.toFixed(1)}`}
    >
      <svg viewBox="0 0 100 100" className="w-full" role="img" aria-hidden>
        <circle cx="50" cy="50" r="42" fill="none" stroke="color-mix(in srgb, var(--ma-accent) 22%, transparent)" strokeWidth="0.7" />
        <circle cx="50" cy="50" r="28" fill="none" stroke="color-mix(in srgb, var(--ma-accent) 14%, transparent)" strokeWidth="0.6" strokeDasharray="2 5" />
        <circle cx="50" cy="50" r="14" fill="none" stroke="color-mix(in srgb, var(--ma-accent) 10%, transparent)" strokeWidth="0.6" strokeDasharray="1 4" />
        <line x1="50" y1="8" x2="50" y2="92" stroke="color-mix(in srgb, var(--ma-accent) 9%, transparent)" strokeWidth="0.5" />
        <line x1="8" y1="50" x2="92" y2="50" stroke="color-mix(in srgb, var(--ma-accent) 9%, transparent)" strokeWidth="0.5" />
        <circle cx="50" cy="50" r="34" fill="none" stroke="var(--ma-accent)" strokeWidth="0.8" strokeDasharray="2 4" opacity="0.7" />
        {marks.map((e, i) => {
          const a = ((Math.min(1, e.day / Math.max(1, duration)) * 360) - 90) * (Math.PI / 180);
          const color = e.severity === 'critical' ? 'var(--ma-bad)' : 'var(--ma-warn)';
          return (
            <circle
              key={i}
              cx={50 + Math.cos(a) * 34}
              cy={50 + Math.sin(a) * 34}
              r="1.9"
              fill={color}
              opacity="0.9"
            />
          );
        })}
        <line x1="50" y1="50" x2={px} y2={py} stroke="var(--ma-accent)" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.75" />
        <g transform={`translate(${50 + Math.cos(rad) * 42} ${50 + Math.sin(rad) * 42})`}>
          <circle r="2.6" fill="none" stroke={target === 'earth' || target === 'leo' ? '#3DE0FF' : 'var(--ma-accent)'} strokeWidth="0.8" />
          <circle r="1" fill="var(--ma-text)" />
        </g>
        <circle cx={px} cy={py} r="2.6" fill="var(--ma-accent)" style={{ filter: 'drop-shadow(0 0 4px var(--ma-accent))' }} />
        <text x={px} y={py - 5} textAnchor="middle" fontSize="6" fill="var(--ma-ice)" opacity="0.9">
          {String(day.toFixed(1))}
        </text>
      </svg>
      <div className="flex items-center justify-between gap-1 text-[8px] uppercase tracking-[0.14em] text-[var(--ma-muted)]">
        <span>{label}</span>
        <span className="ma-num">{target.slice(0, 4).toUpperCase()}</span>
      </div>
    </div>
  );
}

function LogRow({ e }: { e: SimEventEntry }) {  const color = e.severity === 'critical' ? 'var(--ma-bad)' : e.severity === 'warn' ? 'var(--ma-warn)' : 'var(--ma-muted)';
  return (
    <div className="text-[11px] leading-snug flex gap-2">
      <span className="ma-num shrink-0" style={{ color }}>D{e.day.toFixed(1)}</span>
      <span className="text-[var(--ma-text)] opacity-90">{e.message}</span>
    </div>
  );
}

function LearnOps({ simDays }: { simDays: number }) {
  const lang = useLang();
  const t = useT();
  const sim = useMission((s) => s.sim);
  if (!sim) return null;
  const props = {
    ar: `بعد ${simDays.toFixed(0)} يومًا: البطارية ${sim.batteryChargeWh.toFixed(0)} Wh، الوقود ${sim.propRemainingKg.toFixed(1)} kg. كل يوم يستهلك طاقة ويتجمع علم.`,
    en: `Day ${simDays.toFixed(0)}: battery ${sim.batteryChargeWh.toFixed(0)} Wh, propellant ${sim.propRemainingKg.toFixed(1)} kg. Every day costs energy and banks science.`,
  };
  return (
    <HudFrame tag="LEARN" tagAr={t('learnTitle')}>
      <Bi ar={props.ar} en={props.en} stack />
      <p className="text-[10px] text-[var(--ma-muted)] mt-2">
        {lang === 'ar' ? 'P = A·η·flux·cos θ يحكم التوليد؛ الظل يفرض حجم البطارية.' : 'P = A·η·flux·cos θ drives generation; eclipse sets the battery size.'}
      </p>
    </HudFrame>
  );
}
