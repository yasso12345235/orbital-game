/**
 * Screen 9 — Tech Tree: glowing circular icon nodes, energy-flow branches,
 * credit unlocks. No emoji: unlocked / available / locked states are drawn
 * with the unified vector icon family (Glyph inside the existing SVG).
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useMission } from '../store';
import { useLang, useT } from '../hooks';
import { Bi, HudFrame, Kpi, PanelTag, fmt } from '../components/controls';
import { Icon, Glyph, type IconName } from '../components/Icon';
import { TECH_NODES, canUnlock, levelForXp, type TechNode } from '../tech';

/** v3 step 8 — quiet starfield behind the tree (lazy; no interaction). */
const LazyTechBackdrop = lazy(() => import('../visual/TechBackdrop'));

/** What a node unlocks decides its icon (real tech consequences). */
function nodeIcon(n: TechNode): IconName {
  const comps = n.unlocks.components?.length ?? 0;
  const rocs = n.unlocks.launchers?.length ?? 0;
  const miss = n.unlocks.missions?.length ?? 0;
  if (comps > 0 && rocs > 0) return 'rocket';
  if (rocs > 0) return 'launcher';
  if (comps > 0) return 'builder';
  if (miss > 0) return 'missions';
  return 'tech';
}

export function TechTreeScreen() {
  const t = useT();
  const lang = useLang();
  const progress = useMission((s) => s.progress);
  const unlockTech = useMission((s) => s.unlockTech);
  const setScreen = useMission((s) => s.setScreen);

  const unlocked = useMemo(() => progress.unlockedTech, [progress.unlockedTech]);
  const lvl = levelForXp(progress.xp);

  /** Pop animation when a node transitions locked → unlocked in this session. */
  const [flash, setFlash] = useState<string | null>(null);
  const prevUnlocked = useRef<string[]>(progress.unlockedTech);
  useEffect(() => {
    const added = progress.unlockedTech.find((id) => !prevUnlocked.current.includes(id));
    prevUnlocked.current = progress.unlockedTech;
    if (!added) return;
    setFlash(added);
    const id = window.setTimeout(() => setFlash(null), 1000);
    return () => window.clearTimeout(id);
  }, [progress.unlockedTech]);

  const edges = useMemo(() => {
    const list: { from: string; to: string; active: boolean }[] = [];
    for (const n of TECH_NODES) {
      for (const r of n.requires) {
        list.push({ from: r, to: n.id, active: unlocked.includes(r) });
      }
    }
    return list;
  }, [unlocked]);

  const nodePos = (id: string) => {
    const n = TECH_NODES.find((x) => x.id === id)!;
    return { x: 90 + n.x * 190, y: 60 + n.y * 120 };
  };

  const totalNodes = TECH_NODES.length;
  const doneNodes = unlocked.length;
  const pct = Math.round((doneNodes / totalNodes) * 100);

  const onUnlock = (id: string) => {
    if (unlocked.includes(id)) return;
    unlockTech(id);
  };

  return (
    <div className="ma-enter grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
      <HudFrame tag="TECH TREE" tagAr="شجرة التقنية">
        {/* real completion bar — aria-live for the count */}
        <div className="mb-3" role="progressbar" aria-label={lang === 'ar' ? 'تقدم شجرة التقنية' : 'Tech tree progress'} aria-valuenow={doneNodes} aria-valuemin={0} aria-valuemax={totalNodes}>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-[var(--ma-muted)]">
            <span>{lang === 'ar' ? 'التقدم' : 'Progress'}</span>
            <span className="ma-num">{doneNodes}/{totalNodes} · {pct}%</span>
          </div>
          <div className="ma-statbar mt-1.5" data-tone={pct === 100 ? 'good' : undefined}>
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>

        <p className="ma-swipe-hint">
          <span className="ma-swipe-hint-ico" aria-hidden>↔</span>
          {t('panTechTree')}
        </p>
        <div className="relative overflow-x-auto ma-scroll">
          <div className="pointer-events-none absolute inset-0 opacity-45" aria-hidden>
            <Suspense fallback={null}>
              <LazyTechBackdrop />
            </Suspense>
          </div>
          <svg viewBox="0 0 1160 400" className="relative w-full min-w-[880px]" role="img" aria-label={lang === 'ar' ? 'شجرة التقنية' : 'Technology tree'}>
            {/* branches: base line + energy flow on unlocked edges */}
            {edges.map((e, i) => {
              const from = nodePos(e.from);
              const to = nodePos(e.to);
              return (
                <g key={i} aria-hidden>
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#1B2A50" strokeWidth="2" />
                  {e.active && (
                    <line
                      x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                      stroke="var(--ma-accent)" strokeWidth="2" strokeDasharray="6 10"
                      className="ma-energy"
                    />
                  )}
                </g>
              );
            })}

            {TECH_NODES.map((n) => {
              const p = nodePos(n.id);
              const isUnlocked = unlocked.includes(n.id);
              const check = canUnlock(n, unlocked, progress.credits);
              const available = check.ok;
              const icon = nodeIcon(n);
              const flashOn = flash === n.id;
              return (
                <g
                  key={n.id}
                  className="cursor-pointer outline-none"
                  onClick={() => onUnlock(n.id)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onUnlock(n.id); }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${isUnlocked ? `${lang === 'ar' ? 'مفتوحة' : 'Unlocked'} — ` : available ? `${lang === 'ar' ? 'متاحة الآن' : 'Available now'} — ` : ''}${lang === 'ar' ? n.nameAr : n.name}`}
                  style={{ opacity: isUnlocked || available ? 1 : 0.62 }}
                >
                  {/* pulse halo for genuinely unlockable nodes */}
                  {available && !isUnlocked && (
                    <circle cx={p.x} cy={p.y} r={30} fill="none" stroke="var(--ma-accent)" strokeWidth="1" opacity="0.5" className="ma-tech-pulse" aria-hidden />
                  )}
                  <circle
                    cx={p.x} cy={p.y} r={isUnlocked ? 26 : 24}
                    fill={isUnlocked ? 'color-mix(in srgb, var(--ma-accent) 22%, #0B1A3D)' : '#0B1A3D'}
                    stroke={isUnlocked ? 'var(--ma-accent)' : available ? 'color-mix(in srgb, var(--ma-accent) 55%, var(--ma-line))' : '#2b3355'}
                    strokeWidth={isUnlocked ? 2.5 : 1.5}
                    style={{ filter: isUnlocked ? 'drop-shadow(0 0 12px var(--ma-accent))' : 'none', transition: 'fill 0.4s var(--ma-ease-out), stroke 0.4s var(--ma-ease-out)' }}
                  />
                  {/* icon face — vector glyph, no emoji */}
                  <Glyph name={icon} x={p.x} y={p.y} size={17} color={isUnlocked ? 'var(--ma-ice)' : available ? 'var(--ma-text)' : '#3d476b'} />
                  {/* state signal: check badge when unlocked */}
                  {isUnlocked && (
                    <g aria-hidden>
                      <circle cx={p.x + 20} cy={p.y - 20} r={9} fill="var(--ma-good)" stroke="#04091a" strokeWidth="1.6" />
                      <Glyph name="check" x={p.x + 20} y={p.y - 20} size={10} color="#04131f" />
                    </g>
                  )}
                  {flashOn && <circle cx={p.x} cy={p.y} r={34} fill="var(--ma-accent)" opacity="0.18" className="anim-pop" aria-hidden />}
                  <text x={p.x} y={p.y + 46} textAnchor="middle" fontSize="10" fill={isUnlocked ? '#E8F1FF' : available ? '#B9CBE8' : '#5A6689'}>
                    {lang === 'ar' ? n.nameAr : n.name}
                  </text>
                  {!isUnlocked && (
                    <text
                      x={p.x} y={p.y + 60} textAnchor="middle" fontSize="9"
                      fill={check.reason === 'credits' ? '#FFC542' : '#8FA3C8'}
                      className="ma-num"
                    >
                      {fmt(n.cost)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        <p className="mt-2 flex items-center gap-2 text-[10px] text-[var(--ma-muted)]">
          <Icon name="info" size={13} className="text-[var(--ma-accent)]" />
          {lang === 'ar'
            ? 'انقر عقدة لفتحها بالرصيد. الخطوط النشطة تنقل الطاقة، والعقدة المتاحة تتنبض.'
            : 'Click a node to unlock it with credits. Live branches carry the energy flow; unlockable nodes pulse.'}
        </p>
      </HudFrame>

      <div className="flex flex-col gap-4">
        <HudFrame tag="RESOURCES" tagAr="الموارد">
          <div className="grid grid-cols-2 gap-3">
            <Kpi ar="الرصيد" en="Credits" value={fmt(progress.credits)} accent="var(--ma-good)" />
            <Kpi ar="المستوى" en="Level" value={lvl} accent="var(--ma-accent)" />
          </div>
          <p className="text-[11px] text-[var(--ma-muted)] mt-2">
            {lang === 'ar' ? 'تكسب الرصيد من المهام الناجحة (المتبقي من الميزانية + النقاط).' : 'Earn credits from successful missions (budget leftover + score).'}
          </p>
        </HudFrame>

        {TECH_NODES.map((n) => {
          const isUnlocked = unlocked.includes(n.id);
          const check = canUnlock(n, unlocked, progress.credits);
          const prereqMissing = !isUnlocked && check.reason?.startsWith('missing');
          return (
            <HudFrame
              key={n.id}
              tag={isUnlocked ? 'UNLOCKED' : prereqMissing ? 'CHAINING' : 'AVAILABLE'}
              tagAr={isUnlocked ? 'مفتوحة' : prereqMissing ? 'بانتظار سلسلة' : 'متاحة'}
              tight
              className={flash === n.id ? 'anim-pop' : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
                    style={{
                      color: isUnlocked ? 'var(--ma-accent)' : 'var(--ma-muted)',
                      borderColor: isUnlocked ? 'color-mix(in srgb, var(--ma-accent) 45%, transparent)' : 'var(--ma-line)',
                      background: isUnlocked ? 'color-mix(in srgb, var(--ma-accent) 12%, transparent)' : 'rgba(6,12,26,0.5)',
                      boxShadow: isUnlocked ? '0 0 18px color-mix(in srgb, var(--ma-accent) 22%, transparent)' : 'none',
                    }}
                    aria-hidden
                  >
                    <Icon name={nodeIcon(n)} size={17} />
                  </span>
                  <Bi ar={n.nameAr} en={n.name} stack />
                </div>
                <span className={`ma-num text-[11px] ${isUnlocked ? 'text-[var(--ma-good)]' : 'text-[var(--ma-warn)]'}`}>
                  {isUnlocked ? <Icon name="check" size={14} /> : fmt(n.cost)}
                </span>
              </div>
              <p className="text-[11px] text-[var(--ma-muted)] mt-1">{lang === 'ar' ? n.descAr : n.desc}</p>
              {!isUnlocked && (
                <button
                  type="button"
                  disabled={!check.ok}
                  aria-label={check.ok
                    ? `${t('unlock')} ${n.name}`
                    : check.reason === 'credits'
                      ? (lang === 'ar' ? 'رصيد غير كافٍ' : 'Not enough credits')
                      : (lang === 'ar' ? 'اعتماد سابق مطلوب' : 'Prerequisite needed')}
                  className={`ma-tap mt-2 w-full py-2 rounded-lg text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${check.ok
                    ? 'ma-pill-accent'
                    : 'border border-[var(--ma-line)] text-[var(--ma-muted)] cursor-not-allowed'}`}
                  onClick={() => onUnlock(n.id)}
                >
                  <Icon
                    name={check.ok ? 'plus' : check.reason === 'credits' ? 'fuel' : 'lock'}
                    size={12}
                  />
                  {check.reason === 'credits'
                    ? (lang === 'ar' ? 'رصيد غير كافٍ' : 'Not enough credits')
                    : check.reason?.startsWith('missing')
                      ? (lang === 'ar' ? 'اعتماد سابق مطلوب' : 'Prerequisite needed')
                      : t('unlock')}
                </button>
              )}
            </HudFrame>
          );
        })}

        <HudFrame tag="GO FLY" tagAr="انطلق" tight>
          <button type="button" className="ma-pill ma-pill-accent w-full justify-center" onClick={() => setScreen('missionSelect')}>
            <Icon name="missions" size={14} />
            <span>{t('missionSelect')}</span>
            <Icon name="arrowRight" size={13} />
          </button>
        </HudFrame>
        <p className="flex items-center gap-2 text-[10px] text-[var(--ma-muted)]">
          <PanelTag ar="تلميح" en="TIP" />
          <span>
            {lang === 'ar'
              ? `كل عقدة تفتح مكوّنات وصواريخ ومهام حقيقية — الأرباح عبر إجابة مهام أعلى فئة.`
              : 'Every node unlocks real parts, launchers and missions — higher class missions pay more.'}
          </span>
        </p>
      </div>
    </div>
  );
}
