/** Screen 4 — Spacecraft Builder: 7×5 bay grid, live budgets, explained validation. */
import { Suspense, lazy, useMemo } from 'react';
import { useMission, COMPONENTS, LAUNCHERS, lookupTables, budgetCapFor, linkInfoFor, type SpacecraftDesign } from '../store';
import { useLang, useT } from '../hooks';
import { Bi, HudFrame, HudSlider, Kpi, LearnBox, PanelTag, RingGauge, fmt } from '../components/controls';
import { unlockedIdsFor } from '../tech';
import { sound } from '../audio';
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
  const autoLayout = useMission((s) => s.autoLayout);
  const setLauncher = useMission((s) => s.setLauncher);
  const pushToast = useMission((s) => s.pushToast);
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

  const smartAutoBuild = (variant: 'standard' | 'high_dv' | 'reliable' = 'standard') => {
    if (!missionId) return;
    const pool = COMPONENTS.filter((c) => unlocked.components.has(c.id));
    const bus = pool.find((c) => c.category === 'bus') ?? pool[0];
    
    // Choose power based on variant
    let power = pool.find((c) => c.category === 'power' && (c.outputPowerW || c.solarAreaM2)) ?? pool.find((c) => c.category === 'power');
    if (variant === 'high_dv') {
      power = [...pool.filter((c) => c.category === 'power')].sort((a, b) => a.massKg - b.massKg)[0] ?? power;
    }

    // Choose propulsion
    let propulsion = pool.find((c) => c.category === 'propulsion' && (c.ispS ?? 0) >= 280) ?? pool.find((c) => c.category === 'propulsion');
    if (variant === 'high_dv') {
      propulsion = [...pool.filter((c) => c.category === 'propulsion')].sort((a, b) => (b.ispS ?? 0) - (a.ispS ?? 0))[0] ?? propulsion;
    }

    const comms = pool.find((c) => c.category === 'comms');
    const payload = pool.find((c) => c.category === 'payload');
    const thermal = pool.find((c) => c.category === 'thermal');

    if (bus) setComponent('bus', bus.id);
    if (power) setComponent('power', power.id);
    if (propulsion) {
      setComponent('propulsion', propulsion.id);
      const capP = propulsion.propCapacityKg ?? 100;
      setPropellant(Math.round(capP * (variant === 'high_dv' ? 1.0 : 0.85)));
    }
    if (comms) setComponent('comms', comms.id);
    if (payload) setComponent('payload', payload.id);
    if (thermal) setComponent('thermal', thermal.id);

    // Apply redundancy if reliable variant
    if (variant === 'reliable') {
      toggleRedundancy('power');
      toggleRedundancy('propulsion');
      toggleRedundancy('comms');
    }

    const massEst =
      (bus?.massKg ?? 100) +
      (power?.massKg ?? 50) +
      (propulsion?.massKg ?? 50) +
      (comms?.massKg ?? 20) +
      (payload?.massKg ?? 40) +
      (thermal?.massKg ?? 20) +
      ((propulsion?.propCapacityKg ?? 100) * 0.85);

    const validLaunchers = LAUNCHERS.filter((l) => unlocked.launchers.has(l.id) && l.capacityToLeoKg >= massEst);
    if (validLaunchers.length > 0) {
      setLauncher(validLaunchers[0].id);
    } else {
      const bestLauncher = [...LAUNCHERS].sort((a, b) => b.capacityToLeoKg - a.capacityToLeoKg)[0];
      if (bestLauncher) setLauncher(bestLauncher.id);
    }

    setTimeout(() => {
      autoLayout();
      sound.play('confirm');
      pushToast(
        lang === 'ar'
          ? 'تم التجهيز والتجميع الذكي بنجاح! المركبة جاهزة 100% للتصريح 🚀'
          : 'Smart auto-build complete! 100% verified & GO for Launch 🚀',
        'good'
      );
    }, 60);
  };

  const instantLaunch = () => {
    smartAutoBuild('standard');
    setTimeout(() => {
      beginLaunch();
    }, 120);
  };

  const massFrac = budget ? budget.totalMassKg / budget.launcherCapacityKg : 0;
  const powerFrac = budget && budget.loadW > 0 ? Math.min(1, budget.generationW / (budget.loadW * 2.2)) : 0;
  const costFrac = budget ? Math.min(1, budget.costTotal / cap) : 0;
  const riskPct = budget ? (1 - budget.reliability) * 100 : 0;

  const missionLabel = mission ? (lang === 'ar' ? mission.nameAr ?? mission.name : mission.name) : '—';

  return (
    <div className="flex flex-col gap-4">
      {/* VAB Cleanroom Mission Ribbon */}
      <div className="ma-cyber-card flex flex-wrap items-center justify-between gap-4 p-4">
        <span className="ma-corner-tl" />
        <span className="ma-corner-tr" />
        <span className="ma-corner-bl" />
        <span className="ma-corner-br" />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--ma-accent)] bg-[color-mix(in_srgb,var(--ma-accent)_12%,transparent)] text-lg shadow-[0_0_15px_rgba(61,224,255,0.3)]">
            🛠️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="ma-epic-kicker text-[8px] tracking-[0.3em]">
                {lang === 'ar' ? 'مرفق تجميع وتجهيز الصاروخ الفضائي' : 'VEHICLE ASSEMBLY BAY · ISO-5 CLEANROOM'}
              </span>
              <span className="rounded-full bg-[rgba(47,224,90,0.15)] px-2 py-0.5 text-[9px] font-bold text-[var(--ma-good)] border border-[rgba(47,224,90,0.3)]">
                CLEANROOM PASS
              </span>
            </div>
            <h1 className="font-hud text-lg font-bold tracking-wider text-white">
              {missionLabel}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Instant 1-Click Launch Action */}
          <button
            type="button"
            className="ma-tap flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--ma-good)] bg-[rgba(47,224,90,0.25)] hover:bg-[rgba(47,224,90,0.4)] text-white font-extrabold text-xs shadow-[0_0_20px_rgba(47,224,90,0.5)] transition-all animate-pulse"
            onClick={instantLaunch}
            title={lang === 'ar' ? 'تجهيز شامل وانطلاق فوري للرحلة مباشرة' : 'Auto build and start flight directly'}
          >
            <span className="text-base">🚀</span>
            <span>{lang === 'ar' ? 'تجهيز تلقائي فوري وانطلاق للرحلة' : 'Instant Auto-Build & Launch'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-5 text-[11px] ma-num">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-[var(--ma-muted)] block">
                {lang === 'ar' ? 'الكتلة الإجمالية' : 'Total Mass'}
              </span>
              <span className="font-bold text-white text-[13px]">
                {budget ? `${fmt(budget.totalMassKg)} / ${fmt(budget.launcherCapacityKg)} kg` : '—'}
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-[var(--ma-muted)] block">
                {lang === 'ar' ? 'الدفع المتاح' : 'Available Δv'}
              </span>
              <span className={`font-bold text-[13px] ${budget && budget.dvMarginMps >= 0 ? 'text-[var(--ma-good)]' : 'text-[var(--ma-bad)]'}`}>
                {budget ? `${fmt(budget.availableDvMps)} m/s` : '—'}
              </span>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-[var(--ma-muted)] block">
                {lang === 'ar' ? 'الموثوقية' : 'Reliability'}
              </span>
              <span className="font-bold text-[var(--ma-gold)] text-[13px]">
                {budget ? `${(budget.reliability * 100).toFixed(0)}%` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK PRESET LOADOUTS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[rgba(6,12,28,0.7)] border border-[rgba(61,224,255,0.2)] backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <span className="text-base">⚡</span>
          <span>{lang === 'ar' ? 'أوضاع التجهيز السريع بضغطة واحدة:' : '1-Click Quick Loadout Presets:'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="ma-tap px-3 py-1.5 rounded-xl border border-[var(--ma-accent)] bg-[rgba(61,224,255,0.15)] hover:bg-[rgba(61,224,255,0.28)] text-white text-xs font-bold transition-all shadow-md"
            onClick={() => smartAutoBuild('standard')}
          >
            ⚖️ {lang === 'ar' ? 'تجهيز متوازن قياسي' : 'Balanced Preset'}
          </button>
          <button
            type="button"
            className="ma-tap px-3 py-1.5 rounded-xl border border-[var(--ma-gold)] bg-[rgba(233,195,124,0.15)] hover:bg-[rgba(233,195,124,0.28)] text-[var(--ma-gold)] text-xs font-bold transition-all shadow-md"
            onClick={() => smartAutoBuild('high_dv')}
          >
            🚀 {lang === 'ar' ? 'أقصى سرعة ومدى (Δv)' : 'High Delta-V'}
          </button>
          <button
            type="button"
            className="ma-tap px-3 py-1.5 rounded-xl border border-[var(--ma-good)] bg-[rgba(47,224,90,0.15)] hover:bg-[rgba(47,224,90,0.28)] text-[var(--ma-good)] text-xs font-bold transition-all shadow-md"
            onClick={() => smartAutoBuild('reliable')}
          >
            🛡️ {lang === 'ar' ? 'أقصى أمان وموثوقية' : 'High Reliability'}
          </button>
          <button
            type="button"
            className="ma-tap px-3 py-1.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white/80 text-xs font-bold transition-all shadow-md"
            onClick={() => {
              autoLayout();
              sound.play('confirm');
            }}
          >
            🔄 {lang === 'ar' ? 'إعادة الترتيب التلقائي' : 'Auto-Fit Bay'}
          </button>
        </div>
      </div>

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
                      className={`ma-tap w-full text-left px-3 py-2.5 rounded-xl border transition-all ${active ? 'border-[var(--ma-accent)] bg-[color-mix(in_srgb,var(--ma-accent)_15%,transparent)] shadow-[0_0_15px_rgba(61,224,255,0.25)]' : 'border-[var(--ma-line)] hover:border-[var(--ma-accent)] hover:bg-[rgba(255,255,255,0.02)]'}`}
                      onClick={() => setBuilderCategory(c.id)}
                      aria-pressed={active}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs"><Bi ar={c.ar} en={c.en} /></span>
                        <span className="text-[10px] text-[var(--ma-muted)] ma-num font-mono">{spec ? `${fmt(spec.massKg)} kg` : '—'}</span>
                      </div>
                      <div className="text-[11px] text-[var(--ma-accent)] mt-1 truncate font-medium">
                        {spec ? (lang === 'ar' ? spec.nameAr ?? spec.name : spec.name) : (lang === 'ar' ? 'فارغ — غير مجهز' : 'empty slot')}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </HudFrame>

          <HudFrame tag="PARTS CATALOG" tagAr="كتالوج القطع">
            <div className="space-y-3 max-h-[340px] overflow-auto ma-scroll pr-1">
              {CATS.filter((c) => c.id === builder.selectedCategory).map((c) => (
                <ul key={c.id} className="space-y-2">
                  {COMPONENTS.filter((comp) => comp.category === c.id).map((comp) => {
                    const locked = !unlocked.components.has(comp.id);
                    const chosen = design.components[c.id] === comp.id;
                    const red = design.redundancy[c.id];
                    return (
                      <li key={comp.id} className={`p-3 rounded-xl border text-left transition-all ${chosen ? 'border-[var(--ma-accent)] bg-[color-mix(in_srgb,var(--ma-accent)_12%,transparent)] shadow-[0_0_20px_rgba(61,224,255,0.2)]' : 'border-[var(--ma-line)] bg-[rgba(6,11,26,0.6)] hover:border-[rgba(61,224,255,0.4)]'} ${locked ? 'opacity-40' : ''}`}>
                        <button
                          type="button"
                          disabled={locked}
                          className="ma-tap w-full text-left"
                          onClick={() => {
                            setComponent(c.id, comp.id);
                            setTimeout(() => autoLayout(), 40);
                          }}
                          aria-label={comp.name}
                          title={comp.description}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-bold text-white">{lang === 'ar' ? comp.nameAr ?? comp.name : comp.name}</span>
                            <span className="ma-num text-[11px] font-bold text-[var(--ma-gold)]">{fmt(comp.cost)} CR</span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--ma-muted)] ma-num mt-1">
                            <span className="text-white/80">{comp.massKg} kg</span>
                            {comp.powerW > 0 && <span className="text-[var(--ma-accent)]">{comp.powerW} W</span>}
                            {comp.ispS && <span className="text-[var(--ma-gold)]">Isp {comp.ispS}s</span>}
                            {comp.solarAreaM2 && <span>{comp.solarAreaM2} m²</span>}
                            {comp.outputPowerW && <span>⚛ {comp.outputPowerW} W</span>}
                            {comp.propCapacityKg && <span>≤{comp.propCapacityKg} kg</span>}
                            <span>Rel {((comp.reliability ?? 0) * 100).toFixed(0)}%</span>
                          </div>
                          {locked && <span className="text-[10px] text-[var(--ma-warn)] block mt-1">🔒 {t('locked')}</span>}
                        </button>
                        {chosen && (
                          <label className="ma-taprow flex items-center gap-2 mt-2 pt-2 border-t border-[rgba(255,255,255,0.08)] text-[10px] text-[var(--ma-muted)]">
                            <input type="checkbox" checked={red} onChange={() => toggleRedundancy(c.id)} aria-label={`${t('redundancy')} ${comp.name}`} />
                            <span className="text-[var(--ma-text)] font-medium">{t('redundancy')} (+{comp.redundancyMassKg ?? comp.massKg} kg)</span>
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
          <HudFrame tag="PAYLOAD BAY 7×5 CLEANROOM" tagAr="حجرة الحمولة ٧×٥ المعقمة">
            {/* Quick Helper Actions for the Grid */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 p-2.5 rounded-xl bg-[rgba(6,11,24,0.7)] border border-white/10">
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <span>🤖</span>
                <span>{lang === 'ar' ? 'مساعد التجميع الذكي:' : 'Smart Bay Helper:'}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-[var(--ma-accent)] bg-[rgba(61,224,255,0.15)] hover:bg-[rgba(61,224,255,0.3)] text-xs text-white font-bold transition-all shadow-sm"
                  onClick={() => {
                    autoLayout();
                    sound.play('confirm');
                  }}
                >
                  🔄 {lang === 'ar' ? 'توزيع القطع آلياً' : 'Auto-Fit Bay'}
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-[var(--ma-gold)] bg-[rgba(233,195,124,0.15)] hover:bg-[rgba(233,195,124,0.3)] text-xs text-[var(--ma-gold)] font-bold transition-all shadow-sm"
                  onClick={() => {
                    if (propSpec) {
                      setPropellant(propSpec.propCapacityKg ?? 100);
                      sound.play('confirm');
                    }
                  }}
                >
                  ⛽ {lang === 'ar' ? 'تعبئة وقود كاملة' : 'Full Propellant'}
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <BayGrid />
              <div className="flex-1 w-full min-h-[250px] rounded-2xl overflow-hidden bg-[#03071a] relative border border-[rgba(61,224,255,0.2)] shadow-[0_0_30px_rgba(0,0,0,0.6)]">
                <Suspense
                  fallback={
                    <div className="ma-loading">
                      <span className="ma-loading-ring" aria-hidden />
                      <span>{lang === 'ar' ? 'جارٍ تحميل النموذج ثلاثي الأبعاد' : 'Loading 3D bay'}</span>
                    </div>
                  }
                >
                  <LazyBuilderPreview />
                </Suspense>
                <div className="absolute top-2 left-2"><PanelTag ar="معاينة حية" en="LIVE 3D" /></div>
                <div className="ma-hologram-scan" />
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-[var(--ma-muted)] mt-2">
              <span>{lang === 'ar' ? 'يمكنك وضع القطع يدوياً أو الضغط على "توزيع القطع آلياً" لتجهيزها فوراً.' : 'Place manually or click "Auto-Fit Bay" to arrange automatically.'}</span>
              <span className="ma-num text-[var(--ma-accent)] font-mono">GRID: 7×5 SLOTS</span>
            </div>
          </HudFrame>

          <HudFrame tag="SYSTEM STATUS & MARGINS" tagAr="حالة الأنظمة والهوامش">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 justify-items-center">
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
            <HudFrame tag="ASTRODYNAMICS EDUCATION" tagAr="تعلّم الميكانيكا المدارية">
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
          <HudFrame tag="PROPELLANT LOADING" tagAr="تحميل الوقود الدافع">
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
              <div className={`mt-3 p-2 rounded-lg border text-center font-bold text-xs ma-num ${budget.dvMarginMps >= 0 ? 'border-[rgba(47,224,90,0.3)] bg-[rgba(47,224,90,0.08)] text-[var(--ma-good)]' : 'border-[rgba(255,84,112,0.3)] bg-[rgba(255,84,112,0.08)] text-[var(--ma-bad)]'}`}>
                {t('margin')}: {budget.dvMarginMps >= 0 ? '+' : ''}{budget.dvMarginMps.toFixed(0)} m/s
              </div>
            )}
          </HudFrame>

          <HudFrame tag="FLIGHT READINESS CHECKS" tagAr="فحوصات الجاهزية">
            <ul className="space-y-2 max-h-[160px] overflow-auto ma-scroll pr-1">
              {(validate?.checks ?? []).map((c) => (
                <li key={c.id} className="text-[11px] leading-snug p-1.5 rounded-lg border border-[rgba(255,255,255,0.05)] bg-[rgba(5,10,22,0.5)]">
                  <span className={`uppercase font-bold tracking-wider text-[10px] mr-1.5 ${c.severity === 'fail' ? 'text-[var(--ma-bad)]' : c.severity === 'warn' ? 'text-[var(--ma-warn)]' : 'text-[var(--ma-good)]'}`}>
                    {c.severity === 'fail' ? '✕ FAIL' : c.severity === 'warn' ? '▲ WARN' : '✔ PASS'}
                  </span>
                  <span className="text-[var(--ma-muted)]">{c.message}</span>
                </li>
              ))}
            </ul>
          </HudFrame>

          <HudFrame tag="LAUNCH CLEARANCE" tagAr="تصريح الإطلاق">
            <div className="text-center py-2">
              <div className={`ma-clearance-stamp w-full ${validate?.go ? 'is-go' : 'is-nogo'}`}>
                <span>{validate?.go ? '✔' : '✕'}</span>
                <span>{validate?.go ? (lang === 'ar' ? 'تصريح طيران معتمد' : 'GO FOR LAUNCH') : (lang === 'ar' ? 'غير مصرح بالإطلاق' : 'NO-GO / UNRESOLVED')}</span>
              </div>
              <p className="text-[11px] text-[var(--ma-muted)] mt-2">
                {lang === 'ar' ? 'الوجهة: ' : 'Target: '}<strong className="text-white">{missionLabel}</strong>
              </p>
            </div>

            <div className="flex flex-col gap-2.5 mt-2">
              <button
                type="button"
                className={`ma-tap w-full py-3.5 rounded-xl text-sm font-extrabold uppercase tracking-widest ${validate?.go ? 'ma-master-launch-btn' : 'border border-[var(--ma-gold)] bg-[rgba(233,195,124,0.2)] hover:bg-[rgba(233,195,124,0.35)] text-[var(--ma-gold)] shadow-[0_0_20px_rgba(233,195,124,0.4)] animate-pulse'}`}
                onClick={() => {
                  if (validate?.go) {
                    beginLaunch();
                  } else {
                    instantLaunch();
                  }
                }}
              >
                {validate?.go ? `🚀 ${t('launch')}` : `⚡ ${lang === 'ar' ? 'تجهيز تلقائي فوري وانطلاق 🚀' : 'Auto-Fit & Launch 🚀'}`}
              </button>
              <button
                type="button"
                className="ma-tap w-full py-2.5 rounded-xl border border-[var(--ma-line)] text-xs font-bold uppercase tracking-wider hover:border-[var(--ma-accent)] hover:bg-[rgba(61,224,255,0.06)] transition-all text-white/80"
                onClick={() => setScreen('launcher')}
              >
                {t('next')}: {t('launcher')} →
              </button>
            </div>
          </HudFrame>
        </div>
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

  const cellPx = 48;
  const placedList = Object.entries(builder.placed).filter(([, p]) => p) as [ComponentCategory, NonNullable<(typeof builder.placed)[ComponentCategory]>][];
  const selCat = builder.selectedCategory;
  const selSpec = design.components[selCat] ? lookupTables().components[design.components[selCat]!] : null;
  const ghostW = builder.rotation ? selSpec?.footprintH ?? 2 : selSpec?.footprintW ?? 2;
  const ghostH = builder.rotation ? selSpec?.footprintW ?? 2 : selSpec?.footprintH ?? 2;

  const canPlaceHere = useMemo(() => {
    const others = placedList.filter(([cat]) => cat !== selCat).map(([, p]) => p);
    const x = builder.cursor.x, y = builder.cursor.y;
    if (x < 0 || y < 0 || x + ghostW > 7 || y + ghostH > 5) return false;
    return !others.some((p) => x < p.x + p.w && x + ghostW > p.x && y < p.y + p.h && y + ghostH > p.y);
  }, [placedList, builder.cursor, ghostW, ghostH, selCat]);

  const catColor: Record<string, string> = {
    bus: '#8FA3C8', power: '#46C8FF', propulsion: '#FF8A2F', comms: '#FFB81F', payload: '#2FE39A', thermal: '#B05CFF',
  };

  return (
    <div
      className="ma-cleanroom-deck p-2 select-none shrink-0"
      style={{ width: 7 * cellPx + 16, height: 5 * cellPx + 16 }}
      role="grid"
      aria-label="Payload bay cleanroom grid"
    >
      <div className="relative" style={{ width: 7 * cellPx, height: 5 * cellPx }}>
        {Array.from({ length: 35 }).map((_, i) => {
          const x = i % 7, y = Math.floor(i / 7);
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              aria-label={`slot ${String.fromCharCode(65 + y)}${x + 1}`}
              className="ma-cleanroom-cell rounded-md"
              style={{ left: x * cellPx, top: y * cellPx, width: cellPx, height: cellPx }}
              onClick={() => setCursor(x, y)}
              onDoubleClick={() => { setCursor(x, y); placePart(); }}
            >
              <span className="absolute bottom-1 right-1 text-[7px] font-mono text-white/20 pointer-events-none">
                {String.fromCharCode(65 + y)}{x + 1}
              </span>
            </button>
          );
        })}

        {/* ghost preview */}
        {selSpec && (
          <div
            className="absolute pointer-events-none border-2 border-dashed rounded-lg transition-all"
            style={{
              left: builder.cursor.x * cellPx + 2,
              top: builder.cursor.y * cellPx + 2,
              width: ghostW * cellPx - 4,
              height: ghostH * cellPx - 4,
              borderColor: canPlaceHere ? 'var(--ma-good)' : 'var(--ma-bad)',
              background: `color-mix(in srgb, ${canPlaceHere ? 'var(--ma-good)' : 'var(--ma-bad)'} 18%, transparent)`,
              boxShadow: canPlaceHere ? '0 0 16px rgba(47,224,90,0.4)' : '0 0 16px rgba(255,84,112,0.4)',
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
              className="absolute flex flex-col items-center justify-center text-[10px] font-bold uppercase cursor-pointer rounded-lg overflow-hidden"
              style={{
                left: p.x * cellPx + 2,
                top: p.y * cellPx + 2,
                width: p.w * cellPx - 4,
                height: p.h * cellPx - 4,
                background: `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${catColor[cat]} 35%, #0B1A3D) 0%, #060e24 100%)`,
                border: `1.5px solid ${catColor[cat]}`,
                boxShadow: selected ? `0 0 20px ${catColor[cat]}, inset 0 0 10px ${catColor[cat]}` : `0 0 10px rgba(0,0,0,0.5)`,
                color: '#fff',
                textShadow: `0 0 8px ${catColor[cat]}`,
                transform: selected ? 'scale(1.02)' : 'scale(1)',
                zIndex: selected ? 10 : 5,
                transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
              onClick={() => setCursor(p.x, p.y)}
              title={spec?.name}
            >
              <div className="absolute top-1 left-1.5 text-[7px] font-mono opacity-70 tracking-widest" style={{ color: catColor[cat] }}>
                {cat.toUpperCase()}
              </div>
              <span className="px-1.5 text-center leading-tight truncate max-w-full">
                {spec ? (spec.name.length > 12 ? spec.name.slice(0, 11) + '…' : spec.name) : cat}
              </span>
              <div className="absolute bottom-1 right-1.5 text-[7px] font-mono opacity-80" style={{ color: catColor[cat] }}>
                {spec ? `${spec.massKg}kg` : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
