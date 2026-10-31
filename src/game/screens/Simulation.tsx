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

  const launchVelocityMps = Math.round(progress * 7850);
  const launchAltitudeKm = (progress * (mission?.altitudeKm ? Math.min(mission.altitudeKm, 180) : 160)).toFixed(1);
  const launchGs = (1 + progress * 2.8).toFixed(1);

  return (
    <div className={`relative min-h-[75vh] rounded-3xl overflow-hidden bg-[#050B1F] border border-[rgba(61,224,255,0.2)] shadow-[0_0_50px_rgba(0,0,0,0.8)] ${countdown <= 3 && countdown > 0 ? 'ma-launch-strobe' : ''}`}>
      <Suspense
        fallback={
          <div className="absolute inset-0 grid place-items-center text-[11px] uppercase tracking-widest text-white/50">
            Loading launch sequence…
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

      {/* Hologram scanline layer */}
      <div className="ma-hologram-scan" />

      {/* Flight Telemetry HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
        {/* Top Bar: Mission Info + Skip */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 bg-[rgba(5,10,24,0.75)] border border-[rgba(255,255,255,0.1)] px-4 py-2 rounded-xl backdrop-blur-md shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--ma-good)] animate-ping" />
            <div className="text-[11px] ma-num font-mono">
              <span className="text-[var(--ma-gold)] font-bold">{launcher?.name.toUpperCase()}</span>
              <span className="text-white/40 mx-2">/</span>
              <span className="text-[var(--ma-accent)]">{mission?.target.toUpperCase()} INSERTION</span>
            </div>
          </div>

          <div className="pointer-events-auto">
            <button type="button" className="ma-tap px-4 py-2 rounded-xl border border-[rgba(255,255,255,0.18)] bg-[rgba(10,18,36,0.8)] hover:bg-[rgba(233,195,124,0.15)] hover:border-[var(--ma-gold)] text-xs font-bold text-white uppercase tracking-wider backdrop-blur-md transition-all shadow-md" onClick={skipLaunch}>
              {lang === 'ar' ? 'تخطي التسلسل »' : 'Skip sequence »'}
            </button>
          </div>
        </div>

        {/* Live Flight Telemetry Stream (Left HUD) */}
        {countdown === 0 && (
          <div className="self-start bg-[rgba(5,11,26,0.85)] border border-[rgba(61,224,255,0.25)] p-4 rounded-2xl backdrop-blur-md shadow-2xl max-w-[260px] space-y-2.5 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="flex items-center justify-between text-[9px] font-mono text-[var(--ma-accent)] uppercase tracking-widest border-b border-white/10 pb-1">
              <span>{lang === 'ar' ? 'بيانات القياس عن بُعد' : 'FLIGHT TELEMETRY'}</span>
              <span className="animate-pulse">● REC</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] ma-num font-mono">
              <div>
                <span className="text-[9px] text-[var(--ma-muted)] block">{lang === 'ar' ? 'السرعة' : 'VELOCITY'}</span>
                <span className="text-base font-bold text-white">{launchVelocityMps} <small className="text-[9px] text-[var(--ma-muted)]">m/s</small></span>
              </div>
              <div>
                <span className="text-[9px] text-[var(--ma-muted)] block">{lang === 'ar' ? 'الارتفاع' : 'ALTITUDE'}</span>
                <span className="text-base font-bold text-[var(--ma-accent)]">{launchAltitudeKm} <small className="text-[9px] text-[var(--ma-muted)]">km</small></span>
              </div>
              <div>
                <span className="text-[9px] text-[var(--ma-muted)] block">{lang === 'ar' ? 'قوى الجاذبية' : 'ACCELERATION'}</span>
                <span className="text-base font-bold text-[var(--ma-gold)]">{launchGs} G</span>
              </div>
              <div>
                <span className="text-[9px] text-[var(--ma-muted)] block">{lang === 'ar' ? 'الضغط الديناميكي' : 'DYN PRESSURE'}</span>
                <span className="text-xs font-bold text-[var(--ma-good)]">{progress > 0.35 && progress < 0.65 ? 'MAX-Q' : 'NOMINAL'}</span>
              </div>
            </div>
            {/* Live Audio Carrier Waveform */}
            <div className="pt-1 border-t border-white/5">
              <div className="flex items-center justify-between text-[8px] font-mono text-[var(--ma-muted)] mb-1">
                <span>ACOUSTIC SPECTRUM</span>
                <span className="text-[var(--ma-good)]">CARRIER LOCK</span>
              </div>
              <svg viewBox="0 0 100 12" className="w-full h-3 stroke-[var(--ma-accent)] fill-none">
                <path d="M0,6 Q10,0 20,6 T40,6 T60,6 T80,6 T100,6" strokeWidth="1.5" className="ma-scope-wave" />
              </svg>
            </div>
          </div>
        )}

        {/* Center: Massive Countdown Clock */}
        <div className="text-center self-center my-auto">
          <div className={`ma-kpi-num ma-num font-black text-7xl md:text-8xl tracking-tight transition-all duration-300 ${countdown <= 3 && countdown > 0 ? 'text-[var(--ma-bad)] scale-110 drop-shadow-[0_0_40px_rgba(255,84,112,0.8)]' : 'text-white drop-shadow-[0_0_35px_rgba(255,255,255,0.7)]'}`}>
            {countdown > 0 ? `${t('tMinus')}${countdown}` : `T+${Math.round(progress * 26)}s`}
          </div>
          <div className="inline-block mt-3 px-4 py-1.5 rounded-full border border-white/20 bg-[rgba(5,10,24,0.75)] backdrop-blur-md shadow-xl">
            <span className="font-hud text-xs md:text-sm font-bold tracking-[0.25em] text-[var(--ma-gold)] uppercase" dir="ltr">
              {callout.text}
            </span>
          </div>
          {lang === 'ar' && callout.ar && (
            <div className="text-sm font-bold text-white/90 font-ar mt-1 drop-shadow-md">
              {callout.ar}
            </div>
          )}
        </div>

        {/* Bottom Bar: GO/NO-GO Checklist & Trajectory Info */}
        <div className="flex items-end justify-between gap-4">
          <div className="bg-[rgba(5,11,26,0.85)] border border-[rgba(255,255,255,0.12)] p-3.5 rounded-2xl backdrop-blur-md shadow-2xl min-w-[220px]">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[var(--ma-muted)] font-mono border-b border-white/10 pb-1.5 mb-2">
              <span>{t('goNogo')}</span>
              <span className="text-[var(--ma-good)] font-bold">ALL GO</span>
            </div>
            <ul className="space-y-1.5">
              {launch.goNoGo.map((g) => (
                <li key={g.name} className="flex items-center justify-between text-xs ma-num font-mono" dir="ltr">
                  <span className="text-white/80">{g.name}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${g.go ? 'bg-[rgba(47,224,90,0.15)] text-[var(--ma-good)] border border-[rgba(47,224,90,0.3)]' : 'bg-[rgba(255,84,112,0.15)] text-[var(--ma-bad)] border border-[rgba(255,84,112,0.3)]'}`}>
                    {g.go ? 'GO' : 'NO-GO'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-right text-white/90 text-xs ma-num font-mono bg-[rgba(5,11,26,0.85)] border border-[rgba(255,255,255,0.12)] px-4 py-2.5 rounded-2xl backdrop-blur-md shadow-2xl">
            <p className="font-bold text-[var(--ma-accent)]">{launcher?.name} → {mission?.target.toUpperCase()}</p>
            <p className="text-[10px] text-[var(--ma-muted)] mt-0.5">{lang === 'ar' ? 'T−10 ← إشعال المحركات ← المدار' : 'T−10 → ignition → orbital insertion'}</p>
          </div>
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
    <div className="flex flex-col gap-4">
      {/* Flight Operations Director Bar */}
      <div className="ma-flight-director-bar flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--ma-accent)] bg-[rgba(61,224,255,0.12)] text-base shadow-[0_0_15px_rgba(61,224,255,0.3)]">
            🛰️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="ma-epic-kicker text-[8px] tracking-[0.25em]">
                {lang === 'ar' ? 'مركز قيادة العمليات المدارية' : 'FLIGHT OPERATIONS DESK · ACTIVE MISSION'}
              </span>
              <span className="rounded-full bg-[rgba(47,224,90,0.15)] px-2 py-0.5 text-[9px] font-bold text-[var(--ma-good)] border border-[rgba(47,224,90,0.3)] animate-pulse">
                DSN CARRIER LOCKED
              </span>
            </div>
            <h2 className="font-hud text-base font-bold tracking-wider text-white">
              {lang === 'ar' ? mission.nameAr ?? mission.name : mission.name}
            </h2>
          </div>
        </div>

        {/* Live Radio Telemetry Carrier Waveform */}
        <div className="flex items-center gap-4 bg-[rgba(4,9,22,0.6)] px-3 py-1.5 rounded-xl border border-white/10 text-[10px] ma-num font-mono">
          <div className="text-right">
            <span className="text-[8px] text-[var(--ma-muted)] block">DSN X-BAND</span>
            <span className="text-[var(--ma-accent)] font-bold">8.425 GHz</span>
          </div>
          <svg viewBox="0 0 70 12" className="w-16 h-3 stroke-[var(--ma-accent)] fill-none">
            <path d="M0,6 Q8,0 17,6 T35,6 T52,6 T70,6" strokeWidth="1.5" className="ma-scope-wave" />
          </svg>
          <div className="text-left">
            <span className="text-[8px] text-[var(--ma-muted)] block">DATA LINK</span>
            <span className="text-[var(--ma-good)] font-bold">{link ? fmtRate(link.rateMbps) : 'STABLE'}</span>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 xl:grid-cols-[290px_1fr_290px] gap-4 ${isCritical ? 'ma-critical-flash' : ''}`}>
        {/* LEFT: power + event log */}
        <div className="flex flex-col gap-4">
          <HudFrame tag="POWER SUBSYSTEM" tagAr="نظام الطاقة" tone={powerTone}>
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
              <div className="min-w-0 flex-1 space-y-1.5 text-[12px] ma-num font-mono">
                <div className="flex justify-between gap-2"><span className="text-[var(--ma-muted)]">{t('generation')}</span><span className="font-bold text-white">{fmt(validate?.budget.generationW ?? 0)} W</span></div>
                <div className="flex justify-between gap-2"><span className="text-[var(--ma-muted)]">{t('load')}</span><span className="font-bold text-white">{fmt(validate?.budget.loadW ?? 0)} W{sim.safeMode ? ' ×0.6' : ''}</span></div>
                <div className="flex justify-between gap-2"><span className="text-[var(--ma-muted)]">{lang === 'ar' ? 'الهامش' : 'Margin'}</span><span className="font-bold" style={{ color: (validate?.budget.powerMarginW ?? 0) < 0 ? 'var(--ma-bad)' : 'var(--ma-good)' }}>{fmt(validate?.budget.powerMarginW ?? 0)} W</span></div>
              </div>
            </div>
            <div className="mt-3">
              <Sparkline data={series.battery} label={t('battery')} unit="%" min={0} max={100} tone={batteryPct <= 20 ? 'bad' : batteryPct <= 40 ? 'warn' : 'accent'} />
            </div>
            {sim.safeMode && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-[var(--ma-warn)] bg-[rgba(255,184,31,0.1)] p-2 rounded-lg border border-[rgba(255,184,31,0.2)]">
                <Icon name="warning" size={13} className="mt-[1px]" />
                <span>{t('safeMode')} — {lang === 'ar' ? 'وضع الأمان مفعّل: استهلاك علم أقل، خطر أقل.' : 'Safe mode: less science, reduced risk.'}</span>
              </p>
            )}
          </HudFrame>

          <HudFrame tag="MISSION EVENT LOG" tagAr="سجل وقائع المهمة" className="flex-1 min-h-[260px] flex flex-col">
            <div ref={logRef} className="flex-1 overflow-auto ma-scroll space-y-2 max-h-[320px] pr-1">
              {sim.eventLog.map((e, i) => <LogRow key={i} e={e} />)}
            </div>
          </HudFrame>
        </div>

        {/* CENTER: globe + clock */}
        <div className="flex flex-col gap-4 min-w-0">
          <HudFrame tag="ORBIT FLIGHT VIEW" tagAr="عرض المدار والملاحة" tight className="flex-1 flex flex-col ma-laser-glow" tone={isCritical ? 'bad' : undefined}>
            <div className="relative flex-1 min-h-[360px] rounded-2xl overflow-hidden bg-[#03071a] border border-[rgba(61,224,255,0.2)] shadow-[0_0_40px_rgba(0,0,0,0.7)]">
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
              <div className="ma-hologram-scan" />
              <div className="absolute top-3 start-3"><PanelTag ar="مدار نشط" en={mission.target.toUpperCase()} /></div>
              <OrbitRadar frac={timelineFrac} events={sim.eventLog} target={mission.target} label={t('orbitMap')} day={sim.elapsedDays} duration={sim.durationDays} />
              {isCritical && (
                <div className="absolute bottom-3 start-3 flex items-center gap-2 rounded-full border border-[var(--ma-bad)] bg-[rgba(20,4,10,0.85)] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--ma-bad)] backdrop-blur-md shadow-lg animate-pulse">
                  <Icon name="warning" size={13} />
                  {lang === 'ar' ? 'تحذير حرج — راجع السجل' : 'Critical alert — check log'}
                </div>
              )}
            </div>

            {/* Real telemetry strip (mono), all values bound to mission state. */}
            <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-[rgba(61,224,255,0.25)] bg-[rgba(4,9,24,0.75)] px-3.5 py-2.5 sm:grid-cols-3 lg:grid-cols-6 backdrop-blur-md shadow-lg" aria-label={t('telemetry')}>
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
