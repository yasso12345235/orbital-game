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

  // Lateral steering: -1.0 (left) to +1.0 (right)
  const [steerX, setSteerX] = useState(0);
  const [flightCoins, setFlightCoins] = useState(0);
  const [coinPopups, setCoinPopups] = useState<{ id: number; amount: number; text: string }[]>([]);
  const lastStepRef = useRef(-1);

  // Dynamic guidance corridor toward target planet
  const targetPathX = countdown === 0 ? Math.sin(progress * Math.PI * 2.8) * 0.45 : 0;
  const steerDelta = Math.abs(steerX - targetPathX);
  const isAligned = steerDelta < 0.28;
  const accuracyPct = Math.max(0, Math.min(100, Math.round((1 - steerDelta / 0.6) * 100)));
  const currentStep = Math.floor(progress * 15);

  // Target celestial body details
  const targetProfiles: Record<string, { ar: string; en: string; icon: string; dist: string }> = {
    moon: { ar: 'القمر (Moon)', en: 'The Moon', icon: '🌕', dist: '384,400 km' },
    mars: { ar: 'المريخ (Mars)', en: 'Mars', icon: '🔴', dist: '225,000,000 km' },
    leo: { ar: 'مدار الأرض المنخفض (LEO)', en: 'Low Earth Orbit', icon: '🌍', dist: '400 km' },
    geo: { ar: 'المدار الجغرافي الثابت (GEO)', en: 'Geostationary Orbit', icon: '🛰️', dist: '35,786 km' },
    venus: { ar: 'الزهرة (Venus)', en: 'Venus', icon: '🟡', dist: '41,000,000 km' },
    jupiter: { ar: 'المشتري (Jupiter)', en: 'Jupiter', icon: '🪐', dist: '628,000,000 km' },
  };
  const targetInfo = (mission?.target && targetProfiles[mission.target]) || {
    ar: mission?.target ? `${mission.target.toUpperCase()} (كوكب الوجهة)` : 'مدار الوجهة',
    en: mission?.target ? mission.target.toUpperCase() : 'Target Orbit',
    icon: '🪐',
    dist: `${mission?.altitudeKm ?? 400} km`,
  };

  // Keyboard steering controls (ArrowLeft/Right, A/D, S/Space)
  useEffect(() => {
    if (countdown > 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        setSteerX((x) => Math.max(-1, +(x - 0.14).toFixed(2)));
        if (soundOn) sound.play('tick');
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        setSteerX((x) => Math.min(1, +(x + 0.14).toFixed(2)));
        if (soundOn) sound.play('tick');
      } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's' || e.code === 'Space') {
        setSteerX(0);
        if (soundOn) sound.play('tick');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [countdown, soundOn]);

  // Step-based coin reward system: reward player whenever rocket stays inside trajectory corridor
  useEffect(() => {
    if (countdown > 0) return;
    if (progress >= 0.08 && progress < 0.95 && currentStep > lastStepRef.current) {
      lastStepRef.current = currentStep;
      if (isAligned) {
        const reward = steerDelta < 0.14 ? 100 : 50;
        setFlightCoins((c) => c + reward);
        useMission.setState((s) => ({
          progress: {
            ...s.progress,
            credits: s.progress.credits + reward,
          },
        }));
        if (soundOn) sound.play('confirm');
        const popupId = Date.now();
        const popupText =
          steerDelta < 0.14
            ? lang === 'ar'
              ? `+100 🪙 مسار مثالي! (خطوة ${currentStep}/15)`
              : `+100 🪙 Perfect Trajectory! (Step ${currentStep}/15)`
            : lang === 'ar'
              ? `+50 🪙 مسار صحيح! (خطوة ${currentStep}/15)`
              : `+50 🪙 On Trajectory! (Step ${currentStep}/15)`;
        setCoinPopups((prev) => [...prev, { id: popupId, amount: reward, text: popupText }]);
        setTimeout(() => {
          setCoinPopups((prev) => prev.filter((p) => p.id !== popupId));
        }, 1500);
      }
    } else if (progress >= 0.95 && lastStepRef.current < 99) {
      lastStepRef.current = 99;
      const finalBonus = 250;
      setFlightCoins((c) => c + finalBonus);
      useMission.setState((s) => ({
        progress: {
          ...s.progress,
          credits: s.progress.credits + finalBonus,
        },
      }));
      if (soundOn) sound.play('success');
      setCoinPopups((prev) => [
        ...prev,
        {
          id: Date.now(),
          amount: finalBonus,
          text: lang === 'ar' ? `+250 🏆 وصول ناجح لمدار ${targetInfo.ar}!` : `+250 🏆 Orbital Insertion!`,
        },
      ]);
    }
  }, [progress, countdown, currentStep, isAligned, steerDelta, soundOn, lang, targetInfo.ar]);

  const launchVelocityMps = Math.round(progress * 7850);
  const launchAltitudeKm = (progress * (mission?.altitudeKm ? Math.min(mission.altitudeKm, 180) : 160)).toFixed(1);
  const launchGs = (1 + progress * 2.8).toFixed(1);

  return (
    <div className={`relative min-h-[78vh] rounded-3xl overflow-hidden bg-[#050B1F] border border-[rgba(61,224,255,0.25)] shadow-[0_0_50px_rgba(0,0,0,0.8)] ${countdown <= 3 && countdown > 0 ? 'ma-launch-strobe' : ''}`}>
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
          steerX={steerX}
          onCallout={(c) => setCallout(c)}
        />
      </Suspense>

      {/* Hologram scanline layer */}
      <div className="ma-hologram-scan" />

      {/* Flight Telemetry HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none p-5 md:p-6 flex flex-col justify-between">
        {/* Top Bar: Mission Info + Floating Coins Count + Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 bg-[rgba(5,10,24,0.85)] border border-[rgba(255,255,255,0.12)] px-4 py-2 rounded-xl backdrop-blur-md shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--ma-good)] animate-ping" />
            <div className="text-[11px] ma-num font-mono">
              <span className="text-[var(--ma-gold)] font-bold">{launcher?.name.toUpperCase()}</span>
              <span className="text-white/40 mx-2">/</span>
              <span className="text-[var(--ma-accent)]">{mission?.target.toUpperCase()} INSERTION</span>
            </div>
          </div>

          {/* Real-time Accumulated Coins Badge */}
          <div className="flex items-center gap-2 bg-[rgba(233,195,124,0.15)] border border-[var(--ma-gold)] px-4 py-2 rounded-xl backdrop-blur-md shadow-[0_0_15px_rgba(233,195,124,0.25)]">
            <span className="text-base animate-bounce">🪙</span>
            <div className="text-xs font-mono font-bold text-white">
              <span className="text-[var(--ma-gold)]">+{flightCoins}</span> <span className="text-white/60">CR</span>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {countdown > 0 && (
              <button
                type="button"
                className="ma-tap px-4 py-2 rounded-xl border border-[var(--ma-good)] bg-[rgba(47,224,90,0.25)] hover:bg-[rgba(47,224,90,0.4)] text-xs font-bold text-white uppercase tracking-wider backdrop-blur-md transition-all shadow-[0_0_15px_rgba(47,224,90,0.4)] animate-pulse"
                onClick={() => {
                  setCountdown(0);
                  sound.play('confirm');
                }}
              >
                🚀 {lang === 'ar' ? 'انطلاق فوري' : 'Instant Liftoff'}
              </button>
            )}
            <button
              type="button"
              className="ma-tap px-4 py-2 rounded-xl border border-[rgba(255,255,255,0.18)] bg-[rgba(10,18,36,0.8)] hover:bg-[rgba(233,195,124,0.15)] hover:border-[var(--ma-gold)] text-xs font-bold text-white uppercase tracking-wider backdrop-blur-md transition-all shadow-md"
              onClick={skipLaunch}
            >
              {lang === 'ar' ? 'تخطي التسلسل »' : 'Skip sequence »'}
            </button>
          </div>
        </div>

        {/* Trajectory Guidance Highway to Destination Planet (Active when airborne) */}
        {countdown === 0 && (
          <div className="self-center my-1 pointer-events-auto flex flex-col items-center gap-2 max-w-[500px] w-full px-4 animate-in fade-in zoom-in-95 duration-500">
            {/* Target Destination Planet Banner */}
            <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-[rgba(61,224,255,0.35)] bg-[rgba(5,11,26,0.85)] backdrop-blur-md shadow-[0_0_20px_rgba(61,224,255,0.2)]">
              <span className="text-lg">{targetInfo.icon}</span>
              <div className="text-xs font-bold text-white">
                <span className="text-[var(--ma-accent)]">{lang === 'ar' ? targetInfo.ar : targetInfo.en}</span>
                <span className="text-white/40 mx-2">·</span>
                <span className="text-[var(--ma-gold)] font-mono text-[11px]">{targetInfo.dist}</span>
              </div>
            </div>

            {/* Visual Trajectory Guidance Highway Corridor */}
            <div className="w-full relative py-3">
              {/* Corridor Track Background */}
              <div className="relative h-7 rounded-xl ma-corridor-track overflow-hidden flex items-center justify-center">
                {/* Center baseline */}
                <div className="absolute inset-y-0 w-0.5 bg-white/20 left-1/2 -translate-x-1/2" />
                
                {/* Target Waypoint Gate marker */}
                <div
                  className="absolute top-0 bottom-0 w-16 -ml-8 flex items-center justify-center ma-corridor-gate"
                  style={{ left: `${((targetPathX + 1) / 2) * 100}%` }}
                >
                  <div className="w-full h-full border-x-2 border-dashed border-[var(--ma-gold)] bg-[rgba(233,195,124,0.15)] flex items-center justify-center">
                    <span className="text-[9px] font-mono text-[var(--ma-gold)] font-black tracking-tighter">GATE</span>
                  </div>
                </div>

                {/* Player's Rocket Steering Reticle */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -ml-4 flex flex-col items-center ma-steer-reticle pointer-events-none z-10"
                  style={{ left: `${((steerX + 1) / 2) * 100}%` }}
                >
                  <span className={`text-base transition-transform ${isAligned ? 'scale-110 drop-shadow-[0_0_10px_#3de0ff]' : 'drop-shadow-[0_0_8px_#ff5470]'}`}>
                    🚀
                  </span>
                  <div className={`w-2 h-1 rounded-full ${isAligned ? 'bg-[var(--ma-good)]' : 'bg-[var(--ma-bad)]'}`} />
                </div>
              </div>

              {/* Corridor Boundaries & Key hints */}
              <div className="flex items-center justify-between text-[10px] font-mono text-white/50 mt-1 px-1">
                <span className="hover:text-white cursor-pointer" onClick={() => setSteerX((x) => Math.max(-1, +(x - 0.2).toFixed(2)))}>◀ [A] يسار</span>
                <span className={`font-bold transition-colors ${isAligned ? 'text-[var(--ma-good)]' : 'text-[var(--ma-bad)]'}`}>
                  {isAligned
                    ? lang === 'ar'
                      ? `🟢 مسار دقيق مؤمّن (${accuracyPct}%) · ربح كوينز`
                      : `🟢 Locked on Path (${accuracyPct}%) · Earning Coins`
                    : lang === 'ar'
                      ? `⚠️ انحراف عن المسار (${accuracyPct}%) · وجّه الصاروخ`
                      : `⚠️ Off Track (${accuracyPct}%) · Steer into Gate`}
                </span>
                <span className="hover:text-white cursor-pointer" onClick={() => setSteerX((x) => Math.min(1, +(x + 0.2).toFixed(2)))}>يمين [D] ▶</span>
              </div>
            </div>

            {/* Floating Coin Notification Popups */}
            <div className="absolute -top-12 flex flex-col items-center pointer-events-none">
              {coinPopups.map((p) => (
                <div
                  key={p.id}
                  className="ma-coin-popup px-3 py-1 rounded-xl bg-[rgba(10,20,40,0.92)] border border-[var(--ma-gold)] text-xs font-bold text-[var(--ma-gold)] shadow-[0_0_20px_rgba(233,195,124,0.5)] flex items-center gap-1.5"
                >
                  <span>{p.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Center: Countdown Clock / Ascent Callout */}
        <div className="text-center self-center my-auto">
          <div className={`ma-kpi-num ma-num font-black text-6xl md:text-7xl tracking-tight transition-all duration-300 ${countdown <= 3 && countdown > 0 ? 'text-[var(--ma-bad)] scale-110 drop-shadow-[0_0_40px_rgba(255,84,112,0.8)]' : 'text-white drop-shadow-[0_0_35px_rgba(255,255,255,0.7)]'}`}>
            {countdown > 0 ? `${t('tMinus')}${countdown}` : `T+${Math.round(progress * 26)}s`}
          </div>
          <div className="inline-block mt-2 px-4 py-1 rounded-full border border-white/20 bg-[rgba(5,10,24,0.75)] backdrop-blur-md shadow-xl">
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

        {/* Bottom Section: Flight Deck Controls + Telemetry */}
        <div className="flex flex-wrap items-end justify-between gap-4 pointer-events-auto">
          {/* Live Flight Telemetry */}
          {countdown === 0 && (
            <div className="bg-[rgba(5,11,26,0.85)] border border-[rgba(61,224,255,0.25)] p-3 rounded-2xl backdrop-blur-md shadow-2xl min-w-[210px] space-y-1.5 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-center justify-between text-[9px] font-mono text-[var(--ma-accent)] uppercase tracking-widest border-b border-white/10 pb-1">
                <span>{lang === 'ar' ? 'القياس عن بُعد' : 'TELEMETRY'}</span>
                <span className="animate-pulse">● REC</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] ma-num font-mono">
                <div>
                  <span className="text-[8px] text-[var(--ma-muted)] block">{lang === 'ar' ? 'السرعة' : 'VELOCITY'}</span>
                  <span className="text-sm font-bold text-white">{launchVelocityMps} <small className="text-[8px] text-[var(--ma-muted)]">m/s</small></span>
                </div>
                <div>
                  <span className="text-[8px] text-[var(--ma-muted)] block">{lang === 'ar' ? 'الارتفاع' : 'ALTITUDE'}</span>
                  <span className="text-sm font-bold text-[var(--ma-accent)]">{launchAltitudeKm} <small className="text-[8px] text-[var(--ma-muted)]">km</small></span>
                </div>
                <div>
                  <span className="text-[8px] text-[var(--ma-muted)] block">{lang === 'ar' ? 'الجاذبية' : 'G-FORCE'}</span>
                  <span className="text-sm font-bold text-[var(--ma-gold)]">{launchGs} G</span>
                </div>
                <div>
                  <span className="text-[8px] text-[var(--ma-muted)] block">{lang === 'ar' ? 'الخطوة' : 'STEP'}</span>
                  <span className="text-xs font-bold text-[var(--ma-good)]">{Math.min(15, currentStep + 1)} / 15</span>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Cockpit Steering Deck (Accessible to click/touch and keys) */}
          {countdown === 0 && (
            <div className="flex flex-col items-center gap-1.5 bg-[rgba(5,11,26,0.9)] border border-[rgba(61,224,255,0.3)] p-3 rounded-2xl backdrop-blur-md shadow-[0_0_25px_rgba(0,0,0,0.7)] mx-auto">
              <span className="text-[10px] font-mono text-[var(--ma-accent)] uppercase tracking-wider">
                🎮 {lang === 'ar' ? 'تحكم توجيه الصاروخ' : 'MANUAL ROCKET STEERING'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3.5 py-2 rounded-xl bg-[rgba(10,18,36,0.9)] hover:bg-[rgba(61,224,255,0.2)] border border-[rgba(61,224,255,0.4)] text-xs font-bold text-white transition-all active:scale-95 shadow-md"
                  onClick={() => {
                    setSteerX((x) => Math.max(-1, +(x - 0.2).toFixed(2)));
                    if (soundOn) sound.play('tick');
                  }}
                  title="A / Arrow Left"
                >
                  ◀ {lang === 'ar' ? 'يسار (A)' : 'Left (A)'}
                </button>
                <button
                  type="button"
                  className="px-3.5 py-2 rounded-xl bg-[rgba(10,18,36,0.9)] hover:bg-[rgba(233,195,124,0.2)] border border-[rgba(233,195,124,0.4)] text-xs font-bold text-[var(--ma-gold)] transition-all active:scale-95 shadow-md"
                  onClick={() => {
                    setSteerX(0);
                    if (soundOn) sound.play('tick');
                  }}
                  title="S / Space"
                >
                  🎯 {lang === 'ar' ? 'توسيط (S)' : 'Center (S)'}
                </button>
                <button
                  type="button"
                  className="px-3.5 py-2 rounded-xl bg-[rgba(10,18,36,0.9)] hover:bg-[rgba(61,224,255,0.2)] border border-[rgba(61,224,255,0.4)] text-xs font-bold text-white transition-all active:scale-95 shadow-md"
                  onClick={() => {
                    setSteerX((x) => Math.min(1, +(x + 0.2).toFixed(2)));
                    if (soundOn) sound.play('tick');
                  }}
                  title="D / Arrow Right"
                >
                  {lang === 'ar' ? 'يمين (D)' : 'Right (D)'} ▶
                </button>
              </div>
              <span className="text-[9px] text-[var(--ma-muted)] font-mono">
                {lang === 'ar' ? 'تحكّم بالمفاتيح [A / D] أو الأسهم · اربح كوينز عند مطابقة الممر' : 'Use [A / D] or Arrows · Keep inside the corridor to earn coins'}
              </span>
            </div>
          )}

          {/* Right Info: Target & Checklist */}
          <div className="text-right text-white/90 text-xs ma-num font-mono bg-[rgba(5,11,26,0.85)] border border-[rgba(255,255,255,0.12)] px-4 py-2.5 rounded-2xl backdrop-blur-md shadow-2xl">
            <p className="font-bold text-[var(--ma-accent)]">{launcher?.name} → {targetInfo.en}</p>
            <p className="text-[10px] text-[var(--ma-muted)] mt-0.5">
              {lang === 'ar' ? 'مسار الإطلاق ← الممر المداري ← الوصول للوجهة' : 'Launch trajectory → Orbital Corridor → Insertion'}
            </p>
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
  const startExpedition = useMission((s) => s.startExpedition);
  const dispatch = useMission((s) => s.dispatch);
  const learnMode = useMission((s) => s.settings.learnMode);
  const altitudeOffsetKm = useMission((s) => s.altitudeOffsetKm);
  const inclinationDeg = useMission((s) => s.inclinationDeg);
  const logRef = useRef<HTMLDivElement>(null);

  const [showArrival, setShowArrival] = useState(false);
  const hasTriggeredArrivalRef = useRef(false);

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
  const timelineFrac = Math.min(1, sim.elapsedDays / Math.max(1, sim.durationDays));
  const isCritical = sim.eventLog.slice(-3).some((e) => e.severity === 'critical') && !sim.safeMode;

  const dvFrac = validate && validate.budget.availableDvMps > 0 ? sim.dvRemainingMps / validate.budget.availableDvMps : 0;
  const altitudeKm = mission.altitudeKm + altitudeOffsetKm;
  const inclination = inclinationDeg || mission.inclinationDeg;
  const powerTone = batteryPct <= 20 ? 'bad' as const : batteryPct <= 40 ? 'warn' as const : undefined;
  const dvPct = Math.min(100, dvFrac * 100);
  const nf = new Intl.NumberFormat('en-US');
  const fmtRangeKm = (km: number) => km >= 1e6 ? `${(km / 1e6).toFixed(2)}M km` : `${nf.format(Math.round(km))} km`;
  const fmtDelayS = (s: number) => (s >= 1 ? `${s.toFixed(1)} s` : `${Math.max(1, Math.round(s * 1000))} ms`);
  const fmtRate = (mbps: number) => (mbps >= 1000 ? `${(mbps / 1000).toFixed(2)} Gbps` : mbps >= 1 ? `${mbps.toFixed(1)} Mbps` : `${Math.max(0, mbps * 1000).toFixed(0)} kbps`);

  // Target Destination Configuration
  const targetIcons: Record<string, string> = {
    moon: '🌕',
    mars: '🔴',
    venus: '🟡',
    jupiter: '🪐',
    europa: '❄️',
    titan: '🌫️',
    eros: '☄️',
    leo: '🌍',
    gto: '🛰️',
    geo: '📡',
  };
  const targetEmoji = targetIcons[mission.target] ?? '🎯';
  const targetLabel = lang === 'ar' ? (mission.nameAr ?? mission.name) : mission.name;
  const canLand = ['moon', 'mars', 'europa', 'titan', 'eros'].includes(mission.target);
  const totalDistKm = link?.distanceKm ?? (mission.altitudeKm > 2000 ? 54600000 : 384400);
  const distFlown = totalDistKm * timelineFrac;
  const etaDays = Math.max(0, sim.durationDays - sim.elapsedDays).toFixed(1);

  // Auto-trigger arrival modal once 100% journey completed
  useEffect(() => {
    if (timelineFrac >= 1 && !hasTriggeredArrivalRef.current) {
      hasTriggeredArrivalRef.current = true;
      setShowArrival(true);
      sound.play('success');
    }
  }, [timelineFrac]);

  const handleBurnBoost = () => {
    sound.play('fire');
    const step = Math.max(1, sim.durationDays * 0.12);
    tick(step);
    dispatch('FIRE', { playerInitiated: true });
  };

  const handleCycleWarp = () => {
    const scales: (1 | 10 | 100)[] = [1, 10, 100];
    const curr = (sim.timeScale as 1 | 10 | 100) || 1;
    const next = scales[(scales.indexOf(curr) + 1) % scales.length] ?? 1;
    useMission.setState((s) => (s.sim ? { sim: { ...s.sim, timeScale: next } } : {}));
    sound.play('key');
  };

  const handleCollectScience = () => {
    sound.play('scan');
    dispatch('SCAN', { playerInitiated: true });
    useMission.setState((s) => (s.sim ? { sim: { ...s.sim, dataReturnedGb: s.sim.dataReturnedGb + 8 } } : {}));
    sound.play('confirm');
  };

  const handleArriveNow = () => {
    sound.play('confirm');
    const remainingDays = Math.max(0, sim.durationDays - sim.elapsedDays);
    if (remainingDays > 0) {
      tick(remainingDays);
    }
    setShowArrival(true);
    sound.play('success');
  };

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
              {targetLabel}
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

      {/* --- INTERPLANETARY VOYAGE PROGRESS TRACKER & STREAMLINED FLIGHT CONTROLS --- */}
      <div className="rounded-2xl border border-[color-mix(in_srgb,var(--ma-accent)_35%,var(--ma-line))] bg-[radial-gradient(ellipse_at_top,#0b193d_0%,#050b1f_90%)] p-4 shadow-[0_0_35px_rgba(0,0,0,0.6)] backdrop-blur-md">
        {/* Origin to Destination Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-white">
              <span className="flex items-center gap-1 text-[var(--ma-accent)]">🌍 {lang === 'ar' ? 'الأرض (نقطة الانطلاق)' : 'Earth (Origin)'}</span>
              <span className="text-[var(--ma-gold)] font-bold">───────►</span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[color-mix(in_srgb,var(--ma-accent)_20%,transparent)] border border-[var(--ma-accent)] text-white shadow-[0_0_12px_rgba(61,224,255,0.4)]">
                <span>{targetEmoji}</span>
                <span className="font-extrabold">{targetLabel}</span>
              </span>
            </div>
          </div>

          {/* Live Flight Progress Metrics */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono ma-num">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-[var(--ma-muted)] block">{lang === 'ar' ? 'المسافة المقطوعة' : 'Distance Flown'}</span>
              <span className="font-bold text-[var(--ma-accent)]">{fmtRangeKm(distFlown)} / {fmtRangeKm(totalDistKm)}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-[var(--ma-muted)] block">{lang === 'ar' ? 'السرعة الفضائية' : 'Cruise Velocity'}</span>
              <span className="font-bold text-[var(--ma-good)]">{(11.2 + timelineFrac * 6.5).toFixed(1)} km/s</span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-[var(--ma-muted)] block">{lang === 'ar' ? 'الوصول التقديري' : 'ETA to Target'}</span>
              <span className="font-bold text-[var(--ma-gold)]">{etaDays} {lang === 'ar' ? 'يوم' : 'days'}</span>
            </div>
          </div>
        </div>

        {/* Visual Animated Flight Path */}
        <div className="relative mt-5 mb-4">
          <div className="h-3 w-full rounded-full bg-[#050b1a] border border-white/15 overflow-hidden relative shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--ma-accent)] via-[#5eead4] to-[var(--ma-gold)] shadow-[0_0_18px_var(--ma-accent)] transition-all duration-300"
              style={{ width: `${timelineFrac * 100}%` }}
            />
          </div>

          {/* Rocket icon traveling along the track */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-300"
            style={{ left: `${Math.max(2, Math.min(98, timelineFrac * 100))}%` }}
          >
            <span className="text-xl filter drop-shadow-[0_0_10px_#3de0ff] animate-pulse">🚀</span>
            <span className="text-[8px] font-bold font-mono px-1.5 py-0.2 rounded bg-[rgba(6,12,26,0.92)] text-[var(--ma-accent)] border border-[var(--ma-accent)] whitespace-nowrap mt-1">
              {(timelineFrac * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* STREAMLINED EASY CONTROLS */}
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--ma-gold-hi)] font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--ma-good)] animate-ping" />
              {lang === 'ar' ? 'أوامر التحكم السريع بالرحلة:' : 'FAST FLIGHT CONTROLS:'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Boost / Burn engines */}
            <button
              type="button"
              className="ma-tap flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--ma-accent)] bg-[color-mix(in_srgb,var(--ma-accent)_15%,transparent)] hover:bg-[color-mix(in_srgb,var(--ma-accent)_32%,transparent)] text-white font-bold text-xs shadow-[0_0_15px_rgba(61,224,255,0.3)] transition-all"
              onClick={handleBurnBoost}
              title={lang === 'ar' ? 'تشغيل الدفع لتسريع الوصول للهدف' : 'Fire thrusters to speed up transit'}
            >
              <span>🔥</span>
              <span>{lang === 'ar' ? 'دفع المحركات (+12% تقدم)' : 'Burn Boost (+12%)'}</span>
            </button>

            {/* Time warp cycle */}
            <button
              type="button"
              className="ma-tap flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--ma-gold)] bg-[color-mix(in_srgb,var(--ma-gold)_15%,transparent)] hover:bg-[color-mix(in_srgb,var(--ma-gold)_32%,transparent)] text-white font-bold text-xs shadow-[0_0_15px_rgba(255,197,66,0.3)] transition-all"
              onClick={handleCycleWarp}
              title={lang === 'ar' ? 'مضاعفة سرعة الوقت' : 'Cycle warp multiplier'}
            >
              <span>⏩</span>
              <span>{lang === 'ar' ? `تسريع الزمن ×${sim.timeScale}` : `Warp ×${sim.timeScale}`}</span>
            </button>

            {/* Collect Science */}
            <button
              type="button"
              className="ma-tap flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--ma-good)] bg-[color-mix(in_srgb,var(--ma-good)_15%,transparent)] hover:bg-[color-mix(in_srgb,var(--ma-good)_32%,transparent)] text-white font-bold text-xs shadow-[0_0_15px_rgba(47,227,154,0.3)] transition-all"
              onClick={handleCollectScience}
              title={lang === 'ar' ? 'جمع بيانات علمية من الفضاء' : 'Collect science data'}
            >
              <span>📡</span>
              <span>{lang === 'ar' ? 'مسح وجمع بيانات' : 'Scan & Collect'}</span>
            </button>

            {/* Instant Arrival to Destination */}
            <button
              type="button"
              className="ma-tap flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--ma-gold)] bg-gradient-to-r from-[var(--ma-gold)] to-[#ff8a2f] text-[#050b1f] font-black text-xs shadow-[0_0_25px_rgba(255,197,66,0.6)] transition-all hover:scale-105"
              onClick={handleArriveNow}
              title={lang === 'ar' ? 'الوصول فوراً للوجهة والدخول المداري' : 'Instant arrival at destination'}
            >
              <span>🎯</span>
              <span>{lang === 'ar' ? 'الوصول للهدف فوراً' : 'Instant Arrival'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- MISSION ARRIVAL CELEBRATION MODAL --- */}
      {showArrival && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg animate-in fade-in duration-300">
          <div className="relative max-w-lg w-full rounded-3xl border-2 border-[var(--ma-gold)] bg-[radial-gradient(circle_at_top,#10224d,#050b1f)] p-6 md:p-8 shadow-[0_0_60px_rgba(255,197,66,0.4)] text-center">
            <div className="text-5xl mb-3 animate-bounce">{targetEmoji}</div>
            <span className="ma-epic-kicker text-[10px] tracking-[0.3em] text-[var(--ma-gold)]">
              {lang === 'ar' ? 'إنجاز الرحلة · الوصول المداري' : 'MISSION ACCOMPLISHED · ORBITAL ARRIVAL'}
            </span>
            <h2 className="font-hud text-2xl md:text-3xl font-black text-white mt-2">
              {lang === 'ar' ? `تم الوصول بنجاح إلى ${targetLabel}! 🎉` : `Arrived at ${targetLabel}! 🎉`}
            </h2>
            <p className="mt-3 text-xs md:text-sm text-[var(--ma-muted)] leading-relaxed">
              {lang === 'ar'
                ? `أتم الصاروخ والمركبة بنجاح مسار الرحلة الفضائية بالكامل، واستقرت المركبة في المدار النهائي بنجاح تام لجمع البيانات العلمية وتحقيق أهداف المهمة.`
                : `The spacecraft successfully completed interplanetary transit and safely entered stable orbit around ${targetLabel}.`}
            </p>

            {/* Stats summary */}
            <div className="my-5 grid grid-cols-3 gap-3 p-3 rounded-2xl bg-[rgba(6,12,28,0.7)] border border-white/10 text-xs font-mono ma-num">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-[var(--ma-muted)] block">{lang === 'ar' ? 'البيانات' : 'Data'}</span>
                <span className="font-bold text-[var(--ma-accent)] text-sm">{sim.dataReturnedGb.toFixed(1)} GB</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-[var(--ma-muted)] block">{lang === 'ar' ? 'مدة الرحلة' : 'Days'}</span>
                <span className="font-bold text-white text-sm">{sim.elapsedDays.toFixed(0)} d</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-[var(--ma-muted)] block">{lang === 'ar' ? 'حالة الطاقة' : 'Power'}</span>
                <span className="font-bold text-[var(--ma-good)] text-sm">{batteryPct.toFixed(0)}%</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {canLand && (
                <button
                  type="button"
                  className="ma-tap flex-1 py-3 px-4 rounded-xl border border-[var(--ma-accent)] bg-[color-mix(in_srgb,var(--ma-accent)_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--ma-accent)_45%,transparent)] text-white font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all"
                  onClick={() => {
                    setShowArrival(false);
                    startExpedition();
                  }}
                >
                  🛬 {lang === 'ar' ? 'الهبوط واستكشاف السطح' : 'Surface Descent & Landing'}
                </button>
              )}
              <button
                type="button"
                className="ma-tap flex-1 py-3 px-4 rounded-xl ma-master-launch-btn text-xs font-black uppercase tracking-wider"
                onClick={() => {
                  setShowArrival(false);
                  endMission();
                }}
              >
                🏆 {lang === 'ar' ? 'تقرير المهمة والنتائج' : 'Debrief & Results'}
              </button>
              <button
                type="button"
                className="ma-tap py-3 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-[var(--ma-muted)] font-semibold text-xs"
                onClick={() => setShowArrival(false)}
              >
                🛸 {lang === 'ar' ? 'البقاء في المدار' : 'Keep Orbiting'}
              </button>
            </div>
          </div>
        </div>
      )}

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
