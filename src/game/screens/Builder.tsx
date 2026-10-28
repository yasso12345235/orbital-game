/** Screen 4 — Spacecraft Builder: 7×5 bay grid, live budgets, explained validation. */
import { Suspense, lazy, useMemo } from 'react';
import { useMission, COMPONENTS, lookupTables, budgetCapFor, linkInfoFor, type SpacecraftDesign } from '../store';
import { useLang, useT } from '../hooks';
import { Bi, HudFrame, HudSlider, Kpi, LearnBox, PanelTag, RingGauge, fmt } from '../components/controls';
import { unlockedIdsFor } from '../tech';
import type { ComponentCategory } from '@engine';

/** v3 step 5 — the live R3F bay preview (lazy; R3F stays out of the main chunk). */
const LazyBuilderPreview = lazy(() => import('../visual/BuilderPreview'));

const CATS: { id: ComponentCategory; ar: string; en: string }[] = [
  { id: 'bus', ar: 'الحافلة', en: 'Bus' },
  { id: 'power', ar: 'الطاقة', en: 'Power' },
  { id: 'propulsion', ar: 'الدفع', en: 'Propulsion' },
  { id: 'comms', ar: 'الاتصالات', en: 'Comms' },
  { id: 'payload', ar: 'الحمولة', en: 'Payload' },
  { id: 'thermal', ar: 'الحرارة', en: 'Thermal' },
];

export function BuilderScreen() {
  const t = useT();
  const lang = useLang();
  const design = useMission((s) => s.design);
  const builder = useMission((s) => s.builder);
  const validate = useMission((s) => s.validate);
  const setComponent = useMission((s) => s.setComponent);
  const toggleRedundancy = useMission((s) => s.toggleRedundancy);
  const setPropellant = useMission((s) => s.setPropellant);
  const setBuilderCategory = useMission((s) => s.setBuilderCategory);
  const setCursor = useMission((s) => s.setCursor);
  const setScreen = useMission((s) => s.setScreen);
  const beginLaunch = useMission((s) => s.beginLaunch);
  const progress = useMission((s) => s.progress);
  const settings = useMission((s) => s.settings);
  const difficulty = useMission((s) => s.difficulty);
  const missionId = useMission((s) => s.missionId);

  const unlocked = useMemo(() => unlockedIdsFor(progress.unlockedTech), [progress.unlockedTech]);
  const tables = lookupTables();
  const mission = missionId ? tables.missions[missionId] : null;
  const propSpec = design.components.propulsion ? tables.components[design.components.propulsion] : null;
  const cap = budgetCapFor(difficulty);
  const budget = validate?.budget;

  const massFrac = budget ? budget.totalMassKg / budget.launcherCapacityKg : 0;
  const powerFrac = budget && budget.loadW > 0 ? Math.min(1, budget.generationW / (budget.loadW * 2.2)) : 0;
  const costFrac = budget ? Math.min(1, budget.costTotal / cap) : 0;
  const riskPct = budget ? (1 - budget.reliability) * 100 : 0;

  const missionLabel = mission ? (lang === 'ar' ? mission.nameAr ?? mission.name : mission.name) : '—';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_320px] gap-4">
      {/* Equipment slots */}
      <div className="flex flex-col gap-4">
        <HudFrame tag="EQUIPMENT SLOTS" tagAr="فتحات التجهيز">
          <p className="text-[10px] text-[var(--ma-muted)] mb-2">
            {lang === 'ar' ? 'TAB للتنقل بين الفتحات' : 'TAB cycles slots'}
          </p>
          <ul className="space-y-1.5">
            {CATS.map((c) => {
              const active = builder.selectedCategory === c.id;
              const chosen = design.components[c.id];
              const spec = chosen ? tables.components[chosen] : null;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`ma-tap w-full text-left px-3 py-2 rounded-lg border transition-colors ${active ? 'border-[var(--ma-accent)] bg-[color-mix(in_srgb,var(--ma-accent)_10%,transparent)]' : 'border-[var(--ma-line)] hover:border-[var(--ma-accent)]'}`}
                    onClick={() => setBuilderCategory(c.id)}
                    aria-pressed={active}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Bi ar={c.ar} en={c.en} />
                      <span className="text-[10px] text-[var(--ma-muted)] ma-num">{spec ? `${fmt(spec.massKg)} kg` : '—'}</span>
                    </div>
                    <div className="text-[10px] text-[var(--ma-accent)] mt-0.5 truncate">
                      {spec ? (lang === 'ar' ? spec.nameAr ?? spec.name : spec.name) : (lang === 'ar' ? 'فارغ' : 'empty')}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </HudFrame>

        <HudFrame tag="PARTS" tagAr="القطع">
          <div className="space-y-3 max-h-[320px] overflow-auto ma-scroll pr-1">
            {CATS.filter((c) => c.id === builder.selectedCategory).map((c) => (
              <ul key={c.id} className="space-y-1.5">
                {COMPONENTS.filter((comp) => comp.category === c.id).map((comp) => {
                  const locked = !unlocked.components.has(comp.id);
                  const chosen = design.components[c.id] === comp.id;
                  const red = design.redundancy[c.id];
                  return (
                    <li key={comp.id} className={`px-3 py-2 rounded-lg border text-left ${chosen ? 'border-[var(--ma-accent)]' : 'border-[var(--ma-line)]'} ${locked ? 'opacity-40' : ''}`}>
                      <button
                        type="button"
                        disabled={locked}
                        className="ma-tap w-full text-left"
                        onClick={() => setComponent(c.id, comp.id)}
                        aria-label={comp.name}
                        title={comp.description}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px]">{lang === 'ar' ? comp.nameAr ?? comp.name : comp.name}</span>
                          <span className="ma-num text-[10px] text-[var(--ma-muted)]">{fmt(comp.cost)}</span>
                        </div>
                        <div className="flex gap-3 text-[10px] text-[var(--ma-muted)] ma-num">
                          <span>{comp.massKg} kg</span>
                          {comp.powerW > 0 && <span>{comp.powerW} W</span>}
                          {comp.ispS && <span>Isp {comp.ispS}s</span>}
                          {comp.solarAreaM2 && <span>{comp.solarAreaM2} m²</span>}
                          {comp.outputPowerW && <span>⚛ {comp.outputPowerW} W</span>}
                          {comp.propCapacityKg && <span>≤{comp.propCapacityKg} kg</span>}
                          <span>R {((comp.reliability ?? 0) * 100).toFixed(0)}%</span>
                        </div>
                        {locked && <span className="text-[10px] text-[var(--ma-warn)]">🔒 {t('locked')}</span>}
                      </button>
                      {chosen && (
                        <label className="ma-taprow flex items-center gap-2 mt-1.5 text-[10px] text-[var(--ma-muted)]">
                          <input type="checkbox" checked={red} onChange={() => toggleRedundancy(c.id)} aria-label={`${t('redundancy')} ${comp.name}`} />
                          {t('redundancy')} (+{comp.redundancyMassKg ?? comp.massKg} kg)
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}
          </div>
        </HudFrame>
      </div>

      {/* Center: grid + 3D */}
      <div className="flex flex-col gap-4 min-w-0">
        <HudFrame tag="PAYLOAD BAY 7×5" tagAr="حجرة الحمولة ٧×5">
          <div className="flex flex-col lg:flex-row gap-4">
            <BayGrid />
            <div className="flex-1 min-h-[220px] rounded-xl overflow-hidden bg-[#03071a] relative">
              <Suspense
                fallback={
                  <div className="ma-loading">
                    <span className="ma-loading-ring" aria-hidden />
                    <span>{lang === 'ar' ? 'جارٍ تحميل البايت ثلاثي الأبعاد' : 'Loading 3D bay'}</span>
                  </div>
                }
              >
                <LazyBuilderPreview />
              </Suspense>
              <div className="absolute top-2 left-2"><PanelTag ar="معاينة" en="LIVE" /></div>
            </div>
          </div>
          <p className="text-[10px] text-[var(--ma-muted)] mt-2">
            {lang === 'ar' ? 'الأسهم للتنقل، Q/E للتدوير، ENTER للتثبيت، BACK للإزالة.' : 'Arrows move · Q/E rotate · ENTER place · BACK remove'}
          </p>
        </HudFrame>

        <HudFrame tag="STATUS" tagAr="الحالة">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 justify-items-center">
            <RingGauge
              value={massFrac * 100} ar="كتلة/سعة" en="Mass vs capacity" unit="%" decimals={0}
              color={massFrac > 1 ? 'var(--ma-bad)' : massFrac > 0.9 ? 'var(--ma-warn)' : undefined}
            />
            <RingGauge value={powerFrac * 100} ar="طاقة/حمل" en="Power vs load" unit="%" color={powerFrac < 0.5 && budget ? 'var(--ma-warn)' : 'var(--ma-good)'} />
            <RingGauge value={costFrac * 100} ar="تكلفة/ميزانية" en="Cost vs budget" unit="%" color={costFrac > 1 ? 'var(--ma-bad)' : costFrac > 0.85 ? 'var(--ma-warn)' : undefined} />
            <RingGauge value={riskPct} ar="خطر" en="Risk" unit="%" color={riskPct > 40 ? 'var(--ma-bad)' : riskPct > 20 ? 'var(--ma-warn)' : 'var(--ma-good)'} />
          </div>
        </HudFrame>

        {settings.learnMode && budget && propSpec && (
          <HudFrame tag="LEARN" tagAr="تعلّم">
            <LearnBox
              formula="Δv = Isp × g₀ × ln(m₀ / m_f)"
              substitution={`${propSpec.ispS} × 9.80665 × ln(${(budget.totalMassKg).toFixed(0)} / ${budget.dryMassKg.toFixed(0)}) with m_p = ${budget.propellantMassKg.toFixed(0)} kg`}
              result={`Δv = ${budget.availableDvMps.toFixed(0)} m/s (required ${budget.requiredDvMps.toFixed(0)} m/s)`}
              note={lang === 'ar'
                ? 'كل كيلوغرام من الوقود يشتري جزءًا يتناقص من السرعة — هذا سبب صعوبة المهام البعيدة.'
                : 'Each extra kilogram of propellant buys less velocity — why far missions get hard fast.'}
            />
          </HudFrame>
        )}
      </div>

      {/* Right: budgets + checks */}
      <div className="flex flex-col gap-4">
        <HudFrame tag="PROPELLANT" tagAr="الوقود">
          <HudSlider
            label="Propellant" labelAr="الوقود الدافع" unit="kg"
            value={design.propellantMassKg}
            min={0}
            max={propSpec?.propCapacityKg ?? 0}
            step={10}
            disabled={!propSpec}
            onChange={setPropellant}
            hint={lang === 'ar' ? 'يقتصر على سعة الخزان' : 'Limited by tank capacity'}
          />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Kpi ar="متاح" en="Available dv" value={budget ? budget.availableDvMps.toFixed(0) : '—'} unit="m/s" accent="var(--ma-good)" />
            <Kpi ar="مطلوب" en="Required dv" value={mission ? mission.requiredDvMps : '—'} unit="m/s" accent="var(--ma-warn)" />
          </div>
          {budget && (
            <p className={`mt-2 text-[12px] ma-num ${budget.dvMarginMps >= 0 ? 'text-[var(--ma-good)]' : 'text-[var(--ma-bad)]'}`}>
              {t('margin')}: {budget.dvMarginMps >= 0 ? '+' : ''}{budget.dvMarginMps.toFixed(0)} m/s
            </p>
          )}
        </HudFrame>

        <HudFrame tag="CHECKS" tagAr="الفحوصات">
          <ul className="space-y-2">
            {(validate?.checks ?? []).map((c) => (
              <li key={c.id} className="text-[11px] leading-snug">
                <span className={`uppercase tracking-wider text-[9px] mr-1 ${c.severity === 'fail' ? 'text-[var(--ma-bad)]' : c.severity === 'warn' ? 'text-[var(--ma-warn)]' : 'text-[var(--ma-good)]'}`}>
                  {c.severity === 'fail' ? '✕' : c.severity === 'warn' ? '!' : '✔'} {c.id}
                </span>
                <span className="text-[var(--ma-muted)]">{c.message}</span>
              </li>
            ))}
          </ul>
        </HudFrame>

        <HudFrame tag="CLEARANCE" tagAr="التصريح">
          <p className={`text-sm font-bold ${validate?.go ? 'text-[var(--ma-good)]' : 'text-[var(--ma-bad)]'}`}>
            {validate?.go ? t('validDesign') : t('invalidDesign')}
          </p>
          <p className="text-[11px] text-[var(--ma-muted)] mt-1">
            {lang === 'ar' ? 'المهمة: ' : 'Mission: '}{missionLabel}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              className="ma-tap flex-1 py-2 rounded-lg border border-[var(--ma-line)] text-xs uppercase tracking-wider hover:border-[var(--ma-accent)]"
              onClick={() => setScreen('launcher')}
            >
              {t('next')}: {t('launcher')} →
            </button>
            <button
              type="button"
              disabled={!validate?.go}
              className={`ma-tap px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider ${validate?.go ? 'ma-cta-gold' : 'bg-[var(--ma-line)] text-[var(--ma-muted)] cursor-not-allowed'}`}
              onClick={beginLaunch}
            >
              {t('launch')}
            </button>
          </div>
        </HudFrame>
      </div>
    </div>
  );
}

/* --------- 7×5 bay grid --------- */
function BayGrid() {
  const builder = useMission((s) => s.builder);
  const setCursor = useMission((s) => s.setCursor);
  const placePart = useMission((s) => s.placePart);
  const design = useMission((s) => s.design);

  const cellPx = 46;
  const placedList = Object.entries(builder.placed).filter(([, p]) => p) as [ComponentCategory, NonNullable<(typeof builder.placed)[ComponentCategory]>][];
  const selCat = builder.selectedCategory;
  const selSpec = design.components[selCat] ? lookupTables().components[design.components[selCat]!] : null;
  const ghostW = builder.rotation ? selSpec?.footprintH ?? 2 : selSpec?.footprintW ?? 2;
  const ghostH = builder.rotation ? selSpec?.footprintW ?? 2 : selSpec?.footprintH ?? 2;

  const canPlaceHere = useMemo(() => {
    const others = placedList.filter(([cat]) => cat !== selCat).map(([, p]) => p);
    // reuse engine canPlace semantics locally
    const x = builder.cursor.x, y = builder.cursor.y;
    if (x < 0 || y < 0 || x + ghostW > 7 || y + ghostH > 5) return false;
    return !others.some((p) => x < p.x + p.w && x + ghostW > p.x && y < p.y + p.h && y + ghostH > p.y);
  }, [placedList, builder.cursor, ghostW, ghostH, selCat]);

  const catColor: Record<string, string> = {
    bus: '#8FA3C8', power: '#46C8FF', propulsion: '#FF8A2F', comms: '#FFB81F', payload: '#2FE39A', thermal: '#B05CFF',
  };

  return (
    <div
      className="relative select-none shrink-0"
      style={{ width: 7 * cellPx, height: 5 * cellPx }}
      role="grid"
      aria-label="Payload bay grid"
    >
      {Array.from({ length: 35 }).map((_, i) => {
        const x = i % 7, y = Math.floor(i / 7);
        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            aria-label={`cell ${x},${y}`}
            className="absolute border border-[var(--ma-line)] hover:border-[var(--ma-accent)]"
            style={{ left: x * cellPx, top: y * cellPx, width: cellPx, height: cellPx, background: 'rgba(7,12,34,0.6)' }}
            onClick={() => setCursor(x, y)}
            onDoubleClick={() => { setCursor(x, y); placePart(); }}
          />
        );
      })}

      {/* ghost preview */}
      {selSpec && (
        <div
          className="absolute pointer-events-none border-2 border-dashed"
          style={{
            left: builder.cursor.x * cellPx + 2,
            top: builder.cursor.y * cellPx + 2,
            width: ghostW * cellPx - 4,
            height: ghostH * cellPx - 4,
            borderColor: canPlaceHere ? 'var(--ma-good)' : 'var(--ma-bad)',
            background: `color-mix(in srgb, ${canPlaceHere ? 'var(--ma-good)' : 'var(--ma-bad)'} 12%, transparent)`,
          }}
          aria-hidden
        />
      )}

      {/* placed parts */}
      {placedList.map(([cat, p]) => {
        const spec = lookupTables().components[p.componentId];
        const selected = cat === selCat;
        return (
          <div
            key={cat}
            className="absolute flex items-center justify-center text-[9px] uppercase cursor-pointer"
            style={{
              left: p.x * cellPx + 2,
              top: p.y * cellPx + 2,
              width: p.w * cellPx - 4,
              height: p.h * cellPx - 4,
              background: `color-mix(in srgb, ${catColor[cat]} 26%, #0B1A3D)`,
              border: `1px solid ${catColor[cat]}`,
              boxShadow: selected ? `0 0 14px ${catColor[cat]}` : 'none',
              color: catColor[cat],
              transition: 'transform 0.2s ease',
            }}
            onClick={() => setCursor(p.x, p.y)}
            title={spec?.name}
          >
            <span className="px-1 text-center leading-tight">{spec ? (spec.name.length > 10 ? spec.name.slice(0, 9) + '…' : spec.name) : cat}</span>
          </div>
        );
      })}
    </div>
  );
}
