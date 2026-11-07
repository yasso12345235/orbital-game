/**
 * FlightScreen — the interactive full-flight simulation screen.
 *
 * Brings together: physics engine, input, 3D scene with camera modes,
 * real-time HUD, mission stages and evaluation. Arrow keys steer, Space
 * fires the engine, Shift throttles up, P pauses, R restarts.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useFlightStore } from '@/flight/FlightStore';
import { useLang, useT } from '@/hooks';
import { useMission } from '../store';
import { lookupTables, orientationEuler } from '@engine';
import { sound } from '../audio';
import FlightView from '../visual/FlightView';
import { HUDSystem } from '../flight/HUDSystem';
import { HudFrame, Kpi, PanelTag, RadialGauge } from '../components/controls';
import { Icon } from '../components/Icon';
import type { CameraMode } from '../visual/three/scenes/FlightScene';

const CAMERA_MODES: { id: CameraMode; label: string; ar: string }[] = [
  { id: 'follow', label: 'Follow', ar: 'المتابعة' },
  { id: 'chase', label: 'Chase', ar: 'المطاردة' },
  { id: 'side', label: 'Side View', ar: 'المنظر الجانبي' },
  { id: 'cockpit', label: 'Cockpit', ar: 'قمرة القيادة' },
  { id: 'wide', label: 'Wide Space', ar: 'فضاء واسع' },
  { id: 'target', label: 'Target View', ar: 'منظر الهدف' },
];

export function FlightScreen() {
  const t = useT();
  const lang = useLang();
  const setScreen = useMission((s) => s.setScreen);
  const missionId = useMission((s) => s.missionId);

  const [mode, setMode] = useState<CameraMode>('follow');
  const [showResults, setShowResults] = useState(false);

  const { state, mission, isRunning, isPaused, initFlight, restartMission, setPaused, setSimulationSpeed } =
    useFlightStore((s) => ({
      state: s.state,
      mission: s.mission,
      isRunning: s.isRunning,
      isPaused: s.isPaused,
      initFlight: s.initFlight,
      restartMission: s.restartMission,
      setPaused: s.setPaused,
      setSimulationSpeed: s.setSimulationSpeed,
    }));

  // Initialize flight on first mount using the currently selected mission.
  useEffect(() => {
    if (state) return;
    const m = missionId ? lookupTables().missions[missionId] : null;
    if (!m) return;
    const targetPos: [number, number, number] = [400000, 6371000 + 400000, 300000]; // downrange orbital target
    initFlight({
      missionId: m.id,
      missionName: m.name,
      target: m.target,
      targetPosition: targetPos,
      orbitAltitudeM: m.altitudeKm * 1000,
      requiresOrbit: m.target !== 'leo',
      arrivalThresholdM: 5000,
      flightConfig: {
        dryMassKg: 12000,
        fuelMassKg: 38000,
        maxThrustN: 750_000,
        ispS: 320,
        maxTorqueRadS2: 0.015,
        dragAreaM2: 12.0,
        steeringSensitivity: 0.6,
        steeringResponse: 0.5,
        automaticSteering: false,
        timestepS: 1 / 60,
        bodyRadiusM: 6371000,
        bodyMuM3S2: 398600e9,
      },
    });
    if (sound) sound.play('beep');
  }, [missionId, state, initFlight]);

  // Auto-show results when mission completes.
  useEffect(() => {
    if (mission?.complete && !showResults) {
      setShowResults(true);
      sound.play('success');
    }
  }, [mission?.complete, showResults]);

  const handlePause = () => {
    setPaused(!isPaused);
    sound.play(isPaused ? 'confirm' : 'alarm');
  };

  const handleRestart = () => {
    restartMission();
    setShowResults(false);
    sound.play('confirm');
  };

  const handleSetSpeed = (speed: number) => {
    setSimulationSpeed(speed);
    sound.play('key');
  };

  if (!state || !mission) {
    return (
      <div className="flex h-full items-center justify-center bg-[#02040C]">
        <div className="text-[var(--ma-muted)] font-mono text-xs">
          {lang === 'ar' ? 'تجهيز المحاكاة…' : 'Preparing flight simulation…'}
        </div>
      </div>
    );
  }

  if (showResults) {
    return <MissionResults state={state} mission={mission} onRestart={handleRestart} onResume={() => setShowResults(false)} />;
  }

  return (
    <div className="relative h-full bg-[#02040C] overflow-hidden">
      {/* 3D flight scene */}
      <div className="absolute inset-0 z-0">
        <FlightView mode={mode} setMode={setMode} />
      </div>

      {/* Camera mode bar (top right) */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-1">
        <PanelTag ar="زوايا الكاميرا" en="CAMERA MODES" />
        {CAMERA_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`ma-tap px-3 py-1.5 rounded-lg text-[9px] font-mono font-bold border transition-all ${
              mode === m.id
                ? 'bg-[var(--ma-accent)] text-[#041018] border-[var(--ma-accent)] shadow-[0_0_12px_var(--ma-accent)]'
                : 'bg-[rgba(6,12,26,0.7)] border-white/10 text-[var(--ma-muted)] hover:border-[var(--ma-accent)] hover:text-white'
            }`}
            onClick={() => { setMode(m.id); sound.play('key'); }}
            title={m.ar}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* HUD (left + right panels + bottom timeline) */}
      <div className="absolute inset-0 z-10 pointer-events-none p-4 lg:p-6 flex flex-col">
        <HUDSystem />
      </div>

      {/* Control hint bar (bottom left) */}
      <div className="absolute bottom-6 left-6 z-10">
        <div className="ma-panel px-3 py-2 rounded-xl text-left">
          <div className="flex flex-wrap gap-3 text-[10px] font-mono">
            <span className="ma-hudtag px-2 py-0.5">↑ ↓ Pitch · ← → Yaw</span>
            <span className="ma-hudtag px-2 py-0.5">Space Engine · Shift Throttle</span>
            <span className="ma-hudtag px-2 py-0.5">P Pause · R Restart</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[9px] text-[var(--ma-muted)]">
            <span>{lang === 'ar' ? 'الحالة:' : 'Status:'}</span>
            <span className={`text-xs font-bold ${mission.complete ? 'text-[var(--ma-good)]' : mission.failed ? 'text-[var(--ma-bad)]' : 'text-[var(--ma-accent)]'}`}>
              {mission.complete ? (lang === 'ar' ? 'مكتمل' : 'COMPLETE') : mission.failed ? (lang === 'ar' ? 'فاشل' : 'FAILED') : (lang === 'ar' ? 'جاري الطيران' : 'FLIGHT ACTIVE')}
            </span>
            <span className="opacity-50">·</span>
            <span className="text-xs font-mono">{isPaused ? (lang === 'ar' ? 'موقوف مؤقتاً' : 'PAUSED') : (lang === 'ar' ? 'مباشر' : 'LIVE')}</span>
          </div>
        </div>
      </div>

      {/* Action buttons (bottom right) */}
      <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2">
        <button
          type="button"
          className="ma-tap px-4 py-2 rounded-xl border border-[var(--ma-accent)] bg-[rgba(61,224,255,0.15)] text-[var(--ma-accent)] text-xs font-bold uppercase hover:bg-[var(--ma-accent)] hover:text-[#041018] transition-all"
          onClick={handlePause}
        >
          ⏸ {isPaused ? (lang === 'ar' ? 'استئناف' : 'Resume') : (lang === 'ar' ? 'إيقاف مؤقت' : 'Pause')}
        </button>
        <button
          type="button"
          className="ma-tap px-4 py-2 rounded-xl border border-[var(--ma-bad)] bg-[rgba(255,77,106,0.15)] text-[var(--ma-bad)] text-xs font-bold uppercase hover:bg-[var(--ma-bad)] hover:text-[#041018] transition-all"
          onClick={handleRestart}
        >
          ↻ {lang === 'ar' ? 'إعادة المهمة' : 'Restart Mission'}
        </button>
        <div className="flex gap-1">
          {[0.5, 1, 2, 4].map((sp) => (
            <button
              key={sp}
              type="button"
              className={`px-2.5 py-1.5 rounded-lg text-[9px] font-mono font-bold border transition-all ${
                sp === 1 ? 'bg-[var(--ma-accent)] text-[#041018] border-[var(--ma-accent)]' : 'bg-[rgba(6,12,26,0.7)] border-white/10 text-[var(--ma-muted)]'
              }`}
              onClick={() => handleSetSpeed(sp)}
            >
              ×{sp}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mission results / evaluation                                       */
/* ------------------------------------------------------------------ */
function MissionResults({ state, mission, onRestart, onResume }: { state: any; mission: any; onRestart: () => void; onResume: () => void }) {
  const lang = useLang();
  const t = useT();
  const { config } = useFlightStore((s) => ({ config: s.config }));
  const fuelPct = config ? (state.fuelMassKg / config.fuelMassKg) * 100 : 0;
  const { pitch, yaw, roll } = orientationEuler(state.orientation);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-lg">
      <div className="max-w-2xl w-full rounded-3xl border-2 border-[var(--ma-gold)] bg-[radial-gradient(circle_at_top,#10224d,#050b1f)] p-6 md:p-10 shadow-[0_0_80px_rgba(255,197,66,0.4)]">
        <div className="text-5xl mb-3 animate-bounce">🏆</div>
        <span className="ma-epic-kicker text-[10px] tracking-[0.3em] text-[var(--ma-gold)] block text-center">
          {lang === 'ar' ? 'نتائج المهمة' : 'MISSION RESULTS'}
        </span>
        <h2 className="font-hud text-2xl md:text-3xl font-black text-white text-center mb-4">
          {mission.complete ? (lang === 'ar' ? 'اكتملت المهمة بنجاح!' : 'MISSION COMPLETE!') : (lang === 'ar' ? 'انتهت المهمة' : 'MISSION ENDED')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-3 rounded-2xl bg-[rgba(6,12,28,0.7)] border border-white/10">
            <span className="text-[9px] uppercase tracking-wider text-[var(--ma-muted)] block">{lang === 'ar' ? 'الارتفاع الأقصى' : 'Max Altitude'}</span>
            <span className="font-bold text-[var(--ma-accent)]">{fmt(state.position[1] / 1000)} km</span>
          </div>
          <div className="p-3 rounded-2xl bg-[rgba(6,12,28,0.7)] border border-white/10">
            <span className="text-[9px] uppercase tracking-wider text-[var(--ma-muted)] block">{lang === 'ar' ? 'أقصى سرعة' : 'Max Velocity'}</span>
            <span className="font-bold text-[var(--ma-good)]">{fmt(state.speedMps.toFixed(0))} m/s</span>
          </div>
          <div className="p-3 rounded-2xl bg-[rgba(6,12,28,0.7)] border border-white/10">
            <span className="text-[9px] uppercase tracking-wider text-[var(--ma-muted)] block">{lang === 'ar' ? 'الوقود المتبقي' : 'Fuel Remaining'}</span>
            <span className="font-bold text-[var(--ma-warn)]">{fuelPct.toFixed(0)}%</span>
          </div>
        </div>

        <div className="mb-6 p-4 rounded-2xl bg-[rgba(6,12,28,0.5)] border border-white/10">
          <div className="flex justify-between text-[10px] mb-1"><span>{lang === 'ar' ? 'اتجاه pitch' : 'Pitch'}</span><span className="ma-num">{pitch.toFixed(1)}°</span></div>
          <div className="flex justify-between text-[10px] mb-1"><span>{lang === 'ar' ? 'اتجاه yaw' : 'Yaw'}</span><span className="ma-num">{yaw.toFixed(1)}°</span></div>
          <div className="flex justify-between text-[10px] mb-1"><span>{lang === 'ar' ? 'اتجاه roll' : 'Roll'}</span><span className="ma-num">{roll.toFixed(1)}°</span></div>
          <div className="flex justify-between text-[10px]"><span>{lang === 'ar' ? 'المسافة للهدف' : 'Distance to Target'}</span><span className="ma-num">{fmt(state.distanceToTargetM / 1000)} km</span></div>
        </div>

        <div className="mb-6">
          <p className="text-[10px] text-[var(--ma-muted)] mb-2">
            {mission.complete
              ? (lang === 'ar' ? 'وصلت المركبة إلى الهدف بنجاح. تم تحقيق أهداف المهمة.' : 'The spacecraft reached the target successfully. Mission objectives achieved.')
              : (lang === 'ar' ? 'لم تصل المركبة إلى الهدف. راجع البيانات لتحسين الأداء.' : 'The spacecraft did not reach the target. Review data to improve performance.')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            className="ma-tap flex-1 py-3 px-4 rounded-xl border border-[var(--ma-accent)] bg-[color-mix(in_srgb,var(--ma-accent)_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--ma-accent)_45%,transparent)] text-white font-bold text-xs uppercase tracking-wider"
            onClick={() => { onResume(); }}
          >
            {lang === 'ar' ? 'استئناف الطيران' : 'Resume Flight'}
          </button>
          <button
            type="button"
            className="ma-tap flex-1 py-3 px-4 rounded-xl ma-master-launch-btn text-xs font-black uppercase tracking-wider"
            onClick={onRestart}
          >
            ↻ {lang === 'ar' ? 'إعادة المهمة' : 'Restart Mission'}
          </button>
          <button
            type="button"
            className="ma-tap py-3 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-[var(--ma-muted)] font-semibold text-xs"
            onClick={() => { onResume(); } /* go back to menu handled by caller */ }
          >
            {lang === 'ar' ? 'العودة للقائمة' : 'Back to Menu'}
          </button>
        </div>
      </div>
    </div>
  );
}

function fmt(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}
