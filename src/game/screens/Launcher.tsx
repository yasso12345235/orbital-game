/** Screen 5 — Launcher Select: rockets to relative scale on a measured axis. */
import { useMission, LAUNCHERS } from '../store';
import { useLang, useT } from '../hooks';
import { Bi, HudFrame, Kpi, PanelTag, fmt } from '../components/controls';
import { sound } from '../audio';

const LAUNCHER_COLORS: Record<string, string> = {
  electron: '#46C8FF',
  vega_c: '#2FE39A',
  falcon9: '#FFC542',
  ariane64: '#FF8A2F',
  falcon_heavy: '#A77BFF',
};

export function LauncherScreen() {
  const t = useT();
  const lang = useLang();
  const launcherId = useMission((s) => s.launcherId);
  const setLauncher = useMission((s) => s.setLauncher);
  const validate = useMission((s) => s.validate);
  const setScreen = useMission((s) => s.setScreen);
  const progress = useMission((s) => s.progress);
  const back = useMission((s) => s.setScreen);

  const mass = validate?.budget.totalMassKg ?? 0;
  const maxCap = Math.max(...LAUNCHERS.map((l) => l.capacityToLeoKg));
  // log-ish visual scale so Electron stays visible next to Heavy
  const heightFor = (cap: number) => 40 + (Math.log10(Math.max(10, cap)) / Math.log10(maxCap)) * 130;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
      <HudFrame tag="LAUNCH VEHICLES" tagAr="صواريخ الإطلاق">
        <div className="relative">
          {/* measured axis */}
          <div className="absolute left-0 right-0 bottom-0 h-full pointer-events-none" aria-hidden>
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <div key={f} className="absolute left-0 right-0 border-t border-dashed border-[var(--ma-line)]" style={{ bottom: `${f * 100}%` }}>
                <span className="absolute -top-3 right-0 text-[9px] ma-num text-[var(--ma-muted)]">{fmt(maxCap * f)} kg</span>
              </div>
            ))}
          </div>

          <div className="flex items-end justify-around gap-4 pt-6 pb-2 min-h-[240px]">
            {LAUNCHERS.map((l) => {
              const locked = !unlockedLaunchers(progress.unlockedTech).has(l.id);
              const selected = l.id === launcherId;
              const canLift = l.capacityToLeoKg >= mass;
              const h = heightFor(l.capacityToLeoKg);
              const w = 18 + (h / 170) * 16;
              return (
                <button
                  key={l.id}
                  type="button"
                  disabled={locked}
                  onClick={() => { setLauncher(l.id); sound.play('attach'); }}
                  className={`flex flex-col items-center gap-2 transition-all duration-500 ${selected ? 'scale-105' : 'opacity-80 hover:opacity-100'} ${locked ? 'opacity-35 cursor-not-allowed' : ''}`}
                  aria-pressed={selected}
                  aria-label={l.name}
                >
                  <svg width={w + 24} height={h + 26} viewBox={`0 0 ${w + 24} ${h + 26}`} aria-hidden>
                    <defs>
                      <linearGradient id={`lg-${l.id}`} x1="0" x2="1">
                        <stop offset="0%" stopColor="#f2f5fa" />
                        <stop offset="55%" stopColor="#c8d4ea" />
                        <stop offset="100%" stopColor="#8a93a8" />
                      </linearGradient>
                    </defs>
                    {/* body */}
                    <rect x={12} y={14} width={w} height={h - 14} rx={4} fill={`url(#lg-${l.id})`} />
                    {/* nose */}
                    <path d={`M ${12} 14 L ${12 + w / 2} 0 L ${12 + w} 14 Z`} fill={LAUNCHER_COLORS[l.id]} />
                    {/* fins */}
                    <path d={`M 12 ${h - 4} L 2 ${h + 10} L 12 ${h - 22} Z`} fill="#8a93a8" />
                    <path d={`M ${12 + w} ${h - 4} L ${22 + w} ${h + 10} L ${12 + w} ${h - 22} Z`} fill="#8a93a8" />
                    {/* stripe */}
                    <rect x={12} y={h * 0.42} width={w} height={4} fill={LAUNCHER_COLORS[l.id]} opacity={0.85} />
                    {selected && <rect x={8} y={10} width={w + 8} height={h} rx={6} fill="none" stroke={LAUNCHER_COLORS[l.id]} strokeWidth="1.5" strokeDasharray="5 5" />}
                  </svg>
                  <span className="text-[10px] uppercase tracking-wider text-center max-w-[90px]">
                    {lang === 'ar' ? l.nameAr ?? l.name : l.name}
                  </span>
                  <span className={`ma-num text-[10px] ${canLift ? 'text-[var(--ma-good)]' : 'text-[var(--ma-bad)]'}`}>
                    {fmt(l.capacityToLeoKg)} kg
                  </span>
                  {locked && <span className="text-[10px]">🔒</span>}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-[10px] text-[var(--ma-muted)] mt-2">
          {lang === 'ar' ? 'ارتفاع الرسم نسبي لوغاريتميًا — القيم تعليمية مبسطة.' : 'Drawing height is log-relative; capacities are simplified educational values.'}
        </p>
      </HudFrame>

      <div className="flex flex-col gap-4">
        {(() => {
          const l = LAUNCHERS.find((x) => x.id === launcherId) ?? LAUNCHERS[0];
          const margin = l.capacityToLeoKg - mass;
          return (
            <HudFrame tag="SELECTED VEHICLE" tagAr="الصاروخ المختار">
              <h3 className="text-xl" style={{ fontFamily: 'var(--ma-hud)' }}>{lang === 'ar' ? l.nameAr ?? l.name : l.name}</h3>
              <p className="text-[12px] text-[var(--ma-muted)] mt-1">{lang === 'ar' ? l.descriptionAr ?? l.description : l.description}</p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <Kpi ar="السعة" en="Capacity" value={fmt(l.capacityToLeoKg)} unit="kg" accent="var(--ma-accent)" />
                <Kpi ar="التكلفة" en="Cost" value={fmt(l.cost)} accent="var(--ma-warn)" />
                <Kpi ar="الموثوقية" en="Reliability" value={(l.reliability * 100).toFixed(0)} unit="%" accent="var(--ma-good)" />
                <Kpi ar="الهامش" en="Mass margin" value={(margin >= 0 ? '+' : '') + fmt(margin)} unit="kg" accent={margin >= 0 ? 'var(--ma-good)' : 'var(--ma-bad)'} />
              </div>
              <p className={`mt-3 text-[12px] ${margin >= 0 ? 'text-[var(--ma-good)]' : 'text-[var(--ma-bad)]'}`}>
                {margin >= 0
                  ? (lang === 'ar' ? `يفي بالكتلة الحالية (${fmt(mass)} كغ).` : `Lifts current ${fmt(mass)} kg spacecraft.`)
                  : (lang === 'ar' ? `أخف من الحاجة بـ ${fmt(-margin)} كغ — اختر صاروخًا أكبر أو خفف التصميم.` : `Short by ${fmt(-margin)} kg vs current ${fmt(mass)} kg design — pick bigger or shed mass.`)}
              </p>
              <p className="text-[10px] text-[var(--ma-muted)] mt-2">{l.source}</p>
              <div className="flex gap-2 mt-4">
                <button type="button" className="ma-tap flex-1 py-2 rounded-lg border border-[var(--ma-line)] text-xs uppercase hover:border-[var(--ma-accent)]" onClick={() => back('builder')}>
                  ← {t('builder')}
                </button>
                <button type="button" className="ma-tap flex-1 py-2 rounded-lg ma-cta-gold text-xs font-bold uppercase" onClick={() => setScreen('orbit')}>
                  {t('next')}: {t('orbit')} →
                </button>
              </div>
            </HudFrame>
          );
        })()}

        <HudFrame tag="TIP" tagAr="نصيحة">
          <Bi
            ar="سعة الصاروخ تشمل كل شيء: المركبة + الوقود. الهامش الصحي 10–20٪."
            en="Capacity covers everything: spacecraft + propellant. Healthy margin is 10–20%."
            stack
          />
        </HudFrame>
      </div>
    </div>
  );
}

function unlockedLaunchers(nodes: string[]): Set<string> {
  const set = new Set<string>(['electron']);
  if (nodes.includes('small_lift')) set.add('vega_c');
  if (nodes.includes('medium_lift')) { set.add('falcon9'); set.add('ariane64'); }
  if (nodes.includes('outer_planets')) set.add('falcon_heavy');
  return set;
}
