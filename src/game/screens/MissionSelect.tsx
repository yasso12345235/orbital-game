/**
 * Screen 3 — Mission Select: holographic mission console.
 * Keeps the working interactions of the v3 screen (keyboard carousel,
 * locked-shake, live 3D globe) and adds a real-data briefing: status chips,
 * difficulty classification, objectives from the mission spec, access
 * requirements resolved from the tech tree, and the real payout formula.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useMission, MISSIONS, budgetCapFor, accentForTarget } from '../store';
import { useLang, useT } from '../hooks';
import { Bi, Kpi, PanelTag, fmt } from '../components/controls';
import { MiniGlobe } from '../components/MiniGlobe';
import { Icon, type IconName } from '../components/Icon';
import { TECH_NODES, unlockedIdsFor } from '../tech';
import { sound } from '../audio';

/** v3 step 5 — the live R3F planet (lazy; R3F stays out of the main chunk). */
const LazyMissionGlobe = lazy(() => import('../visual/MissionGlobe'));

/* ------------------------------------------------------------------ */
/* Real classification: difficulty stars → class label.               */
/* ------------------------------------------------------------------ */
const ROMAN = ['I', 'II', 'III', 'IV', 'V'] as const;
const CLASS_EN = ['Entry', 'Standard', 'Advanced', 'Elite', 'Flagship'] as const;
const CLASS_AR = ['أساسي', 'معياري', 'متقدم', 'نخبة', 'قيادي'] as const;

/** Route strip nodes (order is schematic, labelled "not to scale"). */
const ROUTE: { target: string; labelEn: string; labelAr: string }[] = [
  { target: 'leo', labelEn: 'LEO', labelAr: 'مدار أرضي' },
  { target: 'gto', labelEn: 'GTO', labelAr: 'مدار مقامي' },
  { target: 'moon', labelEn: 'Moon', labelAr: 'القمر' },
  { target: 'venus', labelEn: 'Venus', labelAr: 'الزهرة' },
  { target: 'mars', labelEn: 'Mars', labelAr: 'المريخ' },
  { target: 'eros', labelEn: 'Eros', labelAr: 'إيروس' },
  { target: 'jupiter', labelEn: 'Jupiter', labelAr: 'المشتري' },
  { target: 'europa', labelEn: 'Europa', labelAr: 'أوروبا' },
  { target: 'titan', labelEn: 'Titan', labelAr: 'تيتان' },
];
const ROUTE_X: Record<string, number> = {
  leo: 34, gto: 74, moon: 118, venus: 168, mars: 224, eros: 280, jupiter: 352, europa: 414, titan: 474,
};

/* ------------------------------------------------------------------ */
/* Screen                                                             */
/* ------------------------------------------------------------------ */
export function MissionSelectScreen() {
  const t = useT();
  const lang = useLang();
  const selectMission = useMission((s) => s.selectMission);
  const missionId = useMission((s) => s.missionId);
  const setScreen = useMission((s) => s.setScreen);
  const progress = useMission((s) => s.progress);
  const difficulty = useMission((s) => s.difficulty);
  const [shake, setShake] = useState<string | null>(null);

  const ordered = useMemo(() => [...MISSIONS].sort((a, b) => a.difficultyStars - b.difficultyStars), []);
  const idx = Math.max(0, ordered.findIndex((m) => m.id === missionId));
  const current = ordered[idx];

  /** Access truth lives in tech.ts — the same source the store enforces. */
  const un = useMemo(() => unlockedIdsFor(progress.unlockedTech), [progress.unlockedTech]);
  const isLocked = (id: string) => !un.missions.has(id);

  /** node that grants access to each mission (real tech edges). */
  const accessNode = useMemo(() => {
    const map = new Map<string, (typeof TECH_NODES)[number]>();
    for (const n of TECH_NODES) for (const m of n.unlocks.missions ?? []) if (!map.has(m)) map.set(m, n);
    return map;
  }, []);

  /** best record per mission id (real completion data). */
  const records = progress.completed;

  const selectMissionTry = (id: string) => {
    const wasLocked = isLocked(id);
    selectMission(id);
    if (wasLocked) {
      setShake(id);
      setTimeout(() => setShake(null), 350);
    }
  };

  // Keyboard carousel: LEFT/RIGHT dispatch through the store; reflected here via missionId.
  useEffect(() => {
    const st = useMission.subscribe((s, prev) => {
      const step = (dir: number) => {
        const i = ordered.findIndex((m) => m.id === useMission.getState().missionId);
        const base = i === -1 ? 0 : i;
        const next = ordered[(base + dir + ordered.length) % ordered.length];
        if (next) selectMissionTry(next.id);
      };
      if (s.commandPulse.LEFT && s.commandPulse.LEFT !== prev.commandPulse.LEFT) step(-1);
      if (s.commandPulse.RIGHT && s.commandPulse.RIGHT !== prev.commandPulse.RIGHT) step(1);
    });
    return st;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered]);

  const go = () => {
    if (!current) { setScreen('missionSelect'); return; }
    if (isLocked(current.id)) {
      setShake(current.id);
      setTimeout(() => setShake(null), 350);
      sound.play('error');
      return;
    }
    useMission.getState().selectMission(current.id);
    setScreen('builder');
  };

  const unlockRoute = () => {
    if (useMission.getState().settings.sound) sound.play('key');
    setScreen('techTree');
  };

  const cap = budgetCapFor(difficulty);

  const unlockedCount = ordered.filter((m) => un.missions.has(m.id)).length;
  const completedCount = Object.keys(records).length;
  const title = current ? (lang === 'ar' ? current.nameAr ?? current.name : current.name) : null;
  const status = current
    ? records[current.id]
      ? ({ tone: 'good' as const, label: t('completed') })
      : un.missions.has(current.id)
        ? ({ tone: 'accent' as const, label: missionId === current.id ? t('active') : t('available') })
        : ({ tone: 'muted' as const, label: t('locked') })
    : null;

  const node = current ? accessNode.get(current.id) : undefined;

  /* Ceiling of the real payout formula at this difficulty:
     earned = unusedBudget × 25% + score × 8,000 (score ≤ 100). */
  const ceilingCr = Math.round(cap * 0.25 + 100 * 8000);

  return (
    <div className="ma-enter flex flex-col gap-4">
      {/* ------------------------------------------------ console header */}
      <section className="ma-panel px-4 py-3 flex flex-wrap items-center justify-between gap-3" aria-label={t('missionSelect')}>
        <div className="flex items-center gap-3">
          <PanelTag ar="كونسول المهمات" en="MISSION CONSOLE" />
          <span className="ma-hudtag hidden sm:inline" dir="ltr">ORBITAL · SPACE MISSION LAB</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] ma-num">
          <span className="ma-status" data-tone="accent"><i />{unlockedCount}/{ordered.length} {t('available')}</span>
          <span className="ma-status" data-tone="good"><i />{completedCount} {t('completed')}</span>
          <span className="ma-hudtag">{t('budget')}</span>
          <span>{fmt(cap)} CR</span>
        </div>
      </section>

      {/* ------------------------------------------------ carousel strip */}
      <section className="relative">
        <div
          className="flex items-end gap-5 overflow-x-auto ma-scroll pb-6 pt-2 px-1 ma-floor"
          role="listbox"
          aria-label="Mission carousel"
        >
          {ordered.map((m) => {
            const selected = m.id === current?.id;
            const locked = isLocked(m.id);
            const done = records[m.id];
            const size = selected ? 104 : 70;
            return (
              <button
                key={m.id}
                role="option"
                aria-selected={selected}
                type="button"
                className={`group shrink-0 flex flex-col items-center gap-2 transition-all duration-500 ${shake === m.id ? 'ma-shake' : ''}`}
                style={{ opacity: locked ? 0.55 : 1 }}
                onClick={() => selectMissionTry(m.id)}
              >
                <span
                  className="relative rounded-full"
                  style={{
                    padding: selected ? 4 : 3,
                    border: selected
                      ? `1.5px solid color-mix(in srgb, ${accentForTarget(m.target)} 80%, transparent)`
                      : '1px solid color-mix(in srgb, var(--ma-line) 90%, transparent)',
                    boxShadow: selected ? `0 0 26px color-mix(in srgb, ${accentForTarget(m.target)} 38%, transparent)` : 'none',
                    transition: 'border-color 0.5s var(--ma-ease-out), box-shadow 0.5s var(--ma-ease-out)',
                  }}
                  aria-hidden
                >
                  <span className="block" style={{ width: size, height: size }}>
                    <MiniGlobe target={m.target} size={size} className={selected ? 'drop-shadow-[0_0_20px_rgba(70,200,255,0.4)]' : ''} />
                  </span>
                  {/* status dot — real record/unlock state */}
                  <span
                    className="absolute -bottom-1 -end-1 grid place-items-center rounded-full"
                    style={{
                      width: 18, height: 18,
                      background: done ? 'var(--ma-good)' : locked ? '#101A33' : 'var(--ma-accent)',
                      border: '2px solid #04091a',
                      color: done ? '#04131f' : locked ? 'var(--ma-muted)' : '#04131f',
                    }}
                  >
                    <Icon name={done ? 'check' : locked ? 'lock' : 'play'} size={9} strokeWidth={2.6} />
                  </span>
                </span>
                <span className={`text-[10px] uppercase tracking-wider ${selected ? 'text-[var(--ma-text)]' : 'text-[var(--ma-muted)]'}`}>
                  {lang === 'ar' ? m.nameAr ?? m.name : m.name}
                </span>
                <span className="flex items-center gap-[3px]" aria-label={`${t('difficulty')} ${m.difficultyStars}/5`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Icon key={i} name="star" size={8} strokeWidth={2.2} className={i < m.difficultyStars ? 'text-[var(--ma-warn)]' : 'text-[var(--ma-line)]'} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-4">
        {/* ---------------------------------------------- live planet panel */}
        <section className="ma-panel p-4 flex flex-col items-center">
          <PanelTag ar="الكوكب المباشر" en="LIVE PLANET" />
          <div className="ma-holo relative w-full max-w-[340px] h-[228px] rounded-xl overflow-hidden my-1">
            <Suspense
              fallback={
                <div className="grid h-full w-full place-items-center" aria-hidden>
                  <div
                    className="h-24 w-24 rounded-full opacity-70"
                    style={{
                      background: 'radial-gradient(circle at 35% 30%, var(--ma-accent), #0B1A3D 62%, #02050F 80%)',
                      boxShadow: '0 0 50px color-mix(in srgb, var(--ma-accent) 35%, transparent)',
                    }}
                  />
                </div>
              }
            >
              <LazyMissionGlobe target={current?.target ?? 'earth'} />
            </Suspense>
            <HoloSphere target={current?.target ?? 'earth'} />
            <span className="ma-holo-scan" aria-hidden />
            {current && (
              <span className="ma-hudtag absolute top-2 start-2" dir="ltr">
                {missionClassLabel(current.difficultyStars, lang === 'ar' ? 0 : 1)}
              </span>
            )}
          </div>
          {current && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full mt-2">
              <Kpi ar="المدة" en="Duration" value={current.durationDays} unit={t('days')} accent="var(--ma-accent)" />
              <Kpi ar="الدفع المطلوب" en="Required dv" value={current.requiredDvMps} unit="m/s" accent="var(--ma-warn)" />
            </div>
          )}
        </section>

        {/* ---------------------------------------------- briefing panel */}
        <section className="ma-panel p-4" aria-label={t('briefing')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PanelTag ar="إحاطة الطيران" en="FLIGHT BRIEFING" />
            {status && (
              <span className="ma-status" data-tone={status.tone}>
                <i />{status.label}
              </span>
            )}
          </div>

          {current ? (
            <>
              <h2 className="text-2xl mt-1" style={{ fontFamily: 'var(--ma-hud)' }}>{title}</h2>
              <p className="text-sm text-[var(--ma-muted)] mt-1 max-w-2xl">
                {lang === 'ar' ? current.descriptionAr ?? current.description : current.description}
              </p>

              {/* objectives — straight from the real mission spec */}
              <div className="mt-4" role="group" aria-label={t('objectives')}>
                <span className="ma-hudtag">{t('objectives')}</span>
                <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Objective
                    icon="science" tone="good"
                    label={t('science')}
                    value={`≥ ${current.scienceGoalGb} Gb`}
                    note={lang === 'ar' ? 'بيانات مستلمة' : 'data returned to Earth'}
                  />
                  <Objective
                    icon="clock" tone="accent"
                    label={t('duration')}
                    value={`${current.durationDays} ${t('days')}`}
                    note={lang === 'ar' ? 'بقاء المركبة عاملة' : 'keep the craft operational'}
                  />
                  <Objective
                    icon="fuel" tone="warn"
                    label={t('dv')}
                    value={`≥ ${fmt(current.requiredDvMps)} m/s`}
                    note={lang === 'ar' ? 'بعد الانفصال عن الصاروخ' : 'after launcher separation'}
                  />
                  <Objective
                    icon="target" tone="accent"
                    label={t('budget')}
                    value={`≤ ${fmt(cap)} CR`}
                    note={lang === 'ar' ? 'سقف ميزانية التصميم' : 'design cost ceiling'}
                  />
                </div>
              </div>

              {/* requirements — real access data from tech.ts */}
              <div className="mt-4" role="group" aria-label={t('requirements')}>
                <span className="ma-hudtag">{t('requirements')}</span>
                <div className="mt-1.5 rounded-xl border border-[color-mix(in_srgb,var(--ma-line)_88%,transparent)] bg-[rgba(6,12,26,0.45)] px-3 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="flex items-center gap-2 text-[12px]">
                    <Icon name={isLocked(current.id) ? 'lock' : 'check'} size={15} className={isLocked(current.id) ? 'text-[var(--ma-warn)]' : 'text-[var(--ma-good)]'} />
                    <span className="text-[var(--ma-muted)]">{lang === 'ar' ? 'الفتح عبر' : 'Unlocked via'}</span>
                    <b className="text-[var(--ma-text)]" style={{ fontWeight: 600 }}>
                      {node ? (lang === 'ar' ? node.nameAr : node.name) : (lang === 'ar' ? 'متاحة افتراضيًا' : 'unlocked by default')}
                    </b>
                    {node && <span className="ma-hudtag" dir="ltr">T{node.tier} · {fmt(node.cost)} CR</span>}
                  </span>
                  <span className="flex items-center gap-2 text-[12px]">
                    <span className="ma-hudtag">{t('site')}</span>
                    <span className="ma-num text-[var(--ma-text)]">{lang === 'ar' ? current.launchSiteAr ?? '—' : current.launchSite ?? '—'}</span>
                  </span>
                  <span className="flex items-center gap-2 text-[12px]">
                    <span className="ma-hudtag">{t('window')}</span>
                    <span className="ma-num text-[var(--ma-text)]">{lang === 'ar' ? current.launchWindowAr ?? '—' : current.launchWindow ?? '—'}</span>
                  </span>
                  {current.minPowerW !== undefined && (
                    <span className="flex items-center gap-2 text-[12px]">
                      <span className="ma-hudtag">{t('power')}</span>
                      <span className="ma-num text-[var(--ma-text)]">≥ {current.minPowerW} W</span>
                    </span>
                  )}
                </div>
                {isLocked(current.id) && (
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" className="ma-pill ma-pill-ghost ma-pill-sm" onClick={unlockRoute}>
                      <Icon name="tech" size={13} />
                      {t('techTree')}
                    </button>
                    <span className="text-[10px] text-[var(--ma-muted)]">
                      {lang === 'ar' ? 'افتح العقدة أعلاه بالرصيد ثم عد إلى هنا.' : 'Unlock the node above with credits, then return here.'}
                    </span>
                  </div>
                )}
              </div>

              {/* rewards — the real endMission formula, labelled honestly */}
              <div className="mt-4" role="group" aria-label={t('rewards')}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="ma-hudtag">{t('rewards')}</span>
                  {records[current.id] && (
                    <span className="flex items-center gap-2 text-[11px] ma-num">
                      <span className="ma-status" data-tone="good"><i />{t('best')} {records[current.id].score.toFixed(0)} · {t('grade')} {records[current.id].grade}</span>
                    </span>
                  )}
                </div>
                <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <RewardTile
                    label={lang === 'ar' ? 'الميزانية غير المستخدمة' : 'Unused budget'}
                    value="+25%"
                    note={lang === 'ar' ? 'من المتبقي بعد الإطلاق' : 'of the leftover, on completion'}
                  />
                  <RewardTile
                    label={lang === 'ar' ? 'كل نقطة نتيجة' : 'Per score point'}
                    value="+8,000 CR"
                    note={lang === 'ar' ? 'تُحوَّل إلى الرصيد' : 'credited on completion'}
                  />
                  <RewardTile
                    label={lang === 'ar' ? 'السقف النظري' : 'Theoretical ceiling'}
                    value={`${fmt(ceilingCr)} CR`}
                    note={`${t('xp')} ≤ 100`}
                  />
                </div>
                <p className="text-[10px] text-[var(--ma-muted)] mt-1.5">
                  {lang === 'ar'
                    ? 'الصيغة الحقيقية للعائد: المتبقي × 25% + النتيجة × 8,000 — بلا مكافآت مختلقة.'
                    : 'Real payout formula: leftover × 25% + score × 8,000 — no invented bonuses.'}
                </p>
              </div>

              {current.source && (
                <p className="text-[10px] text-[var(--ma-muted)] mt-3" dir="ltr">SOURCE · {current.source}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--ma-muted)]">{lang === 'ar' ? 'اختر مهمة من الشريط.' : 'Pick a mission from the strip.'}</p>
          )}
        </section>
      </div>

      {/* ------------------------------------------------ launch console */}
      <section className="ma-panel px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* route strip: the fleet's destinations, hotspot = selected target */}
        <div className="min-w-[260px] flex-1" aria-label={t('route')}>
          <svg viewBox="0 0 508 56" className="w-full max-w-[560px]" role="img" aria-label={`${t('route')} — ${lang === 'ar' ? 'ليست بمقياس رسم' : 'not to scale'}`}>
            <line x1="10" y1="28" x2="498" y2="28" stroke="color-mix(in srgb, var(--ma-line) 96%, transparent)" strokeDasharray="3 5" />
            {ROUTE.map((n) => {
              const accent = accentForTarget(n.target);
              const here = current?.target === n.target;
              const done = MISSIONS.some((m) => m.target === n.target && records[m.id]);
              const x = ROUTE_X[n.target];
              return (
                <g key={n.target}>
                  {here && <circle cx={x} cy={28} r={11} fill="none" stroke={accent} strokeWidth="1.2" opacity="0.85" className="ma-node" />}
                  {done && !here && <circle cx={x} cy={28} r={7.5} fill="none" stroke="var(--ma-good)" strokeWidth="0.9" opacity="0.7" strokeDasharray="2 3" />}
                  <circle cx={x} cy={28} r={here ? 5 : 3.4} fill={accent} opacity={here ? 1 : 0.75} style={{ filter: here ? `drop-shadow(0 0 6px ${accent})` : 'none' }} />
                  <text
                    x={x}
                    y={48}
                    textAnchor="middle"
                    fontSize="8.5"
                    fill={here ? 'var(--ma-text)' : 'var(--ma-muted)'}
                    className="ma-num"
                    style={{ letterSpacing: '0.08em' }}
                  >
                    {lang === 'ar' ? n.labelAr : n.labelEn}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex items-center gap-5 flex-wrap">
          <Field label={t('missionSelect')} value={current ? (lang === 'ar' ? current.nameAr ?? current.name : current.name) : '—'} />
          <Field label={t('site')} value={current ? (lang === 'ar' ? current.launchSiteAr ?? '—' : current.launchSite ?? '—') : '—'} />
          <Field label={t('window')} value={current ? (lang === 'ar' ? current.launchWindowAr ?? '—' : current.launchWindow ?? '—') : '—'} />
        </div>

        <div className="flex items-center gap-2">
          {current && isLocked(current.id) && (
            <button type="button" className="ma-pill ma-pill-ghost" onClick={unlockRoute}>
              <Icon name="tech" size={15} />
              <span>{t('unlock')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={go}
            className="ma-pill ma-pill-accent"
            aria-label={`Go to builder for ${current?.name ?? ''}`}
          >
            <Icon name={current && isLocked(current.id) ? 'lock' : 'arrowRight'} size={16} />
            <span>
              {current && isLocked(current.id)
                ? (lang === 'ar' ? 'مقفلة' : 'LOCKED')
                : (lang === 'ar' ? 'انطلاق' : 'GO')}
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
function missionClassLabel(stars: 1 | 2 | 3 | 4 | 5, ar: 0 | 1) {
  const seq = ar ? CLASS_AR : CLASS_EN;
  return `CLASS ${ROMAN[stars - 1]} · ${seq[stars - 1]}`.toUpperCase();
}

function Objective({ icon, tone, label, value, note }: { icon: IconName; tone: 'good' | 'accent' | 'warn'; label: string; value: string; note: string }) {
  const color = tone === 'good' ? 'var(--ma-good)' : tone === 'warn' ? 'var(--ma-warn)' : 'var(--ma-accent)';
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--ma-line)_88%,transparent)] bg-[rgba(6,12,26,0.45)] px-3 py-2">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border"
        style={{
          color,
          borderColor: 'color-mix(in srgb, currentColor 38%, transparent)',
          background: 'color-mix(in srgb, currentColor 9%, transparent)',
        }}
      >
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0">
        <span className="ma-hudtag">{label}</span>
        <span className="ma-num block text-[13px] text-[var(--ma-text)]">{value}</span>
        <span className="block text-[10px] text-[var(--ma-muted)]">{note}</span>
      </span>
    </div>
  );
}

function RewardTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--ma-accent)_20%,var(--ma-line))] bg-[color-mix(in_srgb,var(--ma-accent)_6%,transparent)] px-3 py-2">
      <span className="ma-hudtag">{label}</span>
      <span className="ma-num block text-[13px]" style={{ color: 'var(--ma-accent)' }}>{value}</span>
      <span className="block text-[10px] text-[var(--ma-muted)]">{note}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-[9px] uppercase tracking-widest text-[var(--ma-muted)]">{label}</span>
      <span className="ma-num max-w-[180px] truncate" title={value}>{value}</span>
    </span>
  );
}

/* Wireframe holographic sphere with constellation lines + orbit rings. */
function HoloSphere({ target }: { target: string }) {
  const accent = accentForTarget(target);
  const nodes = [
    { x: 78, y: 40 }, { x: 130, y: 24 }, { x: 168, y: 62 }, { x: 150, y: 118 },
    { x: 92, y: 132 }, { x: 48, y: 96 }, { x: 110, y: 80 },
  ];
  return (
    <svg viewBox="0 0 220 190" className="pointer-events-none absolute inset-0 w-full h-full opacity-55" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Holographic planet wireframe">
      <g fill="none" stroke={accent} strokeWidth="0.8" opacity="0.85">
        <circle cx="110" cy="90" r="52" />
        {[18, 34, 46].map((rx) => (
          <ellipse key={rx} cx="110" cy="90" rx={rx} ry="52" />
        ))}
        {[-30, -12, 12, 30].map((dy) => (
          <ellipse key={dy} cx="110" cy={90 + dy} rx={Math.sqrt(Math.max(4, 52 * 52 - dy * dy))} ry="7" opacity="0.55" />
        ))}
        <ellipse cx="110" cy="90" rx="88" ry="30" strokeDasharray="4 6" opacity="0.7" />
        <ellipse cx="110" cy="90" rx="72" ry="24" strokeDasharray="2 8" opacity="0.5" transform="rotate(-14 110 90)" />
        {nodes.map((n, i) => (
          <line key={i} x1={n.x} y1={n.y} x2={110} y2={90} strokeWidth="0.4" opacity="0.4" />
        ))}
      </g>
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r="2.4" fill={accent} className="ma-node" style={{ animationDelay: `${i * 0.3}s` }} />
      ))}
      <circle cx="110" cy="90" r="52" fill={accent} opacity="0.06" />
    </svg>
  );
}
