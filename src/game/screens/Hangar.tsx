/** Screen 2 — Hangar/Profile: blueprint bay, real performance, refit preview. */
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  useMission, MISSIONS, COMPONENTS, LAUNCHERS, lookupTables, previewValidation,
} from '../store';
import type { SpacecraftDesign, HangarTab } from '../store';
import { useLang, useT } from '../hooks';
import { Bi, HudFrame, Kpi, PanelTag, fmt } from '../components/controls';
import { Icon, Glyph, type IconName } from '../components/Icon';
import { levelForXp, xpForNextLevel, TECH_NODES, unlockedIdsFor } from '../tech';
import { sound } from '../audio';
import type { StringKey } from '../i18n';

/** v3 step 9 — the hangar bay reuses the design-driven builder bay (lazy). */
const LazyBuilderPreview = lazy(() => import('../visual/BuilderPreview'));
/** v3 step 9 — round cockpit window with the current target (lazy). */
const LazyCockpitView = lazy(() => import('../visual/CockpitView'));

const TABS: { id: HangarTab; label: StringKey; icon: IconName }[] = [
  { id: 'profile', label: 'profile', icon: 'user' },
  { id: 'hangar', label: 'hangar', icon: 'hangar' },
  { id: 'missions', label: 'missions', icon: 'missions' },
  { id: 'tech', label: 'tech', icon: 'tech' },
  { id: 'map', label: 'map', icon: 'globe' },
  { id: 'system', label: 'system', icon: 'settings' },
];

type BudgetLike = {
  totalMassKg: number;
  availableDvMps: number;
  requiredDvMps: number;
  propellantMassKg: number;
  reliability: number;
};

type Stat = { pct: number; text: string; tone?: 'good' | 'warn' | 'bad' };

/** Real performance figures derived from the engine's resolved budget. */
function statsFor(budget: BudgetLike, missionDv: number, thrustN: number, propellant: number, capacityKg: number) {
  const required = Math.max(1, missionDv || budget.requiredDvMps || 1);
  const dvRatio = budget.availableDvMps / required;
  const accel = budget.totalMassKg > 0 ? thrustN / budget.totalMassKg : 0;
  const fuelDen = capacityKg > 0 ? capacityKg : Math.max(1, propellant);
  const stats: Record<'speed' | 'maneuverability' | 'durability' | 'fuelCapacity', Stat> = {
    speed: {
      pct: Math.max(0, Math.min(100, dvRatio * 100)),
      text: `${Math.round(dvRatio * 100)}% Δv`,
      tone: dvRatio < 1 ? 'bad' : dvRatio < 1.08 ? 'warn' : 'good',
    },
    maneuverability: {
      pct: Math.max(0, Math.min(100, (accel / 0.5) * 100)),
      text: `${accel.toFixed(2)} m/s²`,
      tone: accel < 0.05 ? 'warn' : 'good',
    },
    durability: {
      pct: Math.max(0, Math.min(100, budget.reliability * 100)),
      text: `${(budget.reliability * 100).toFixed(1)}%`,
      tone: budget.reliability < 0.65 ? 'bad' : budget.reliability < 0.8 ? 'warn' : 'good',
    },
    fuelCapacity: {
      pct: Math.max(0, Math.min(100, (propellant / fuelDen) * 100)),
      text: `${propellant.toFixed(0)} / ${capacityKg.toFixed(0)} kg`,
      tone: propellant / fuelDen < 0.3 ? 'warn' : 'good',
    },
  };
  return stats;
}

function StatBar({ label, ar, stat, compare }: { label: string; ar: string; stat: Stat; compare?: Stat }) {
  const lang = useLang();
  const delta = compare ? compare.pct - stat.pct : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--ma-muted)]" title={ar}>{lang === 'ar' ? ar : label}</span>
        <span className="ma-num text-[11px] text-[var(--ma-text)]">
          {stat.text}
          {compare && Math.abs(delta) >= 0.5 && (
            <b className="ms-2" style={{ color: delta > 0 ? 'var(--ma-good)' : 'var(--ma-bad)' }}>
              {delta > 0 ? '+' : ''}{delta.toFixed(0)}%
            </b>
          )}
        </span>
      </div>
      <div className="ma-statbar mt-1.5" data-tone={stat.tone} role="meter" aria-label={label} aria-valuenow={Math.round(stat.pct)} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${stat.pct}%` }} />
      </div>
      {compare && (
        <div className="mt-1 flex items-center gap-1 text-[9px] text-[var(--ma-muted)]">
          <span className="inline-block h-px w-4 bg-[var(--ma-line)]" />
          {lang === 'ar' ? 'بعد التحديث' : 'after refit'}: <span className="ma-num">{compare.text}</span>
        </div>
      )}
    </div>
  );
}

export function HangarScreen() {
  const t = useT();
  const lang = useLang();
  const tab = useMission((s) => s.hangarTab);
  const setTab = useMission((s) => s.setHangarTab);
  const progress = useMission((s) => s.progress);
  const design = useMission((s) => s.design);
  const missionId = useMission((s) => s.missionId);
  const setScreen = useMission((s) => s.setScreen);
  const selectMission = useMission((s) => s.selectMission);
  const validate = useMission((s) => s.validate);

  const mission = MISSIONS.find((m) => m.id === missionId) ?? null;
  const tables = lookupTables();
  const lvl = levelForXp(progress.xp);
  const xp = xpForNextLevel(progress.xp);

  useEffect(() => { sound.startDrone(); return () => sound.stopDrone(); }, []);

  const onTab = (id: HangarTab) => {
    setTab(id);
    if (useMission.getState().settings.sound) sound.play('key');
  };

  return (
    <div className="ma-enter grid grid-cols-1 xl:grid-cols-[306px_1fr_330px] gap-4">
      {/* Commander card */}
      <HudFrame tag="COMMANDER" tagAr="القائد">
        <div className="flex items-center gap-3">
          <div
            className="grid h-16 w-16 place-items-center rounded-2xl border border-[color-mix(in_srgb,var(--ma-accent)_45%,transparent)]"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--ma-accent) 26%, transparent), rgba(6,12,26,0.9))', color: 'var(--ma-accent)', boxShadow: '0 0 32px color-mix(in srgb, var(--ma-accent) 25%, transparent)' }}
          >
            <Icon name="user" size={30} />
          </div>
          <div>
            <Bi ar="قائد المهمة" en="Mission Director" />
            <div className="ma-num text-[var(--ma-accent)] text-sm">
              {t('level')} {lvl} · {progress.xp} {t('xp')}
            </div>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-[#141E3C] overflow-hidden" role="progressbar" aria-valuenow={xp.current} aria-valuemax={xp.needed}>
          <div className="h-full" style={{ width: `${(xp.current / xp.needed) * 100}%`, background: 'linear-gradient(90deg, var(--ma-accent), var(--ma-good))', transition: 'width 0.9s ease-out' }} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Kpi ar="الرصيد" en="Credits" value={fmt(progress.credits)} accent="var(--ma-good)" />
          <Kpi ar="الأوسمة" en="Badges" value={progress.badges.length} accent="var(--ma-accent)" />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {progress.badges.length === 0 && <span className="text-[11px] text-[var(--ma-muted)]">{lang === 'ar' ? 'لا أوسمة بعد — أطلق مهمة!' : 'No badges yet — fly a mission!'}</span>}
          {progress.badges.map((b) => (
            <span key={b} className="badge-px" title={b}>{b}</span>
          ))}
        </div>

        {/* Section tabs — icon + label, real store tab. */}
        <div className="mt-4 grid grid-cols-3 gap-1.5" role="tablist" aria-label="Hangar sections">
          {TABS.map((tb) => {
            const on = tab === tb.id;
            return (
              <button
                key={tb.id}
                role="tab"
                aria-selected={on}
                type="button"
                className={`ma-tap flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2 text-[9px] uppercase tracking-[0.1em] transition-colors ${on
                  ? 'border-[color-mix(in_srgb,var(--ma-accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--ma-accent)_11%,transparent)] text-[var(--ma-accent)]'
                  : 'border-[var(--ma-line)] text-[var(--ma-muted)] hover:text-[var(--ma-text)] hover:border-[color-mix(in_srgb,var(--ma-accent)_35%,var(--ma-line))]'}`}
                onClick={() => onTab(tb.id)}
              >
                <Icon name={tb.icon} size={17} />
                <span>{t(tb.label)}</span>
              </button>
            );
          })}
        </div>
      </HudFrame>

      {/* Center stage */}
      <div className="flex flex-col gap-4 min-w-0">
        {tab === 'hangar' && (
          <>
            <section className="ma-panel overflow-hidden" aria-label={t('hangar')}>
              <header className="-mt-1 mb-3 flex flex-wrap items-center justify-between gap-2">
                <PanelTag ar="حجرة المركبة" en="SPACECRAFT BAY" />
                <span className="ma-status" data-tone={validate?.go ? 'good' : 'warn'}>
                  <i />{validate?.go ? (lang === 'ar' ? 'جاهزة للإطلاق' : 'Flight ready') : (lang === 'ar' ? 'بانتظار التحقق' : 'Awaiting validation')}
                </span>
              </header>

              <div className="ma-blueprint relative min-h-[420px] overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--ma-accent)_18%,var(--ma-line))]">
                <Suspense
                  fallback={
                    <div className="ma-loading">
                      <span className="ma-loading-ring" aria-hidden />
                      <span>{lang === 'ar' ? 'جارٍ تحميل الحظيرة' : 'Loading bay'}</span>
                    </div>
                  }
                >
                  <LazyBuilderPreview />
                </Suspense>

                {/* technical blueprint annotations — real component / mass data */}
                <div className="pointer-events-none absolute inset-0">
                  <svg className="absolute inset-0 h-full w-full" aria-hidden>
                    <g className="ma-dim">
                      <line x1="16%" y1="13%" x2="84%" y2="13%" markerStart="url(#ma-dim-a)" markerEnd="url(#ma-dim-a)" />
                      <line x1="16%" y1="10.5%" x2="16%" y2="15.5%" />
                      <line x1="84%" y1="10.5%" x2="84%" y2="15.5%" />
                      <line x1="93%" y1="26%" x2="93%" y2="74%" markerStart="url(#ma-dim-a)" markerEnd="url(#ma-dim-a)" />
                      <line x1="90.5%" y1="26%" x2="95.5%" y2="26%" />
                      <line x1="90.5%" y1="74%" x2="95.5%" y2="74%" />
                      <defs>
                        <marker id="ma-dim-a" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                          <path d="M3 0v6M0 3h6" stroke="currentColor" strokeWidth="0.8" fill="none" />
                        </marker>
                      </defs>
                    </g>
                    <text x="50%" y="8.5%" textAnchor="middle" className="ma-annot" style={{ fontSize: 8.5 }} fill="currentColor">
                      {validate ? `MASS ${fmt(validate.budget.totalMassKg)} / ${fmt(validate.budget.launcherCapacityKg)} KG` : 'MASS — / — KG'}
                    </text>
                    <text x="95%" y="50%" textAnchor="middle" className="ma-annot" style={{ fontSize: 8.5 }} fill="currentColor" transform="rotate(90 95 50)">
                      {validate ? `ΔV ${fmt(validate.budget.availableDvMps)} M/S` : 'ΔV — M/S'}
                    </text>
                  </svg>

                  <div className="absolute start-3 top-3 max-w-[46%] space-y-1">
                    <div className="ma-annot">PRIMARY BUS</div>
                    <div className="text-[11px] text-[var(--ma-text)]">{design.components.bus ? (lang === 'ar' ? tables.components[design.components.bus]?.nameAr ?? tables.components[design.components.bus]?.name : tables.components[design.components.bus]?.name) : '—'}</div>
                    <div className="ma-annot mt-2">POWER</div>
                    <div className="text-[11px] text-[var(--ma-text)]">{design.components.power ? (lang === 'ar' ? tables.components[design.components.power]?.nameAr ?? tables.components[design.components.power]?.name : tables.components[design.components.power]?.name) : '—'}</div>
                  </div>

                  <div className="absolute end-3 bottom-3 max-w-[45%] text-end space-y-1">
                    <div className="ma-annot">PROPULSION</div>
                    <div className="text-[11px] text-[var(--ma-text)]">{design.components.propulsion ? (lang === 'ar' ? tables.components[design.components.propulsion]?.nameAr ?? tables.components[design.components.propulsion]?.name : tables.components[design.components.propulsion]?.name) : '—'}</div>
                    <div className="ma-annot mt-2">COMMS</div>
                    <div className="text-[11px] text-[var(--ma-text)]">{design.components.comms ? (lang === 'ar' ? tables.components[design.components.comms]?.nameAr ?? tables.components[design.components.comms]?.name : tables.components[design.components.comms]?.name) : '—'}</div>
                  </div>
                </div>

                {validate && (
                  <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-[color-mix(in_srgb,var(--ma-line)_80%,transparent)] bg-[rgba(4,9,20,0.72)] px-3 py-2 text-[10px] ma-num backdrop-blur-sm">
                    <span>{t('mass')} <b className="text-[var(--ma-text)]">{fmt(validate.budget.totalMassKg)} kg</b></span>
                    <span>{t('power')} <b className="text-[var(--ma-text)]">{fmt(validate.budget.generationW)} W</b></span>
                    <span>{t('cost')} <b className="text-[var(--ma-text)]">{fmt(validate.budget.costTotal)}</b></span>
                    <span>{t('risk')} <b style={{ color: validate.budget.reliability < 0.8 ? 'var(--ma-warn)' : 'var(--ma-good)' }}>{((1 - validate.budget.reliability) * 100).toFixed(0)}%</b></span>
                  </div>
                )}
              </div>
            </section>

            <PerformancePanel missionDv={mission?.requiredDvMps ?? 0} />
            <RefitPanel />
          </>
        )}

        {tab === 'missions' && (
          <HudFrame tag="MISSION BOARD" tagAr="لوحة المهام">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {MISSIONS.map((m) => {
                const done = progress.completed[m.id];
                return (
                  <button
                    key={m.id}
                    type="button"
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ma-line)] px-3 py-2 text-start transition-colors hover:border-[var(--ma-accent)]"
                    onClick={() => { selectMission(m.id); }}
                  >
                    <span className="min-w-0">
                      <Bi ar={m.nameAr ?? m.name} en={m.name} />
                      {done && <span className="ma-num mt-1 block text-[10px] text-[var(--ma-good)]">{t('score')}: {done.score.toFixed(0)} · {done.grade}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1" aria-label={`${t('difficulty')} ${m.difficultyStars}/5`}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Icon key={i} name="star" size={9} className={i < m.difficultyStars ? 'text-[var(--ma-warn)]' : 'text-[var(--ma-line)]'} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </HudFrame>
        )}

        {tab === 'profile' && (
          <HudFrame tag="SERVICE RECORD" tagAr="السجل">
            <h3 className="text-sm uppercase tracking-widest text-[var(--ma-muted)] mb-2">{t('leaderboard')}</h3>
            <ol className="space-y-1.5">
              {Object.entries(progress.completed)
                .sort((a, b) => b[1].score - a[1].score)
                .slice(0, 10)
                .map(([id, rec], i) => (
                  <li key={id} className="flex items-center gap-3 text-sm">
                    <span className="ma-num w-6 text-[var(--ma-muted)]">{i + 1}</span>
                    <span className="flex-1">{MISSIONS.find((m) => m.id === id)?.name ?? id}</span>
                    <span className="ma-num text-[var(--ma-accent)]">{rec.score.toFixed(0)}</span>
                    <span className="ma-num text-[var(--ma-muted)]">{rec.grade}</span>
                  </li>
                ))}
              {Object.keys(progress.completed).length === 0 && <li className="text-[var(--ma-muted)] text-sm">{lang === 'ar' ? 'لا نتائج بعد.' : 'No results yet.'}</li>}
            </ol>
          </HudFrame>
        )}

        {tab === 'tech' && (
          <HudFrame tag="TECH SUMMARY" tagAr="ملخص التقنية">
            <ul className="space-y-2">
              {TECH_NODES.map((n) => {
                const on = progress.unlockedTech.includes(n.id);
                return (
                  <li key={n.id} className="flex items-center justify-between gap-3">
                    <Bi ar={n.nameAr} en={n.name} />
                    <span className={on ? 'text-[var(--ma-good)]' : 'text-[var(--ma-muted)]'}>
                      <Icon name={on ? 'check' : 'close'} size={15} />
                    </span>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="ma-pill ma-pill-ghost ma-pill-sm mt-4" onClick={() => setScreen('techTree')}>
              <Icon name="tech" size={14} />
              {t('techTree')}
            </button>
          </HudFrame>
        )}

        {tab === 'map' && <SolarMap />}
        {tab === 'system' && <SystemPanel />}
      </div>

      {/* Right column: current mission + cockpit window */}
      <div className="flex flex-col gap-4">
        <HudFrame tag="CURRENT MISSION" tagAr="المهمة الحالية">
          {mission ? (
            <>
              <Bi ar={mission.nameAr ?? mission.name} en={mission.name} />
              <dl className="mt-3 space-y-1.5 text-[12px]">
                <Row k={t('target')} v={mission.target.toUpperCase()} />
                <Row k={t('site')} v={lang === 'ar' ? mission.launchSiteAr ?? '—' : mission.launchSite ?? '—'} />
                <Row k={t('window')} v={lang === 'ar' ? mission.launchWindowAr ?? '—' : mission.launchWindow ?? '—'} />
                <Row k={t('duration')} v={`${mission.durationDays} ${t('days')}`} />
                <Row k={t('dv')} v={`${mission.requiredDvMps} m/s`} />
              </dl>
              <div className="mt-4 flex gap-2">
                <button type="button" className="ma-pill ma-pill-accent ma-pill-sm flex-1" onClick={() => setScreen('builder')}>
                  <Icon name="builder" size={14} />
                  {t('builder')}
                </button>
                <button type="button" className="ma-pill ma-pill-ghost ma-pill-sm" onClick={() => { if (validate?.go) useMission.getState().beginLaunch(); else setScreen('builder'); }}>
                  {t('launch')}
                </button>
              </div>
            </>
          ) : (
            <div className="text-sm text-[var(--ma-muted)]">
              {lang === 'ar' ? 'لا مهمة مختارة.' : 'No mission selected.'}
              <button type="button" className="ma-pill ma-pill-ghost ma-pill-sm mt-3" onClick={() => setScreen('missionSelect')}>
                <Icon name="missions" size={14} />
                {t('missionSelect')}
              </button>
            </div>
          )}
        </HudFrame>

        <HudFrame tag="COCKPIT" tagAr="قمرة القيادة" tight>
          <div className="relative aspect-square rounded-full overflow-hidden border-2 border-[var(--ma-line)] bg-[#03071a]">
            <Suspense
              fallback={
                <div className="ma-loading">
                  <span className="ma-loading-ring" aria-hidden />
                  <span>{lang === 'ar' ? 'قمرة القيادة' : 'Cockpit'}</span>
                </div>
              }
            >
              <LazyCockpitView />
            </Suspense>
            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 80px 24px rgba(5,7,15,0.9)' }} />
          </div>
          <p className="text-center text-[10px] uppercase tracking-widest text-[var(--ma-muted)] mt-2">
            {mission ? (lang === 'ar' ? `عرض ${mission.target}` : `View: ${mission.target}`) : 'standby'}
          </p>
        </HudFrame>
      </div>
    </div>
  );
}

/* ---------------- Real performance + refit preview ---------------- */
function PerformancePanel({ missionDv }: { missionDv: number }) {
  const t = useT();
  const lang = useLang();
  const validate = useMission((s) => s.validate);
  const design = useMission((s) => s.design);
  const tables = lookupTables();
  const prop = design.components.propulsion ? tables.components[design.components.propulsion] : null;
  if (!validate) {
    return (
      <HudFrame tag="PERFORMANCE" tagAr="الأداء">
        <p className="text-[12px] text-[var(--ma-muted)]">{lang === 'ar' ? 'اختر مهمة لتحميل أرقام الأداء الحقيقية.' : 'Select a mission to load real performance figures.'}</p>
      </HudFrame>
    );
  }
  const stats = statsFor(validate.budget, missionDv, prop?.thrustN ?? 0, design.propellantMassKg, prop?.propCapacityKg ?? 0);
  return (
    <HudFrame tag="PERFORMANCE" tagAr="الأداء">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatBar label="SPEED" ar={t('speed')} stat={stats.speed} />
        <StatBar label="MANEUVERABILITY" ar={t('maneuverability')} stat={stats.maneuverability} />
        <StatBar label="DURABILITY" ar={t('durability')} stat={stats.durability} />
        <StatBar label="FUEL CAPACITY" ar={t('fuelCapacity')} stat={stats.fuelCapacity} />
      </div>
    </HudFrame>
  );
}

function RefitPanel() {
  const t = useT();
  const lang = useLang();
  const design = useMission((s) => s.design);
  const validate = useMission((s) => s.validate);
  const progress = useMission((s) => s.progress);
  const setComponent = useMission((s) => s.setComponent);
  const missionId = useMission((s) => s.missionId);
  const mission = MISSIONS.find((m) => m.id === missionId) ?? null;
  const [installed, setInstalled] = useState<string | null>(null);

  const un = useMemo(() => unlockedIdsFor(progress.unlockedTech).components, [progress.unlockedTech]);
  const candidate = useMemo(() => {
    return COMPONENTS
      .filter((c) => c.category === 'propulsion' && un.has(c.id) && c.id !== design.components.propulsion)
      .sort((a, b) => (b.tier ?? 1) - (a.tier ?? 1) || (b.ispS ?? 0) - (a.ispS ?? 0))[0] ?? null;
  }, [un, design.components.propulsion]);

  if (!validate || !candidate) return null;

  const currentProp = design.components.propulsion ? lookupTables().components[design.components.propulsion] : null;
  const previewDesign: SpacecraftDesign = {
    ...design,
    components: { ...design.components, propulsion: candidate.id },
    propellantMassKg: Math.min(design.propellantMassKg, candidate.propCapacityKg ?? design.propellantMassKg),
  };
  let preview = null;
  try { preview = previewValidation(previewDesign).budget; } catch { preview = null; }

  const current = statsFor(validate.budget, mission?.requiredDvMps ?? 0, currentProp?.thrustN ?? 0, design.propellantMassKg, currentProp?.propCapacityKg ?? 0);
  const next = preview ? statsFor(preview, mission?.requiredDvMps ?? 0, candidate.thrustN ?? 0, previewDesign.propellantMassKg, candidate.propCapacityKg ?? 0) : null;

  const install = () => {
    setComponent('propulsion', candidate.id);
    setInstalled(candidate.id);
    window.setTimeout(() => setInstalled(null), 1400);
    if (useMission.getState().settings.sound) sound.play('confirm');
  };

  return (
    <HudFrame tag="REFIT BAY" tagAr="حجرة التحديث">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ma-annot">WHAT-IF · PROPULSION</span>
            <span className="ma-status" data-tone="accent"><i />{t('available')}</span>
          </div>
          <p className="mt-1.5 text-[12px] text-[var(--ma-text)]">
            {lang === 'ar' ? candidate.nameAr ?? candidate.name : candidate.name}
            <span className="ms-2 ma-num text-[10px] text-[var(--ma-muted)]">ISP {candidate.ispS ?? '—'} s · {candidate.massKg} kg</span>
          </p>
          <p className="mt-1 max-w-lg text-[11px] text-[var(--ma-muted)]">
            {lang === 'ar' ? candidate.descriptionAr ?? candidate.description : candidate.description}
          </p>
        </div>
        <button
          type="button"
          className={`ma-pill ma-pill-sm ${installed ? '' : 'ma-pill-accent'}`}
          data-tone={installed ? 'good' : undefined}
          onClick={install}
        >
          <Icon name={installed ? 'check' : 'wrench'} size={14} />
          {installed ? t('equipped') : t('installRefit')}
        </button>
      </div>

      {next && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatBar label="SPEED" ar={t('speed')} stat={current.speed} compare={next.speed} />
          <StatBar label="MANEUVERABILITY" ar={t('maneuverability')} stat={current.maneuverability} compare={next.maneuverability} />
          <StatBar label="DURABILITY" ar={t('durability')} stat={current.durability} compare={next.durability} />
          <StatBar label="FUEL CAPACITY" ar={t('fuelCapacity')} stat={current.fuelCapacity} compare={next.fuelCapacity} />
        </div>
      )}
      <p className="mt-3 text-[10px] text-[var(--ma-muted)]">
        {lang === 'ar'
          ? 'القيم محسوبة بنفس محرك التحقق. التثبيت يحدّث التصميم فورًا وقد يتطلب إعادة ضبط الوقود في المخزن.'
          : 'Values come from the same validation engine. Installing updates the design immediately and may require re-balancing propellant in the builder.'}
      </p>
    </HudFrame>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-[var(--ma-muted)] uppercase tracking-wider text-[10px]">{k}</dt>
      <dd className="ma-num text-right">{v}</dd>
    </div>
  );
}

/* ---------------- Solar map (SVG) ---------------- */
function SolarMap() {
  const progress = useMission((s) => s.progress);
  const setScreen = useMission((s) => s.setScreen);
  const selectMission = useMission((s) => s.selectMission);
  const lang = useLang();
  const bodies = [
    { id: 'earth', label: 'Earth / LEO', x: 70, r: 13, missions: ['cubesat_imaging', 'polar_climate'] },
    { id: 'gto', label: 'GTO / GEO', x: 150, r: 10, missions: ['comsat_gto'] },
    { id: 'venus', label: 'Venus', x: 215, r: 10, missions: ['venus_climate'] },
    { id: 'moon', label: 'Moon', x: 280, r: 8, missions: ['lunar_probe'] },
    { id: 'eros', label: 'Eros', x: 345, r: 4, missions: ['eros_rendezvous'] },
    { id: 'mars', label: 'Mars', x: 410, r: 11, missions: ['mars_orbiter', 'curiosity_style'] },
    { id: 'jupiter', label: 'Jupiter', x: 500, r: 17, missions: ['jupiter_probe', 'voyager_style'] },
    { id: 'europa', label: 'Europa', x: 555, r: 5, missions: ['europa_mission'] },
    { id: 'titan', label: 'Titan', x: 620, r: 8, missions: ['titan_explorer'] },
  ];
  const colors: Record<string, string> = { earth: '#3DE0FF', gto: '#2F9CFF', venus: '#FFC55A', moon: '#9AD1FF', eros: '#C9B29B', mars: '#FF6A3D', jupiter: '#A77BFF', europa: '#D9C6FF', titan: '#E8A03D' };
  return (
    <HudFrame tag="SOLAR MAP" tagAr="خريطة النظام الشمسي">
      <div className="ma-blueprint rounded-xl p-2">
        <svg viewBox="0 0 640 220" className="relative z-10 w-full" role="img" aria-label="Solar system mission map">
          {bodies.map((b, i) => {
            const done = b.missions.some((m) => progress.completed[m]);
            return (
              <g key={b.id} className="cursor-pointer" onClick={() => { const first = b.missions[0]; selectMission(first); }}>
                <circle cx={b.x} cy={110} r={b.r} fill={colors[b.id]} opacity={0.85} />
                <circle cx={b.x} cy={110} r={b.r + 8} fill="none" stroke={colors[b.id]} strokeOpacity="0.3" strokeDasharray="3 4" />
                <text x={b.x} y={110 + b.r + 22} textAnchor="middle" fontSize="10" fill="#8FA3C8">{b.label}</text>
                {done && (
                  <Glyph name="check" x={b.x} y={110 - b.r - 12} size={12} color="#2FE39A" />
                )}
                {i > 0 && <line x1={bodies[i - 1].x} y1={110} x2={b.x} y2={110} stroke="#1B2A50" strokeDasharray="4 6" />}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-[10px] text-[var(--ma-muted)] mt-2">{lang === 'ar' ? 'انقر على جسم لتحميل مهمته. المسافات ليست بمقياس رسم (ملاحظة تعليمية).' : 'Click a body to load its mission. Distances not to scale (education note).'}</p>
      <button type="button" className="ma-pill ma-pill-ghost ma-pill-sm mt-2" onClick={() => setScreen('missionSelect')}>
        <Icon name="missions" size={13} />
        {lang === 'ar' ? 'كل المهام' : 'All missions'}
      </button>
    </HudFrame>
  );
}

/* ---------------- System / settings + teacher + keybinds ---------------- */
function SystemPanel() {
  const t = useT();
  const lang = useLang();
  const settings = useMission((s) => s.settings);
  const setSetting = useMission((s) => s.setSetting);
  const setKeybinding = useMission((s) => s.setKeybinding);
  const resetProgress = useMission((s) => s.resetProgress);
  const difficulty = useMission((s) => s.difficulty);
  const setDifficulty = useMission((s) => s.setDifficulty);
  const progress = useMission((s) => s.progress);
  const [listening, setListening] = useState<string | null>(null);

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      setKeybinding(listening, e.code);
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening, setKeybinding]);

  const binds = Object.entries(settings.keybindings);
  const exportSave = useMission((s) => s.exportSave);
  const importSave = useMission((s) => s.importSave);
  const pushToast = useMission((s) => s.pushToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importNote, setImportNote] = useState<{ ok: boolean; text: string } | null>(null);

  const handleExport = () => {
    try {
      const blob = new Blob([exportSave()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.href = url;
      a.download = `orbital-save-${stamp}.json`;
      a.rel = 'noopener';
      a.click();
      URL.revokeObjectURL(url);
      pushToast(t('exportProgress'), 'good');
    } catch {
      pushToast(t('saveImportFailed'), 'bad');
    }
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const res = importSave(await file.text());
      setImportNote({ ok: res.ok, text: res.message });
      pushToast(res.ok ? t('saveImported') : t('saveImportFailed'), res.ok ? 'good' : 'bad');
    } catch {
      setImportNote({ ok: false, text: lang === 'ar' ? 'تعذّر قراءة الملف.' : 'Could not read that file.' });
      pushToast(t('saveImportFailed'), 'bad');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <HudFrame tag="SETTINGS" tagAr="الإعدادات">
        <div className="space-y-3 text-sm">
          <label className="flex items-center justify-between gap-3">
            <span>{t('language')}</span>
            <select className="ma-input" value={settings.lang} onChange={(e) => setSetting('lang', e.target.value as 'en' | 'ar')} aria-label={t('language')}>
              <option value="en">English (LTR)</option>
              <option value="ar">العربية (RTL)</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>{t('difficulty')}</span>
            <select className="ma-input" value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)} aria-label={t('difficulty')}>
              <option value="tutorial">{lang === 'ar' ? 'تعليمي' : 'Tutorial'}</option>
              <option value="normal">{lang === 'ar' ? 'عادي' : 'Normal'}</option>
              <option value="engineer">{lang === 'ar' ? 'مهندس' : 'Engineer'}</option>
              <option value="director">{lang === 'ar' ? 'مدير المهمة' : 'Mission Director'}</option>
            </select>
          </label>
          <label className="ma-settingrow flex items-center justify-between gap-3">
            <span>{t('quality')}</span>
            <select className="ma-input" value={settings.quality} onChange={(e) => setSetting('quality', e.target.value as 'low' | 'medium' | 'high')} aria-label={t('quality')}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="ma-settingrow flex items-center justify-between gap-3">
            <span>{t('sound')}</span>
            <input type="checkbox" checked={settings.sound} onChange={(e) => setSetting('sound', e.target.checked)} aria-label={t('sound')} />
          </label>

          {/* Real audio buses: master / effects / ambience. */}
          <div className="space-y-2 rounded-lg border border-[var(--ma-line)] p-2.5">
            {([
              { key: 'volume' as const, label: t('volume'), icon: 'volume' as IconName },
              { key: 'effectsVolume' as const, label: t('soundEffects'), icon: 'spark' as IconName },
              { key: 'ambienceVolume' as const, label: t('ambience'), icon: 'orbit' as IconName },
            ]).map((s) => (
              <label key={s.key} className="block">
                <span className="flex items-center justify-between text-[11px] uppercase tracking-wider text-[var(--ma-muted)]">
                  <span className="inline-flex items-center gap-1.5"><Icon name={s.icon} size={12} />{s.label}</span>
                  <span className="ma-num">{Math.round(settings[s.key] * 100)}%</span>
                </span>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={settings[s.key]}
                  onChange={(e) => setSetting(s.key, Number(e.target.value))}
                  aria-label={s.label}
                  className="mt-1 w-full ma-range"
                />
              </label>
            ))}
          </div>

          <label className="ma-settingrow flex items-center justify-between gap-3">
            <span>{t('reducedMotion')}</span>
            <input type="checkbox" checked={settings.reducedMotion} onChange={(e) => setSetting('reducedMotion', e.target.checked)} aria-label={t('reducedMotion')} />
          </label>
          <label className="ma-settingrow flex items-center justify-between gap-3">
            <span>{t('learnMode')}</span>
            <input type="checkbox" checked={settings.learnMode} onChange={(e) => setSetting('learnMode', e.target.checked)} aria-label={t('learnMode')} />
          </label>
          <label className="ma-settingrow flex items-center justify-between gap-3">
            <span>{t('teacherMode')}</span>
            <input type="checkbox" checked={settings.teacherMode} onChange={(e) => setSetting('teacherMode', e.target.checked)} aria-label={t('teacherMode')} />
          </label>
        </div>
        {settings.teacherMode && (
          <div className="mt-4 p-3 rounded-lg border border-[var(--ma-line)]">
            <h4 className="text-xs uppercase tracking-widest text-[var(--ma-muted)] mb-2">{t('teacherMode')} — {lang === 'ar' ? 'نتائج الطلاب' : 'Class results'}</h4>
            <ul className="text-[12px] space-y-1">
              {Object.entries(progress.completed).map(([id, rec]) => (
                <li key={id} className="flex justify-between"><span>{id}</span><span className="ma-num">{rec.score.toFixed(0)} {rec.grade}</span></li>
              ))}
              {Object.keys(progress.completed).length === 0 && <li className="text-[var(--ma-muted)]">{lang === 'ar' ? 'لا نتائج بعد.' : 'No results yet.'}</li>}
            </ul>
          </div>
        )}
        <button type="button" className="ma-tap mt-4 px-3 py-2 rounded-lg border border-[var(--ma-bad)] text-[var(--ma-bad)] text-xs uppercase tracking-wider" onClick={resetProgress}>
          {t('resetProgress')}
        </button>
      </HudFrame>

      <HudFrame tag="KEY BINDINGS" tagAr="تخصيص الأزرار">
        <p className="text-[11px] text-[var(--ma-muted)] mb-3">{lang === 'ar' ? 'اضغط زرًا ثم اضغط المفتاح الجديد.' : 'Click a key, then press the new key.'}</p>
        <div className="grid grid-cols-2 gap-2 max-h-[340px] overflow-auto ma-scroll pr-1">
          {binds.map(([cmd, code]) => (
            <button
              key={cmd}
              type="button"
              className={`ma-tap flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${listening === cmd ? 'border-[var(--ma-warn)] text-[var(--ma-warn)]' : 'border-[var(--ma-line)] hover:border-[var(--ma-accent)]'}`}
              onClick={() => setListening(cmd)}
              aria-label={`${cmd} bound to ${code}`}
            >
              <span className="uppercase tracking-wider">{cmd}</span>
              <span className="ma-num text-[var(--ma-accent)]">{listening === cmd ? t('pressKey') : code}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-[var(--ma-muted)]">
          {lang === 'ar' ? 'Gamepad: A=تأكيد، B=رجوع، X=مسح، Y=تسريع، RT=إطلاق، LT=حماية، D-pad=تنقل.' : 'Gamepad: A=confirm, B=back, X=scan, Y=warp, RT=fire, LT=shield, D-pad=move.'}
        </p>
      </HudFrame>

      <HudFrame tag="SAVE BACKUP" tagAr="نسخة الحفظ" className="lg:col-span-2">
        <p className="text-[11px] text-[var(--ma-muted)]">
          {lang === 'ar'
            ? 'يُحفظ تقدمك تلقائيًا في هذا المتصفح، بما في ذلك المهمة الجارية. صدّر ملفًا للاحتفاظ بنسخة أو لنقل الحملة إلى جهاز آخر.'
            : 'Your progress autosaves in this browser, including the mission in flight. Export a file to keep a backup or move the campaign to another device.'}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="ma-btn-ghost" onClick={handleExport}>
            {t('exportProgress')}
          </button>
          <button type="button" className="ma-btn-ghost" onClick={() => fileRef.current?.click()}>
            {t('importProgress')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImport}
            aria-label={t('importProgress')}
            data-testid="save-import-input"
          />
        </div>
        <p className="mt-2 text-[10px] text-[var(--ma-muted)]">
          {t('exportHint')} {t('importHint')}
        </p>
        {importNote && (
          <p
            className={`mt-2 text-[11px] ${importNote.ok ? 'text-[var(--ma-good)]' : 'text-[var(--ma-bad)]'}`}
            role="status"
            data-testid="save-import-note"
            dir="ltr"
          >
            {importNote.text}
          </p>
        )}
      </HudFrame>

      <HudFrame tag="DATA NOTES" tagAr="ملاحظات البيانات" className="lg:col-span-2">
        <p className="text-[12px] text-[var(--ma-muted)]">
          {lang === 'ar'
            ? 'كل الأرقام المبسطة لأغراض تعليمية: مدارات دائرية، انتقالات نبضة واحدة، سعات صواريخ تقريبية، ميزانية الوصلة مبسطة، والموثوقية مستقلة. راجع README للقائمة الكاملة.'
            : 'All values simplified for education: circular orbits, single-impulse transfers, approximate launcher capacities, simplified link budget, independent failure assumption. Full list in README.'}
        </p>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] ma-num">
          <span>g₀ = 9.80665 m/s²</span>
          <span>μ⊕ = 398600 km³/s²</span>
          <span>c = 299792.458 km/s</span>
          <span>flux⊕ = 1361 W/m²</span>
        </div>
        <p className="mt-2 text-[11px] ma-num">
          {COMPONENTS.length} parts · {LAUNCHERS.length} launchers · {MISSIONS.length} missions · data set with source notes
        </p>
        <p className="mt-1 text-[11px]">
          {lookupTables().missions['mars_orbiter'] ? 'Mars-ready data set loaded' : 'Mars data missing'}
        </p>
      </HudFrame>
    </div>
  );
}
