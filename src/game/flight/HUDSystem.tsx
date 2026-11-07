/**
 * HUDSystem — professional real-time mission control interface.
 *
 * Reads live flight state from the store and renders telemetry gauges,
 * indicators, stage timeline and warnings. Every value is bound to actual
 * simulation variables — no decorative placeholders.
 */
import { useEffect, useState } from 'react';
import { useFlightStore } from '@/flight/FlightStore';
import { useFlightInput } from '@/flight/InputManager';
import { useLang, useT } from '@/hooks';
import { fmt } from '@/components/controls';
import { HudFrame, RadialGauge, Kpi, PanelTag, Bi } from '@/components/controls';
import { Icon } from '@/components/Icon';
import { stageDefFor, type FlightStageId } from '@engine';
import { orientationEuler } from '@engine';

export function HUDSystem() {
  const t = useT();
  const lang = useLang();
  const { state, mission, trajectory, settings, config, isPaused, setPaused, restartMission, setSetting } =
    useFlightStore((s) => ({
      state: s.state,
      mission: s.mission,
      trajectory: s.trajectory,
      settings: s.settings,
      config: s.config,
      isPaused: s.isPaused,
      setPaused: s.setPaused,
      restartMission: s.restartMission,
      setSetting: s.setSetting,
    }));

  const input = useFlightInput();
  if (!state || !mission || !config) return null;

  const { pitch, yaw, roll } = orientationEuler(state.orientation);
  const stage = stageDefFor(state.stage);
  const progress = missionProgress(mission);
  const fuelPct = config.fuelMassKg > 0 ? (state.fuelMassKg / config.fuelMassKg) * 100 : 0;
  const thrustPct = state.thrust * 100;
  const healthPct = Math.round(100 - state.dragN / 1e6); // proxy system health

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
      {/* LEFT: Flight telemetry */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <HudFrame tag="FLIGHT TELEMETRY" tagAr="بيانات الطيران">
          <div className="grid grid-cols-2 gap-3">
            <Kpi ar="الارتفاع" en="Altitude" value={(state.altitudeM / 1000).toFixed(1)} unit="km" accent="var(--ma-accent)" big />
            <Kpi ar="السرعة" en="Velocity" value={state.speedMps.toFixed(0)} unit="m/s" accent="var(--ma-good)" big />
            <Kpi ar="التسارع" en="Acceleration" value={Math.sqrt(
              state.acceleration[0] ** 2 + state.acceleration[1] ** 2 + state.acceleration[2] ** 2
            ).toFixed(1)} unit="m/s²" accent="var(--ma-warn)" />
            <Kpi ar="المسافة للهدف" en="Distance" value={fmt(state.distanceToTargetM / 1000)} unit="km" accent="var(--ma-accent)" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <RadialGauge
              value={fuelPct} ar="الوقود" en="Fuel" unit="%" size={100}
              lowAt={15} warnAt={30} note={`${state.fuelMassKg.toFixed(0)} / ${config.fuelMassKg} kg`}
              tone={fuelPct <= 15 ? 'bad' : fuelPct <= 30 ? 'warn' : 'accent'}
            />
            <RadialGauge
              value={thrustPct} ar="الدفع" en="Thrust" unit="%" size={100}
              note={`${Math.round(state.thrust * config.maxThrustN).toLocaleString()} N`}
            />
          </div>
        </HudFrame>

        <HudFrame tag="ATTITUDE" tagAr="الاتجاه">
          <div className="grid grid-cols-3 gap-2">
            <Kpi ar="الميلان" en="Pitch" value={(pitch * 180 / Math.PI).toFixed(1)} unit="°" accent="var(--ma-accent)" />
            <Kpi ar="الاتجاه الأفقي" en="Yaw" value={(yaw * 180 / Math.PI).toFixed(1)} unit="°" accent="var(--ma-accent)" />
            <Kpi ar="اللف" en="Roll" value={(roll * 180 / Math.PI).toFixed(1)} unit="°" accent="var(--ma-accent)" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--ma-muted)]">{lang === 'ar' ? 'اتجاه الصاروخ' : 'Rocket Direction'}</span>
              <div className="h-2 w-16 rounded-full bg-[#141E3C] overflow-hidden">
                <div className="h-full" style={{ background: 'var(--ma-accent)', width: `${Math.max(0, Math.min(100, 50 + (yaw * 180 / Math.PI) * 2))}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--ma-muted)]">{lang === 'ar' ? 'المحرك' : 'Engine'}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${state.engineActive ? 'bg-[var(--ma-good)]/20 text-[var(--ma-good)] border border-[var(--ma-good)]/30' : 'bg-[var(--ma-muted)]/20 text-[var(--ma-muted)] border border-[var(--ma-muted)]/30'}`}>
                {state.engineActive ? (lang === 'ar' ? 'مفعل' : 'ACTIVE') : (lang === 'ar' ? 'مغلق' : 'OFF')}
              </span>
            </div>
          </div>
        </HudFrame>

        <HudFrame tag="STAGE" tagAr="المرحلة">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--ma-accent)]/20 flex items-center justify-center text-xl border border-[var(--ma-accent)]/40">
              <span>{stageProgressIcon(state.stage)}</span>
            </div>
            <div>
              <div className="font-bold text-[var(--ma-text)]">{stage.name}</div>
              <div className="text-[10px] text-[var(--ma-muted)]">{stage.description}</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-[var(--ma-muted)] mb-1">
              <span>{lang === 'ar' ? 'تقدم المهمة' : 'Mission Progress'}</span>
              <span className="ma-num font-bold">{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#141E3C] overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[var(--ma-accent)] to-[var(--ma-good)]" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
          <div className="mt-2 space-y-1 text-[10px]">
            {MISSION_STAGE_ORDER.map((sid, i) => {
              const done = mission.stagesCompleted.includes(sid);
              const active = state.stage === sid;
              return (
                <div key={sid} className={`flex items-center gap-2 ${active ? 'text-[var(--ma-accent)] font-bold' : done ? 'text-[var(--ma-good)]' : 'text-[var(--ma-muted)]'}`}>
                  <span className="w-2 h-2 rounded-full" style={{ background: active ? 'var(--ma-accent)' : done ? 'var(--ma-good)' : '#141E3C' }} />
                  <span>{stageDefFor(sid).name}</span>
                </div>
              );
            })}
          </div>
        </HudFrame>

        <HudFrame tag="SYSTEM" tagAr="النظام">
          <div className="space-y-2">
            <div className="flex justify-between text-[10px]">
              <span>{lang === 'ar' ? 'كثافة الغلاف' : 'Atmosphere'}</span>
              <span className="ma-num">{state.density.toFixed(3)} kg/m³</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>{lang === 'ar' ? 'جاذبية' : 'Gravity'}</span>
              <span className="ma-num">{state.gravityMs2.toFixed(2)} m/s²</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>{lang === 'ar' ? 'السحب الهوائي' : 'Drag'}</span>
              <span className="ma-num">{state.dragN.toFixed(0)} N</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>{lang === 'ar' ? 'الصحة' : 'Health'}</span>
              <span className={`ma-num font-bold ${healthPct < 30 ? 'text-[var(--ma-bad)]' : 'text-[var(--ma-good)]'}`}>{healthPct}%</span>
            </div>
          </div>
        </HudFrame>
      </div>

      {/* RIGHT: Controls + settings */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <HudFrame tag="FLIGHT CONTROLS" tagAr="تحكم الطيران">
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#040914] border border-white/10">
              <span className="text-[10px] text-[var(--ma-muted)]">↑ ↓ Pitch</span>
              <span className="text-xs ma-num font-mono">{Math.round(input.steerY * 100)}%</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#040914] border border-white/10">
              <span className="text-[10px] text-[var(--ma-muted)]">← → Yaw</span>
              <span className="text-xs ma-num font-mono">{Math.round(input.steerX * 100)}%</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#040914] border border-white/10">
              <span className="text-[10px] text-[var(--ma-muted)]">Shift Throttle</span>
              <span className={`text-xs ma-num font-mono ${input.throttleUp ? 'text-[var(--ma-accent)]' : ''}`}>{input.throttleUp ? '▲' : ''}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#040914] border border-white/10">
              <span className="text-[10px] text-[var(--ma-muted)]">Space Engine</span>
              <span className={`text-xs ma-num font-mono ${input.engine ? 'text-[var(--ma-good)]' : ''}`}>{input.engine ? 'ON' : 'OFF'}</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="ma-tap py-2 rounded-xl border border-[var(--ma-accent)] bg-[rgba(61,224,255,0.15)] text-[var(--ma-accent)] text-[10px] font-bold uppercase"
              onClick={() => setPaused(!isPaused)}
            >
              ⏸ {lang === 'ar' ? 'إيقاف مؤقت' : 'Pause'}
            </button>
            <button
              type="button"
              className="ma-tap py-2 rounded-xl border border-[var(--ma-bad)] bg-[rgba(255,77,106,0.15)] text-[var(--ma-bad)] text-[10px] font-bold uppercase"
              onClick={() => restartMission()}
            >
              ↻ {lang === 'ar' ? 'إعادة التشغيل' : 'Restart'}
            </button>
          </div>
        </HudFrame>

        <HudFrame tag="SETTINGS" tagAr="الإعدادات">
          <div className="space-y-3">
            <label className="block text-[10px] uppercase tracking-wider text-[var(--ma-muted)]">
              {lang === 'ar' ? 'حساسية التوجيه' : 'Steering Sensitivity'}
            </label>
            <input
              type="range" min="0" max="1" step="0.1"
              value={settings.steeringSensitivity}
              onChange={(e) => setSetting('steeringSensitivity', Number(e.target.value))}
              className="w-full mt-1 ma-range"
            />
            <label className="block text-[10px] uppercase tracking-wider text-[var(--ma-muted)]">
              {lang === 'ar' ? 'استجابة التوجيه' : 'Steering Response'}
            </label>
            <input
              type="range" min="0" max="1" step="0.1"
              value={settings.steeringResponse}
              onChange={(e) => setSetting('steeringResponse', Number(e.target.value))}
              className="w-full mt-1 ma-range"
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.automaticSteering}
                onChange={(e) => setSetting('automaticSteering', e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-[10px]">{lang === 'ar' ? 'مساعدة تلقائية' : 'Automatic Steering'}</span>
            </div>
          </div>
        </HudFrame>
      </div>

      {/* CENTER-BOTTOM: full width stage timeline (maps to lg grid) */}
      <div className="lg:col-span-12">
        <HudFrame tag="MISSION STAGE TIMELINE" tagAr="خط زمني للمراحل" tight className="h-48">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-[var(--ma-accent)] uppercase">{lang === 'ar' ? 'المرحلة الحالية' : 'Current Stage'}</span>
            <span className="ma-num font-bold text-[var(--ma-good)]">{stage.name}</span>
          </div>
          <div className="relative h-6">
            <div className="absolute inset-x-0 top-1/2 h-1 rounded bg-[#141E3C]" />
            <div className="absolute top-1/2 h-1 rounded" style={{ width: `${progress * 100}%`, background: 'var(--ma-accent)', transition: 'width 0.3s linear' }} />
            {MISSION_STAGE_ORDER.map((sid, i) => {
              const f = (i + 1) / MISSION_STAGE_ORDER.length;
              const done = mission.stagesCompleted.includes(sid);
              const active = state.stage === sid;
              return (
                <div key={sid} className="absolute -translate-y-1/2 top-1/2 w-3 h-3 rounded-full border-2" style={{
                  left: `${f * 100}%`,
                  borderColor: active ? 'var(--ma-accent)' : done ? 'var(--ma-good)' : '#141E3C',
                  background: active ? 'var(--ma-accent)' : done ? 'var(--ma-good)' : 'transparent',
                  boxShadow: active ? '0 0 8px var(--ma-accent)' : 'none',
                }} />
              );
            })}
          </div>
        </HudFrame>
      </div>
    </div>
  );
}

const MISSION_STAGE_ORDER: FlightStageId[] = [
  'pre_launch', 'countdown', 'ignition', 'liftoff', 'ascent',
  'atmospheric_flight', 'stage_separation', 'orbital_insertion',
  'cruise', 'target_approach', 'target_acquisition', 'mission_completion',
];

function stageProgressIcon(stage: FlightStageId): string {
  const icons: Record<FlightStageId, string> = {
    pre_launch: '🔧', countdown: '⏱', ignition: '🔥', liftoff: '🚀',
    ascent: '⬆', atmospheric_flight: '🌐', stage_separation: '🔧',
    orbital_insertion: '🛰️', cruise: '🌌', target_approach: '🎯',
    target_acquisition: '✅', mission_completion: '🏆',
  };
  return icons[stage];
}

function missionProgress(mission: any): number {
  const order = MISSION_STAGE_ORDER;
  const idx = order.indexOf(mission.currentStage);
  return Math.max(0, Math.min(1, (idx + 1) / order.length));
}
