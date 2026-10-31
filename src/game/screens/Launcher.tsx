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
        <div className="relative rounded-xl overflow-hidden p-4 bg-[radial-gradient(ellipse_at_bottom,#0a1630_0%,#040714_85%)] border border-[color-mix(in_srgb,var(--ma-accent)_22%,var(--ma-line))]">
          {/* Blueprint engineering gantry grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            aria-hidden
            style={{
              backgroundImage: 'linear-gradient(to right, rgba(61,224,255,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(61,224,255,0.18) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          {/* Measured altitude axis */}
          <div className="absolute left-0 right-0 bottom-0 h-full pointer-events-none" aria-hidden>
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <div key={f} className="absolute left-0 right-0 border-t border-dashed border-[color-mix(in_srgb,var(--ma-line)_65%,transparent)]" style={{ bottom: `${f * 100}%` }}>
                <span className="absolute -top-3.5 right-2 text-[9px] ma-num text-[var(--ma-muted)] font-mono">{fmt(maxCap * f)} kg LEO</span>
              </div>
            ))}
          </div>

          <div className="flex items-end justify-around gap-4 pt-8 pb-3 min-h-[260px] relative z-10">
            {LAUNCHERS.map((l) => {
              const locked = !unlockedLaunchers(progress.unlockedTech).has(l.id);
              const selected = l.id === launcherId;
              const canLift = l.capacityToLeoKg >= mass;
              const h = heightFor(l.capacityToLeoKg);
              const w = 20 + (h / 170) * 16;
              const accentCol = LAUNCHER_COLORS[l.id] ?? 'var(--ma-accent)';
              return (
                <button
                  key={l.id}
                  type="button"
                  disabled={locked}
                  onClick={() => { setLauncher(l.id); sound.play('attach'); }}
                  className={`group flex flex-col items-center gap-2.5 transition-all duration-300 relative ${selected ? 'scale-105' : 'opacity-85 hover:opacity-100 hover:-translate-y-1'} ${locked ? 'opacity-30 cursor-not-allowed' : ''}`}
                  aria-pressed={selected}
                  aria-label={l.name}
                >
                  <svg width={w + 26} height={h + 34} viewBox={`0 0 ${w + 26} ${h + 34}`} className="overflow-visible" aria-hidden>
                    <defs>
                      <linearGradient id={`lg-${l.id}`} x1="0" x2="1">
                        <stop offset="0%" stopColor="#f8fbff" />
                        <stop offset="35%" stopColor="#d5e2f7" />
                        <stop offset="70%" stopColor="#a9bad8" />
                        <stop offset="100%" stopColor="#7c8ea8" />
                      </linearGradient>
                      <linearGradient id={`plume-${l.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accentCol} stopOpacity="0.8" />
                        <stop offset="60%" stopColor={accentCol} stopOpacity="0.25" />
                        <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Red gantry aviation safety beacon */}
                    <circle cx={13 + w / 2} cy={-2} r={2} fill="#ff3b30" className="animate-pulse" style={{ animationDuration: '1.2s' }} />

                    {/* Launchpad gantry clamp base */}
                    <rect x={13 - 4} y={h + 12} width={w + 8} height={4} rx={1} fill="rgba(255,255,255,0.18)" />

                    {/* Rocket body */}
                    <rect x={13} y={16} width={w} height={h - 6} rx={3} fill={`url(#lg-${l.id})`} />

                    {/* Fairing nosecone */}
                    <path d={`M 13 16 Q ${13 + w / 2} -4 ${13 + w} 16 Z`} fill={accentCol} />

                    {/* Interstage separation lines */}
                    <line x1={13} y1={h * 0.46} x2={13 + w} y2={h * 0.46} stroke="#070c18" strokeWidth="2.5" />
                    <line x1={13} y1={h * 0.48} x2={13 + w} y2={h * 0.48} stroke={accentCol} strokeWidth="1" />

                    {/* Aerodynamic fins */}
                    <path d={`M 13 ${h + 2} L 3 ${h + 12} L 13 ${h - 16} Z`} fill="#687895" />
                    <path d={`M ${13 + w} ${h + 2} L ${23 + w} ${h + 12} L ${13 + w} ${h - 16} Z`} fill="#687895" />

                    {/* Engine nozzles */}
                    <rect x={13 + w * 0.22} y={h + 10} width={w * 0.22} height={4} rx={1} fill="#343d52" />
                    <rect x={13 + w * 0.56} y={h + 10} width={w * 0.22} height={4} rx={1} fill="#343d52" />

                    {/* Animated Cryogenic LOX Venting effect on selected booster */}
                    {selected && (
                      <g className="pointer-events-none">
                        <ellipse cx={13 - 2} cy={h * 0.46} rx={4} ry={2.5} fill="rgba(255,255,255,0.6)" className="animate-ping" style={{ animationDuration: '2.4s' }} />
                        <ellipse cx={13 + w + 2} cy={h * 0.46} rx={4} ry={2.5} fill="rgba(255,255,255,0.6)" className="animate-ping" style={{ animationDuration: '2.4s', animationDelay: '0.6s' }} />
                      </g>
                    )}

                    {/* Selected state: glowing telemetry bracket + animated thrust plume */}
                    {selected && (
                      <g>
                        <rect x={7} y={6} width={w + 12} height={h + 16} rx={8} fill="none" stroke={accentCol} strokeWidth="1.5" strokeDasharray="6 4" />
                        {/* Engine plume glow */}
                        <ellipse cx={13 + w / 2} cy={h + 16} rx={w * 0.45} ry={10} fill={`url(#plume-${l.id})`} className="animate-pulse" style={{ animationDuration: '1.4s' }} />
                        <ellipse cx={13 + w / 2} cy={h + 19} rx={w * 0.22} ry={5} fill="#ffffff" opacity="0.65" className="animate-ping" style={{ animationDuration: '1.8s' }} />
                      </g>
                    )}
                  </svg>

                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-center max-w-[100px] text-[var(--ma-text)]">
                      {lang === 'ar' ? l.nameAr ?? l.name : l.name}
                    </span>
                    <span className={`ma-num text-[10px] font-bold ${canLift ? 'text-[var(--ma-good)]' : 'text-[var(--ma-bad)]'}`}>
                      {fmt(l.capacityToLeoKg)} kg
                    </span>
                    {locked && <span className="text-[10px] mt-0.5">🔒</span>}
                  </div>
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
          const utilPct = Math.min(100, Math.round((mass / l.capacityToLeoKg) * 100));
          return (
            <HudFrame tag="SELECTED VEHICLE" tagAr="الصاروخ المختار">
              <h3 className="text-xl font-bold tracking-wide" style={{ fontFamily: 'var(--ma-hud)' }}>{lang === 'ar' ? l.nameAr ?? l.name : l.name}</h3>
              <p className="text-[12px] text-[var(--ma-muted)] mt-1">{lang === 'ar' ? l.descriptionAr ?? l.description : l.description}</p>
              
              {/* Payload Capacity Utilisation Gauge */}
              <div className="mt-4 p-3 rounded-lg border border-[var(--ma-line)] bg-[rgba(6,12,26,0.6)]">
                <div className="flex justify-between items-center text-[10px] mb-1.5 uppercase font-mono">
                  <span className="text-[var(--ma-muted)] tracking-wider">{lang === 'ar' ? 'استغلال الحمولة' : 'Payload Utilisation'}</span>
                  <span className={`ma-num font-bold ${margin >= 0 ? 'text-[var(--ma-good)]' : 'text-[var(--ma-bad)]'}`}>{utilPct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${margin >= 0 ? 'bg-gradient-to-r from-[var(--ma-accent)] to-[var(--ma-good)]' : 'bg-[var(--ma-bad)]'}`}
                    style={{ width: `${Math.min(100, (mass / l.capacityToLeoKg) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-[var(--ma-muted)] ma-num mt-1 font-mono">
                  <span>{fmt(mass)} kg {lang === 'ar' ? 'المركبة' : 'payload'}</span>
                  <span>{fmt(l.capacityToLeoKg)} kg {lang === 'ar' ? 'الحد الأقصى' : 'max'}</span>
                </div>
              </div>

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
