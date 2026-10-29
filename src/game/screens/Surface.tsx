/**
 * Surface — the playable planetary expedition.
 *
 * One slowly ticking survival simulation (real seconds → local hours), a
 * controllable astronaut in the 3D scene, resource gathering, suit upgrades and
 * a base the player builds module by module. All numbers come from the store;
 * this screen only drives input and renders the HUD.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useMission } from '../store';
import { useLang, useReducedMotion } from '../hooks';
import { PanelTag } from '../components/controls';
import { sound } from '../audio';
import {
  atBase,
  capacityLeft,
  canAfford,
  checkSolGoal,
  completeSolGoal,
  distanceToBase,
  hasModule,
  inventoryTotal,
  isNight,
  levelOf,
  localHour,
  nextUpgradeCost,
  solOf,
  suitEffects,
  surfaceTemp,
  type SurfaceNode,
} from '../surface/engine';
import {
  HOURS_PER_SECOND,
  MODULES,
  RESOURCES,
  RESOURCE_IDS,
  ROVER_COST,
  SURFACE_PROFILES,
  UPGRADES,
  costParts,
  type ModuleKind,
  type ResourceId,
  type SolGoal,
  type UpgradeId,
  type WeatherId,
} from '../surface/model';

const LazySurfaceView = lazy(() => import('../visual/SurfaceView'));

interface MoveInput {
  forward: number;
  back: number;
  left: number;
  right: number;
  run: boolean;
}

const SUIT_COLORS = ['#e9c37c', '#7fd8ff', '#ff8a6b', '#8ee08a', '#c39bff', '#f2f5fb'];

const WEATHER_LABELS: Record<WeatherId, { en: string; ar: string }> = {
  clear: { en: 'Clear', ar: 'صافي' },
  dust_storm: { en: 'Dust storm', ar: 'عاصفة غبارية' },
  radiation_spell: { en: 'Radiation spell', ar: 'موجة إشعاعية' },
  cold_snap: { en: 'Cold snap', ar: 'موجة برد' },
  heat_wave: { en: 'Heat wave', ar: 'موجة حار' },
  meteor_shower: { en: 'Meteor shower', ar: 'زخات نيرات' },
  solar_flare: { en: 'Solar flare', ar: 'وميض شمسي' },
  acid_rain: { en: 'Acid rain', ar: 'مطر حمضي' },
};

type Tab = 'suit' | 'base' | 'log';

function toneFor(v: number): string {
  if (v <= 22) return 'var(--ma-bad)';
  if (v <= 48) return 'var(--ma-warn)';
  return 'var(--ma-good)';
}

function Bar({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  const tone = invert ? (pct >= 60 ? 'var(--ma-bad)' : pct >= 35 ? 'var(--ma-warn)' : 'var(--ma-good)') : toneFor(pct);
  return (
    <div className="ma-suitbar">
      <span className="ma-suitbar-label">{label}</span>
      <div
        className="ma-suitbar-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${pct}%`, background: tone, boxShadow: `0 0 12px ${tone}` }} />
      </div>
      <b className="ma-num" style={{ color: tone }}>{Math.round(pct)}</b>
    </div>
  );
}

export function SurfaceScreen() {
  const lang = useLang();
  const reduced = useReducedMotion();
  const surface = useMission((s) => s.surface);
  const surfaceTick = useMission((s) => s.surfaceTick);
  const surfacePose = useMission((s) => s.surfacePose);
  const surfaceCollect = useMission((s) => s.surfaceCollect);
  const surfaceBuild = useMission((s) => s.surfaceBuild);
  const surfaceUpgrade = useMission((s) => s.surfaceUpgrade);
  const surfaceRepair = useMission((s) => s.surfaceRepair);
  const surfaceResupply = useMission((s) => s.surfaceResupply);
  const surfaceRename = useMission((s) => s.surfaceRename);
  const surfaceSuitColor = useMission((s) => s.surfaceSuitColor);
  const surfaceUnlockRover = useMission((s) => s.surfaceUnlockRover);
  const surfaceCheckSolGoal = useMission((s) => s.surfaceCheckSolGoal);
  const surfaceCompleteSolGoal = useMission((s) => s.surfaceCompleteSolGoal);
  const endExpedition = useMission((s) => s.endExpedition);
  const setScreen = useMission((s) => s.setScreen);

  const input = useRef<MoveInput>({ forward: 0, back: 0, left: 0, right: 0, run: false });
  const [near, setNear] = useState<SurfaceNode | null>(null);
  const [tab, setTab] = useState<Tab>('suit');
  const [callsignDraft, setCallsignDraft] = useState('');

  const profile = useMemo(
    () => SURFACE_PROFILES[surface?.target ?? 'earth'] ?? SURFACE_PROFILES.earth,
    [surface?.target],
  );

  const active = surface?.status === 'active';

  /* ------------------------------------------------------------ survival clock */
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => surfaceTick(HOURS_PER_SECOND), 1000);
    return () => window.clearInterval(id);
  }, [active, surfaceTick]);

  const doCollect = useCallback(() => {
    if (!near) return;
    surfaceCollect(near);
    setNear(null);
  }, [near, surfaceCollect]);

  /* --------------------------------------------------------------- keyboard */
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const i = input.current;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') { i.forward = 1; e.preventDefault(); }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') { i.back = 1; e.preventDefault(); }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') { i.left = 1; e.preventDefault(); }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') { i.right = 1; e.preventDefault(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') i.run = true;
      if (e.code === 'KeyE') doCollect();
    };
    const up = (e: KeyboardEvent) => {
      const i = input.current;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') i.forward = 0;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') i.back = 0;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') i.left = 0;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') i.right = 0;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') i.run = false;
    };
    const blur = () => {
      input.current = { forward: 0, back: 0, left: 0, right: 0, run: false };
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [doCollect]);

  if (!surface) {
    return (
      <div className="ma-panel p-8 text-center" data-screen="surface">
        <p className="text-sm text-[var(--ma-muted)]">
          {lang === 'ar' ? 'لا توجد بعثة سطحية نشطة.' : 'No surface expedition is active.'}
        </p>
        <button type="button" className="ma-pill ma-pill-accent mt-4" onClick={() => setScreen('missionSelect')}>
          {lang === 'ar' ? 'اختيار مهمة' : 'Mission select'}
        </button>
      </div>
    );
  }

  const effects = suitEffects(surface);
  const cargo = inventoryTotal(surface);
  const room = capacityLeft(surface);
  const dist = distanceToBase(surface);
  const inBase = atBase(surface);
  const sol = solOf(surface);
  const hour = localHour(profile, surface.hours);
  const temp = surfaceTemp(profile, surface.hours);
  const night = isNight(profile, surface.hours);
  const level = levelOf(surface);

  const Hh = Math.floor(hour);
  const Mm = Math.floor((hour - Hh) * 60);

  const hold = (key: keyof Omit<MoveInput, 'run'>, value: number) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      input.current[key] = value;
    },
    onPointerUp: () => { input.current[key] = 0; },
    onPointerCancel: () => { input.current[key] = 0; },
    onPointerLeave: () => { input.current[key] = 0; },
  });

  return (
    <div className="ma-enter flex flex-col gap-3" data-screen="surface">
      {/* ------------------------------------------------------------- scene */}
      <section className="relative ma-panel overflow-hidden">
        <div className="relative h-[48vh] min-h-[320px] sm:h-[56vh]">
          <Suspense
            fallback={
              <div className="absolute inset-0 grid place-items-center text-xs text-[var(--ma-muted)]">
                {lang === 'ar' ? 'جارٍ إنزال الفريق…' : 'Deploying the surface team…'}
              </div>
            }
          >
            <LazySurfaceView input={input} onPose={surfacePose} onNear={setNear} />
          </Suspense>

          {/* top strip */}
          <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <PanelTag ar="عمليات السطح" en="SURFACE OPS" />
              <p className="mt-1 text-[10px] uppercase tracking-[0.26em] text-white/75">
                {lang === 'ar' ? profile.nameAr : profile.nameEn}
              </p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--ma-gold)]">
                {surface.callsign} · LVL {level} · SOL {sol}
              </p>
            </div>
            <div className="text-right text-[10px] uppercase tracking-[0.16em] text-white/70">
              <div className="ma-num text-[var(--ma-gold)]">
                {String(Hh).padStart(2, '0')}:{String(Mm).padStart(2, '0')} {night ? '☾' : '☀'}
              </div>
              <div className="ma-num">{temp.toFixed(0)}°C · {profile.gravity.toFixed(2)} m/s²</div>
              <div className="ma-num" style={{ color: surface.weather === 'clear' ? 'var(--ma-good)' : 'var(--ma-warn)' }}>
                {lang === 'ar' ? WEATHER_LABELS[surface.weather].ar : WEATHER_LABELS[surface.weather].en}
              </div>
              {surface.currentSolGoal && (
                <div className="ma-num" style={{ color: 'var(--ma-accent)' }} title={surface.currentSolGoal.en}>
                  {lang === 'ar' ? surface.currentSolGoal.ar : surface.currentSolGoal.en}
                </div>
              )}
              <div className="ma-num" style={{ color: inBase ? 'var(--ma-good)' : 'var(--ma-muted)' }}>
                {inBase ? (lang === 'ar' ? 'داخل القاعدة' : 'AT BASE') : `${dist.toFixed(0)} m`}
              </div>
            </div>
          </div>

          {/* survival meters */}
          <div className="pointer-events-none absolute start-3 bottom-3 grid max-w-[162px] gap-1.5 sm:max-w-[340px]">
            <div className="ma-suit-bars">
              <Bar label={lang === 'ar' ? 'أكسجين' : 'O₂'} value={surface.o2} />
              <Bar label={lang === 'ar' ? 'ماء' : 'H₂O'} value={surface.water} />
              <Bar label={lang === 'ar' ? 'غذاء' : 'FOOD'} value={surface.food} />
              <Bar label={lang === 'ar' ? 'حرارة' : 'WARM'} value={surface.warmth} />
              <Bar label={lang === 'ar' ? 'بطارية' : 'PWR'} value={surface.charge} />
              <Bar label={lang === 'ar' ? 'إشعاع' : 'RAD'} value={surface.radiation} invert />
              <Bar label={lang === 'ar' ? 'سلامة البدلة' : 'SUIT'} value={surface.integrity} />
            </div>
          </div>

          {/* collection prompt */}
          {near && active && (
            <div className="absolute bottom-[150px] left-1/2 flex -translate-x-1/2 items-center gap-2 sm:bottom-3 sm:left-auto sm:end-3 sm:translate-x-0">
              <span
                className="ma-hudtag"
                style={{ color: RESOURCES.find((r) => r.id === near.kind)?.color, borderColor: 'currentColor' }}
              >
                {(() => {
                  const r = RESOURCES.find((x) => x.id === near.kind);
                  return lang === 'ar' ? r?.ar : r?.en;
                })()}
              </span>
              <button type="button" className="ma-pill ma-pill-accent ma-pill-sm" onClick={doCollect}>
                {lang === 'ar' ? 'E · جمع' : 'E · COLLECT'}
              </button>
            </div>
          )}

          {/* touch pad */}
          <div className="ma-dpad md:hidden" aria-label={lang === 'ar' ? 'تحكم المشي' : 'Walk controls'}>
            <button type="button" className="ma-dpad-key" aria-label="forward" {...hold('forward', 1)}>▲</button>
            <button type="button" className="ma-dpad-key" aria-label="left" {...hold('left', 1)}>◀</button>
            <button type="button" className="ma-dpad-key" aria-label="right" {...hold('right', 1)}>▶</button>
            <button type="button" className="ma-dpad-key" aria-label="back" {...hold('back', 1)}>▼</button>
            <button
              type="button"
              className="ma-dpad-key ma-dpad-run"
              aria-label="run"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                input.current.run = true;
              }}
              onPointerUp={() => { input.current.run = false; }}
              onPointerCancel={() => { input.current.run = false; }}
              onPointerLeave={() => { input.current.run = false; }}
            >
              <span aria-hidden>»</span>
            </button>
          </div>

          {reduced && (
            <p className="pointer-events-none absolute left-3 top-24 max-w-[180px] text-[9px] leading-snug text-white/55">
              {lang === 'ar' ? 'حركة مخففة: استخدم الأسهم.' : 'Reduced motion: arrow keys.'}
            </p>
          )}
        </div>
      </section>

      {/* --------------------------------------------------------- header row */}
      <section className="ma-panel flex flex-wrap items-center gap-2 p-3">
        <span className="ma-hudtag">{lang === 'ar' ? 'الفريق' : 'CREW'}</span>
        <input
          className="ma-input ma-callsign ma-num"
          value={callsignDraft || surface.callsign}
          maxLength={14}
          aria-label={lang === 'ar' ? 'اسم الفريق' : 'Callsign'}
          onChange={(e) => setCallsignDraft(e.target.value.toUpperCase())}
          onBlur={() => {
            if (callsignDraft.trim()) surfaceRename(callsignDraft);
            setCallsignDraft('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <div className="flex items-center gap-1.5">
          {SUIT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`ma-swatch ${surface.suitColor.toLowerCase() === c ? 'is-on' : ''}`}
              style={{ background: c }}
              aria-label={`${lang === 'ar' ? 'لون البدلة' : 'suit'} ${c}`}
              aria-pressed={surface.suitColor.toLowerCase() === c}
              onClick={() => surfaceSuitColor(c)}
            />
          ))}
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <span className="ma-hudtag">
            {lang === 'ar' ? 'شحن' : 'CARGO'} {cargo}/{effects.capacity}
          </span>
          <span className="ma-hudtag" style={{ color: room <= 0 ? 'var(--ma-bad)' : undefined }}>
            {lang === 'ar' ? 'متاح' : 'FREE'} {room}
          </span>
          <button type="button" className="ma-pill ma-pill-ghost ma-pill-sm" onClick={endExpedition}>
            {lang === 'ar' ? 'إنهاء البعثة' : 'END EXPEDITION'}
          </button>
        </div>
      </section>

      {/* --------------------------------------------------------------- tabs */}
      <div className="ma-tabrow" role="tablist" aria-label={lang === 'ar' ? 'لوحات البعثة' : 'Expedition panels'}>
        {(['suit', 'base', 'log'] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`ma-tab ${tab === id ? 'is-on' : ''}`}
            onClick={() => { setTab(id); sound.play('key'); }}
          >
            {id === 'suit'
              ? (lang === 'ar' ? 'البدلة' : 'SUIT')
              : id === 'base'
                ? (lang === 'ar' ? 'القاعدة' : 'BASE')
                : (lang === 'ar' ? 'السجل' : 'LOG')}
          </button>
        ))}
        <span className="ms-auto hidden items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--ma-muted)] sm:flex">
          {lang === 'ar' ? 'WASD للحركة · Shift للجري · E للجمع' : 'WASD move · Shift run · E collect'}
        </span>
      </div>

      {tab === 'suit' && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {UPGRADES.map((u) => {
            const level = surface.upgrades[u.id] ?? 0;
            const cost = nextUpgradeCost(surface, u.id as UpgradeId);
            const affordable = cost ? canAfford(surface, cost) : false;
            const maxed = level >= u.maxLevel;
            return (
              <div key={u.id} className="ma-panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--ma-ink)]">
                      {lang === 'ar' ? u.ar : u.en}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--ma-muted)]">
                      {lang === 'ar' ? u.descAr : u.descEn}
                    </p>
                  </div>
                  <span className="ma-mk ma-num">Mk {level}</span>
                </div>
                <div className="ma-pips mt-2" aria-hidden>
                  {Array.from({ length: u.maxLevel }, (_, i) => (
                    <i key={i} className={i < level ? 'is-on' : ''} />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {maxed ? (
                    <span className="ma-hudtag" style={{ color: 'var(--ma-good)' }}>
                      {lang === 'ar' ? 'أقصى مستوى' : 'MAX LEVEL'}
                    </span>
                  ) : (
                    <>
                      {costParts(cost ?? {}).map((p) => {
                        const def = RESOURCES.find((r) => r.id === p.id);
                        const have = surface.inventory[p.id] ?? 0;
                        return (
                          <span
                            key={p.id}
                            className="ma-costchip"
                            style={{ color: have >= p.amount ? def?.color : 'var(--ma-bad)' }}
                          >
                            {def?.tag} {p.amount}
                          </span>
                        );
                      })}
                      <button
                        type="button"
                        className={`ma-pill ma-pill-sm ms-auto ${affordable ? 'ma-pill-accent' : 'ma-pill-ghost'}`}
                        disabled={!affordable}
                        onClick={() => surfaceUpgrade(u.id as UpgradeId)}
                      >
                        {lang === 'ar' ? 'تطوير' : 'UPGRADE'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {tab === 'base' && (
        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {MODULES.map((m) => {
              const built = hasModule(surface, m.id as ModuleKind);
              const affordable = canAfford(surface, m.cost);
              return (
                <div key={m.id} className="ma-panel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold" style={{ color: built ? m.color : 'var(--ma-ink)' }}>
                      {lang === 'ar' ? m.ar : m.en}
                    </p>
                    <span className="ma-dot" style={{ background: built ? m.color : 'rgba(255,255,255,0.16)' }} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--ma-muted)]">{lang === 'ar' ? m.descAr : m.descEn}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {built ? (
                      <span className="ma-hudtag" style={{ color: 'var(--ma-good)' }}>
                        {lang === 'ar' ? 'يعمل' : 'ONLINE'}
                      </span>
                    ) : (
                      <>
                        {costParts(m.cost).map((p) => {
                          const def = RESOURCES.find((r) => r.id === p.id);
                          const have = surface.inventory[p.id] ?? 0;
                          return (
                            <span
                              key={p.id}
                              className="ma-costchip"
                              style={{ color: have >= p.amount ? def?.color : 'var(--ma-bad)' }}
                            >
                              {def?.tag} {p.amount}
                            </span>
                          );
                        })}
                        <button
                          type="button"
                          className={`ma-pill ma-pill-sm ms-auto ${affordable ? 'ma-pill-accent' : 'ma-pill-ghost'}`}
                          disabled={!affordable}
                          onClick={() => surfaceBuild(m.id as ModuleKind)}
                        >
                          {lang === 'ar' ? 'بناء' : 'BUILD'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ma-panel flex flex-col gap-3 p-4">
            <PanelTag ar="خدمات القاعدة" en="BASE SERVICES" />
            <p className="text-[11px] leading-relaxed text-[var(--ma-muted)]">
              {lang === 'ar'
                ? `الخدمات تعمل داخل ${9} م من المركبة. أنت الآن على ${dist.toFixed(0)} م.`
                : `Services work within 9 m of the lander. You are ${dist.toFixed(0)} m away.`}
            </p>
            <button
              type="button"
              className="ma-pill ma-pill-sm"
              disabled={!inBase || surface.status !== 'active'}
              onClick={surfaceResupply}
            >
              {lang === 'ar' ? 'إعادة تعبئة (3 جليد)' : 'RESUPPLY (3 ice)'}
            </button>
            <button
              type="button"
              className="ma-pill ma-pill-sm"
              disabled={surface.integrity >= 99.5}
              onClick={surfaceRepair}
            >
              {lang === 'ar' ? 'إصلاح البدلة (2 خام + 2 تربة)' : 'REPAIR SUIT (2 ore + 2 regolith)'}
            </button>
            <button
              type="button"
              className={`ma-pill ma-pill-sm ${surface.roverUnlocked ? 'ma-pill-ghost' : 'ma-pill-accent'}`}
              disabled={surface.roverUnlocked || surface.status !== 'active'}
              onClick={surfaceUnlockRover}
            >
              {surface.roverUnlocked
                ? (lang === 'ar' ? 'المركبة مفتوحة' : 'ROVER UNLOCKED')
                : lang === 'ar'
                  ? `فتح القفل للمركبة (${costParts(ROVER_COST).map((p) => `${p.amount} × ${RESOURCES.find((r) => r.id === p.id)?.tag}`).join(' + ')})`
                  : `UNLOCK ROVER (${costParts(ROVER_COST).map((p) => `${p.amount} × ${RESOURCES.find((r) => r.id === p.id)?.tag}`).join(' + ')})`}
            </button>
            {surface.currentSolGoal && (
              <div className="mt-2 p-3 rounded-lg border border-[color-mix(in_srgb,var(--ma-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--ma-accent)_10%,transparent)]">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--ma-accent)]">
                    {lang === 'ar' ? 'هدف اليوم الشمسي' : 'SOL GOAL'}
                  </span>
                  <button
                    type="button"
                    className="ma-pill ma-pill-sm ma-pill-accent"
                    onClick={surfaceCompleteSolGoal}
                    disabled={!checkSolGoal(surface).completed}
                  >
                    {lang === 'ar' ? 'إكمال' : 'COMPLETE'}
                  </button>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--ma-text)]">
                  {lang === 'ar' ? surface.currentSolGoal.ar : surface.currentSolGoal.en}
                </p>
                <div className="text-[9px] text-[var(--ma-muted)]">
                  {checkSolGoal(surface).completed ? (lang === 'ar' ? 'جاهز للإكمال' : 'Ready to complete') : ''}
                </div>
              </div>
            )}
            <div className="mt-auto grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--ma-muted)]">
              <span>{lang === 'ar' ? 'وحدات' : 'MODULES'} <b className="ma-num text-[var(--ma-gold)]">{surface.modules.length}/6</b></span>
              <span>{lang === 'ar' ? 'عيّنات' : 'SAMPLES'} <b className="ma-num text-[var(--ma-gold)]">{surface.gathered}</b></span>
              <span>{lang === 'ar' ? 'مسافة' : 'WALKED'} <b className="ma-num text-[var(--ma-gold)]">{surface.walked.toFixed(0)} m</b></span>
              <span>{lang === 'ar' ? 'خبرة' : 'XP'} <b className="ma-num text-[var(--ma-gold)]">{surface.xp}</b></span>
              <span>{lang === 'ar' ? 'المركبة' : 'ROVER'} <b className={`ma-num text-[var(--ma-gold)] ${surface.roverUnlocked ? 'text-[var(--ma-good)]' : ''}`}>{surface.roverUnlocked ? (lang === 'ar' ? 'مفتوحة' : 'UNLOCKED') : (lang === 'ar' ? 'مغلقة' : 'LOCKED')}</b></span>
            </div>
          </div>
        </section>
      )}

      {tab === 'log' && (
        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="ma-panel p-4">
            <PanelTag ar="سجل البعثة" en="EXPEDITION LOG" />
            <div className="ma-scroll mt-3 max-h-[320px] space-y-1.5 overflow-auto pe-1">
              {[...surface.log].reverse().map((e, i) => (
                <p key={`${e.h}-${i}`} className="flex gap-2 text-[11px]">
                  <span className="ma-num shrink-0 text-[var(--ma-muted)]">H{e.h.toFixed(0)}</span>
                  <span
                    style={{
                      color:
                        e.kind === 'good' ? 'var(--ma-good)'
                          : e.kind === 'warn' ? 'var(--ma-warn)'
                            : e.kind === 'bad' ? 'var(--ma-bad)'
                              : 'var(--ma-ink)',
                    }}
                  >
                    {e.msg}
                  </span>
                </p>
              ))}
            </div>
          </div>
          <div className="ma-panel p-4">
            <PanelTag ar="المخزون" en="INVENTORY" />
            <ul className="mt-3 space-y-2 text-[12px]">
              {RESOURCE_IDS.map((id: ResourceId) => {
                const def = RESOURCES.find((r) => r.id === id)!;
                return (
                  <li key={id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <i className="ma-dot" style={{ background: def.color }} />
                      {lang === 'ar' ? def.ar : def.en}
                    </span>
                    <b className="ma-num" style={{ color: def.color }}>{surface.inventory[id] ?? 0}</b>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--ma-muted)]">
              {lang === 'ar' ? profile.hazardAr : profile.hazardEn}
            </p>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- rescue */}
      {surface.status === 'rescued' && (
        <div className="ma-descent-outcome" role="status">
          <div className="ma-panel mx-auto max-w-md p-6 text-center">
            <PanelTag ar="استخراج طارئ" en="EMERGENCY EXTRACTION" />
            <h3 className="ma-title mt-2 text-2xl">
              {lang === 'ar' ? 'انتهت البعثة على السطح' : 'Surface expedition over'}
            </h3>
            <p className="mt-2 text-[12px] text-[var(--ma-muted)]">
              {lang === 'ar'
                ? `النجاة ${sol} يوم شمسي · ${surface.gathered} عيّنة · ${surface.modules.length} وحدة قاعدة.`
                : `Survived ${sol} sols · ${surface.gathered} samples · ${surface.modules.length} base modules.`}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" className="ma-pill ma-pill-accent" onClick={endExpedition}>
                {lang === 'ar' ? 'إغلاق البعثة' : 'CLOSE EXPEDITION'}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-[10px] text-[var(--ma-muted)]">
        {lang === 'ar'
          ? `ساعة سطحية = ثانيتان حقيقيتان · يوم كامل ≈ 48 ثانية · ${night ? 'ليل' : 'نهار'}`
          : `1 surface hour = 2 real seconds · a full sol ≈ 48 s · ${night ? 'night' : 'day'}`}
      </p>
    </div>
  );
}
