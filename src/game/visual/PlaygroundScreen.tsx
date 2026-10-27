/**
 * Playground — the dedicated review route for the v2 shape library (step 2).
 * Shows every shape with live debug sliders, material/quality tier switching,
 * a control-state strip and the motion-preset demos. Read-only against the
 * game store; visuals only mirror real state (accent, quality, motion).
 * Lazy-loaded from MissionApp so R3F/drei never touch the initial chunk.
 */
import { useMemo, useState, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import { useAccentBridge } from './store-adapters/accent';
import { SceneShell } from './three/core/SceneShell';
import { useVisualQuality, type QualityTier } from './three/quality';
import {
  AsteroidField,
  Crystal,
  DataNode,
  EnergyRibbon,
  HoloFloor,
  HoloSphere,
  IridescentKnot,
  LightStreaks,
  Nebula,
  OrbitRing,
  ParticleField,
  Planet,
  Rocket,
  ShieldBubble,
  SpacecraftKit,
  WirePoly,
  type ShieldImpact,
  type WirePolyKind,
} from './three/shapes';
import { entrance, heroIntro, sceneTransition } from './motion/presets';
import { MOTION } from './theme/tokens';
import { HudSlider } from '../components/controls';
import { ActionChip } from '../components/MissionControl';
import { useLang } from '../hooks';
import { useMission } from '../store';

/* ------------------------------------------------------------------ */
/* Shape registry + debug parameters                                   */
/* ------------------------------------------------------------------ */

interface ParamDef {
  key: string;
  en: string;
  ar: string;
  min: number;
  max: number;
  step: number;
  def: number;
  unit: string;
  hint?: string;
}

type Get = (k: string) => number;

/** Per-screen context passed to entry renderers (live playground state). */
interface RenderCtx {
  impact: ShieldImpact | null;
}

interface ShapeEntry {
  id: string;
  en: string;
  ar: string;
  descEn: string;
  descAr: string;
  params: ParamDef[];
  render: (get: Get, ctx: RenderCtx) => ReactElement;
}

const TARGETS = ['earth', 'mars', 'jupiter', 'venus', 'titan'];

function P(key: string, en: string, ar: string, min: number, max: number, def: number, step = 0.05, unit = '', hint?: string): ParamDef {
  return { key, en, ar, min, max, step, def, unit, hint };
}

const ENTRIES: ShapeEntry[] = [
  {
    id: 'planet',
    en: 'Planet',
    ar: 'كوكب',
    descEn: 'Procedural surface + clouds + fresnel atmosphere.',
    descAr: 'سطح إجرائي + سحب + غلاف شفقي.',
    params: [
      P('target', 'Body', 'الجسم', 0, 4, 0, 1, 'idx', 'earth / mars / jupiter / venus / titan'),
      P('spin', 'Spin', 'الدوران', 0, 3, 1, 0.1, '×'),
      P('cloud', 'Clouds', 'السحب', 0, 1, 0.8),
      P('atmosphere', 'Atmosphere', 'الغلاف', 0.2, 2.4, 1.3, 0.1, '×'),
    ],
    render: (g) => (
      <Planet target={TARGETS[Math.round(g('target'))]} spin={g('spin')} cloud={g('cloud')} atmosphere={g('atmosphere')} />
    ),
  },
  {
    id: 'orbit',
    en: 'Orbit rings',
    ar: 'حلقات المدار',
    descEn: 'Dashed flow shader + travelling satellites.',
    descAr: 'شيدر خطوط متحركة + أقمار متنقلة.',
    params: [
      P('radius', 'Radius', 'النصف', 1.4, 3.6, 2.4, 0.1, 'u'),
      P('tilt', 'Tilt', 'الميل', 0, 70, 18, 1, '°'),
      P('speed', 'Speed', 'السرعة', 0, 2, 0.5, 0.05, '×'),
      P('dashes', 'Dashes', 'الشُرط', 8, 80, 42, 1),
      P('satellites', 'Satellites', 'الأقمار', 0, 6, 3, 1),
      P('locked', 'Locked', 'مقفل', 0, 1, 0, 1),
    ],
    render: (g) => (
      <OrbitRing
        radius={g('radius')}
        tilt={g('tilt')}
        speed={g('speed')}
        dashes={g('dashes')}
        satellites={g('satellites')}
        locked={g('locked') > 0.5}
      />
    ),
  },
  {
    id: 'holo',
    en: 'Holo sphere',
    ar: 'كرة هولو',
    descEn: 'Wireframe icosphere, constellation nodes, scan band.',
    descAr: 'أسلاك + عقد كوكبية + شريط مسح.',
    params: [
      P('radius', 'Radius', 'النصف', 0.8, 2.2, 1.5, 0.1, 'u'),
      P('scan', 'Scan band', 'شريط المسح', 0, 1, 0.5),
      P('nodes', 'Nodes', 'العقد', 3, 16, 8, 1),
      P('spin', 'Spin', 'الدوران', 0, 0.6, 0.12, 0.02, '×'),
    ],
    render: (g) => <HoloSphere radius={g('radius')} scan={g('scan')} nodes={g('nodes')} spin={g('spin')} />,
  },
  {
    id: 'crystal',
    en: 'Glass crystals',
    ar: 'كريستال زجاجي',
    descEn: 'Transmission + iridescence (tier-gated glass).',
    descAr: 'شفافية + قزحية (حسب الجودة).',
    params: [
      P('size', 'Size', 'الحجم', 0.4, 1.4, 0.9, 0.05, 'u'),
      P('transmission', 'Transmission', 'النفاذية', 0, 1, 1),
      P('iridescence', 'Iridescence', 'القزحية', 0, 1, 1),
      P('spin', 'Spin', 'الدوران', 0, 1, 0.25, 0.05, '×'),
    ],
    render: (g) => (
      <Crystal size={g('size')} transmission={g('transmission')} iridescence={g('iridescence')} spin={g('spin')} />
    ),
  },
  {
    id: 'knot',
    en: 'Iridescent knot',
    ar: 'عقدة قزحية',
    descEn: 'Fresnel hue-shift torus knot + companion ring.',
    descAr: 'هويّة قزحية على عقدة حلقية.',
    params: [
      P('knotP', 'Knot P', 'P', 1, 4, 2, 1),
      P('knotQ', 'Knot Q', 'Q', 2, 7, 3, 1),
      P('hue', 'Hue spread', 'مدى اللون', 0, 1, 0.45),
      P('glow', 'Glow', 'التوهج', 0.4, 3, 1.7, 0.1, '×'),
      P('spin', 'Spin', 'الدوران', 0, 1, 0.3, 0.05, '×'),
    ],
    render: (g) => (
      <IridescentKnot knotP={g('knotP')} knotQ={g('knotQ')} hue={g('hue')} glow={g('glow')} spin={g('spin')} />
    ),
  },
  {
    id: 'asteroids',
    en: 'Asteroid field',
    ar: 'حقل الكويكبات',
    descEn: 'Instanced displaced rocks, quality-scaled count.',
    descAr: 'صخور منزاحة بالنسخ، العدد حسب الجودة.',
    params: [
      P('count', 'Count', 'العدد', 20, 400, 220, 10),
      P('spread', 'Spread', 'الانتشار', 3, 12, 7, 0.2, 'u'),
      P('tumble', 'Tumble', 'التدحرج', 0, 3, 1, 0.1, '×'),
      P('size', 'Size', 'الحجم', 0.06, 0.4, 0.16, 0.02, 'u'),
    ],
    render: (g) => <AsteroidField count={g('count')} spread={g('spread')} tumble={g('tumble')} size={g('size')} />,
  },
  {
    id: 'wire',
    en: 'Wireframe poly',
    ar: 'مجسّم شبكي',
    descEn: 'Additive wireframe solids in the live accent.',
    descAr: 'مجسمات شبكية بلمعان اللون الحي.',
    params: [
      P('kind', 'Kind', 'النوع', 0, 2, 0, 1, 'idx', 'icosa / dodeca / tetra'),
      P('size', 'Size', 'الحجم', 0.6, 2, 1.35, 0.05, 'u'),
      P('speed', 'Spin', 'الدوران', 0, 1, 0.25, 0.05, '×'),
      P('opacity', 'Opacity', 'العتامة', 0.2, 1, 0.85),
    ],
    render: (g) => (
      <WirePoly
        kind={(['icosa', 'dodeca', 'tetra'] as WirePolyKind[])[Math.round(g('kind'))]}
        size={g('size')}
        speed={g('speed')}
        opacity={g('opacity')}
      />
    ),
  },
  {
    id: 'particles',
    en: 'Particle field',
    ar: 'حقل جزيئات',
    descEn: 'Layered Points with parallax drift (2k/10k/30k cap).',
    descAr: 'طبقات نقطية بانحراف متوازي (حدّ الجودة).',
    params: [
      P('count', 'Count', 'العدد', 500, 30000, 12000, 500),
      P('spread', 'Spread', 'الانتشار', 8, 40, 24, 1, 'u'),
      P('drift', 'Drift', 'الانحراف', 0, 3, 1, 0.1, '×'),
    ],
    render: (g) => <ParticleField count={g('count')} spread={g('spread')} drift={g('drift')} />,
  },
  {
    id: 'ribbon',
    en: 'Energy ribbon',
    ar: 'شريط طاقة',
    descEn: 'CatmullRom tube with flowing dashes.',
    descAr: 'أنبوب منحنٍ بتدفق ضوئي.',
    params: [
      P('flow', 'Flow', 'التدفق', 0, 2, 0.6, 0.05, '×'),
      P('glow', 'Glow', 'التوهج', 0.4, 3, 1.6, 0.1, '×'),
      P('repeat', 'Dashes', 'الشرط', 2, 14, 6, 1),
      P('tube', 'Tube', 'السماكة', 0.02, 0.12, 0.05, 0.01, 'u'),
    ],
    render: (g) => <EnergyRibbon flow={g('flow')} glow={g('glow')} repeat={g('repeat')} tube={g('tube')} />,
  },
  {
    id: 'streaks',
    en: 'Light streaks',
    ar: 'خطوط ضوئية',
    descEn: 'Instanced warp quads, length = speed.',
    descAr: 'ومضات سرعة، الطول حسب السرعة.',
    params: [
      P('count', 'Count', 'العدد', 6, 80, 36, 2),
      P('speed', 'Speed', 'السرعة', 0, 1, 0.6),
      P('spread', 'Spread', 'الانتشار', 6, 20, 14, 0.5, 'u'),
    ],
    render: (g) => <LightStreaks count={g('count')} speed={g('speed')} spread={g('spread')} />,
  },
  {
    id: 'floor',
    en: 'Holo floor',
    ar: 'أرضية هولو',
    descEn: 'AA grid + scan pulse shader.',
    descAr: 'شبكة بمحاذاة دقيقة + نبضة مسح.',
    params: [
      P('scale', 'Cells', 'الخلايا', 0.3, 2.4, 0.9, 0.1, '×'),
      P('fade', 'Fade', 'التلاشي', 10, 50, 26, 1, 'u'),
      P('pulse', 'Pulse', 'النبضة', 0, 1, 0.6),
      P('pulseSpeed', 'Pulse speed', 'سرعة النبضة', 0, 20, 6, 0.5, '×'),
    ],
    render: (g) => (
      <HoloFloor scale={g('scale')} fade={g('fade')} pulse={g('pulse')} pulseSpeed={g('pulseSpeed')} y={-2.2} />
    ),
  },
  {
    id: 'nebula',
    en: 'Nebula / aurora',
    ar: 'سديم / شفق',
    descEn: 'Additive fbm billboards, very slow drift.',
    descAr: 'لوحات ضبابية إضافية بانحراف بطيء.',
    params: [
      P('intensity', 'Intensity', 'الشدة', 0.2, 1.6, 0.9),
      P('drift', 'Drift', 'الانحراف', 0, 0.1, 0.02, 0.005, 'x'),
    ],
    render: (g) => <Nebula intensity={g('intensity')} drift={g('drift')} />,
  },
  {
    id: 'node',
    en: 'Data node',
    ar: 'عقدة بيانات',
    descEn: 'Pulse rings + leader line + HTML label.',
    descAr: 'حلقات نبض + خط + وسم HTML.',
    params: [
      P('pulse', 'Pulse', 'النبض', 0.2, 2.5, 1, 0.1, '×'),
      P('rings', 'Rings', 'الحلقات', 1, 2, 2, 1),
      P('leader', 'Leader', 'الخط', 0.6, 2.2, 1.35, 0.05, 'u'),
    ],
    render: (g) => <DataNode label="NODE-01 · ΔV" pulse={g('pulse')} rings={g('rings')} leader={g('leader')} />,
  },
  {
    id: 'craft',
    en: 'Spacecraft kit',
    ar: 'طقم المركبة',
    descEn: 'Bus, folding wings, dish, RTG, glow — Builder pieces.',
    descAr: 'هيكل، أجنحة قابلة للطيّ، صحن، RTG — قطع الورشة.',
    params: [
      P('unfold', 'Wing unfold', 'فتح الأجنحة', 0, 1, 1),
      P('rtg', 'RTG', 'RTG', 0, 1, 1, 1),
      P('thrust', 'Thrust', 'الدفع', 0, 1, 0.4),
      P('spin', 'Spin', 'الدوران', 0, 1, 0.2, 0.05, '×'),
    ],
    render: (g) => (
      <SpacecraftKit unfold={g('unfold')} rtg={g('rtg')} thrust={g('thrust')} spin={g('spin')} />
    ),
  },
  {
    id: 'shield',
    en: 'Shield bubble',
    ar: 'درع واقٍ',
    descEn: 'Hex veil + fresnel rim + impact ripple.',
    descAr: 'نسيج سداسي + حافة + موجة صدم.',
    params: [
      P('intensity', 'Rim', 'الحافة', 0.3, 2, 1.1, 0.1, '×'),
      P('hexOpacity', 'Hex veil', 'النسيج', 0, 1, 0.55),
    ],
    render: (g, ctx) => <ShieldBubble intensity={g('intensity')} hexOpacity={g('hexOpacity')} impact={ctx.impact} />,
  },
  {
    id: 'rocket',
    en: 'Rocket',
    ar: 'صاروخ',
    descEn: 'Stacked stages, fairing, fins, separation, plume.',
    descAr: 'مراحل متراكبة، قمع، زعانف، فصل، لهب.',
    params: [
      P('sep', 'Separation', 'الفصل', 0, 1, 0),
      P('thrust', 'Thrust', 'الدفع', 0, 1, 0.8),
      P('radius', 'Radius', 'النصف', 0.25, 0.7, 0.42, 0.01, 'u'),
      P('fins', 'Fins', 'الزعانف', 0, 6, 3, 1),
    ],
    render: (g) => <Rocket sep={g('sep')} thrust={g('thrust')} radius={g('radius')} fins={g('fins')} />,
  },
];

const ALL_DEFS = new Map<string, ParamDef>();
for (const e of ENTRIES) for (const p of e.params) ALL_DEFS.set(`${e.id}.${p.key}`, p);

/* ------------------------------------------------------------------ */
/* Motion presets panel                                                */
/* ------------------------------------------------------------------ */

const MOTION_DEMOS = [
  { id: 'entrance', en: 'Entrance · 0.30s', ar: 'دخول · ٠٫٣٠ث', t: entrance },
  { id: 'scene', en: 'Scene · 0.60s', ar: 'مشهد · ٠٫٦٠ث', t: sceneTransition },
  { id: 'hero', en: 'Hero · 1.20s', ar: 'بطولي · ١٫٢٠ث', t: heroIntro },
];

function MotionPanel({ lang }: { lang: string }) {
  const [tick, setTick] = useState(0);
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4" key={tick}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-widest text-[var(--ma-muted)]">
          {lang === 'ar' ? 'معاينة حركات الدخول' : 'Entrance motion previews'}
        </p>
        <button
          type="button"
          className="rounded border border-[var(--ma-line)] px-2 py-1 text-[10px] uppercase tracking-widest text-[var(--ma-text)] hover:border-[var(--ma-accent)]"
          onClick={() => setTick((t) => t + 1)}
        >
          {lang === 'ar' ? 'إعادة' : 'Replay'}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {MOTION_DEMOS.map((d) => (
          <motion.div
            key={d.id}
            className="rounded border border-[var(--ma-line)] bg-[var(--ma-panel)]/60 p-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={d.t}
          >
            <p className="text-[10px] uppercase tracking-widest text-[var(--ma-text)]">{lang === 'ar' ? d.ar : d.en}</p>
            <div className="mt-2 h-8 rounded" style={{ background: 'linear-gradient(90deg, var(--ma-accent), transparent)' }} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <motion.div
          className="rounded border border-[var(--ma-line)] bg-[var(--ma-panel)]/60 p-3"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        >
          <p className="text-[10px] uppercase tracking-widest text-[var(--ma-text)]">
            {lang === 'ar' ? 'زنبرك ناعم' : 'Spring soft'}
          </p>
          <div className="mt-2 h-8 w-8 rounded-full" style={{ background: 'var(--ma-accent)' }} />
        </motion.div>
        <motion.div
          className="rounded border border-[var(--ma-line)] bg-[var(--ma-panel)]/60 p-3"
          variants={{ hidden: {}, show: { transition: { staggerChildren: MOTION.stagger } } }}
          initial="hidden"
          animate="show"
        >
          <p className="text-[10px] uppercase tracking-widest text-[var(--ma-text)]">
            {lang === 'ar' ? 'تتابع' : 'Stagger'} · {MOTION.stagger}s
          </p>
          <div className="mt-2 flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span
                key={i}
                className="h-8 w-3 rounded-sm"
                style={{ background: 'var(--ma-accent)' }}
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
              />
            ))}
          </div>
        </motion.div>
      </div>

      <p className="text-[10px] leading-relaxed text-[var(--ma-muted)]">
        {lang === 'ar'
          ? 'كل الحركات تحترم prefers-reduced-motion: الكاميرا تثبت وتُلغى الانحرافات مع بقاء التوهج.'
          : 'Every preset honours prefers-reduced-motion: cameras lock, drift stops, glow stays.'}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function PlaygroundScreen() {
  useAccentBridge();
  const q = useVisualQuality();
  const lang = useLang();
  const setSetting = useMission((s) => s.setSetting);
  const setScreen = useMission((s) => s.setScreen);

  const [sel, setSel] = useState('planet');
  const [values, setValues] = useState<Record<string, number>>({});
  const [backdrop, setBackdrop] = useState({ floor: true, nebula: true, particles: true });
  const [autoRotate, setAutoRotate] = useState(true);
  const [impact, setImpact] = useState<{ dir: [number, number, number]; at: number } | null>(null);
  const [motionTick, setMotionTick] = useState(0);

  const get = useMemo(() => {
    const g = (id: string) => (k: string) => values[`${id}.${k}`] ?? ALL_DEFS.get(`${id}.${k}`)?.def ?? 0;
    return g;
  }, [values]);
  const set = (id: string, k: string, v: number) => setValues((prev) => ({ ...prev, [`${id}.${k}`]: v }));

  const entry = ENTRIES.find((e) => e.id === sel) ?? ENTRIES[0];
  const isMotion = sel === 'motion';

  const fireImpact = () => {
    const v = [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1];
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    setImpact({ dir: [v[0] / len, v[1] / len, v[2] / len], at: Date.now() });
  };

  const tierBtn = (t: QualityTier) => (
    <button
      key={t}
      type="button"
      className={`rounded border px-2 py-1 text-[10px] uppercase tracking-widest ${
        q.tier === t
          ? 'border-[var(--ma-accent)] text-[var(--ma-accent)]'
          : 'border-[var(--ma-line)] text-[var(--ma-muted)] hover:text-[var(--ma-text)]'
      }`}
      onClick={() => setSetting('quality', t)}
      aria-pressed={q.tier === t}
    >
      {t}
    </button>
  );

  return (
    <div className="ma-root-inner mx-auto grid max-w-[1200px] grid-cols-1 gap-3 px-2 py-3 lg:grid-cols-[170px_1fr_240px]">
      {/* Left rail — shape list */}
      <aside className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {[...ENTRIES.map((e) => e.id), 'motion'].map((id) => {
          const e = ENTRIES.find((x) => x.id === id);
          const label = id === 'motion' ? (lang === 'ar' ? 'الحركات' : 'Motion') : lang === 'ar' ? e!.ar : e!.en;
          const active = sel === id;
          return (
            <button
              key={id}
              type="button"
              className={`shrink-0 rounded border px-2 py-1.5 text-start text-[10px] uppercase tracking-widest ${
                active
                  ? 'border-[var(--ma-accent)] bg-[var(--ma-panel)] text-[var(--ma-accent)]'
                  : 'border-[var(--ma-line)] text-[var(--ma-muted)] hover:text-[var(--ma-text)]'
              }`}
              onClick={() => setSel(id)}
              aria-pressed={active}
            >
              {label}
            </button>
          );
        })}
        {/* Control-state strip (v3 chips) */}
        <div className="mt-2 hidden gap-2 rounded border border-[var(--ma-line)] p-2 lg:flex lg:flex-wrap">
          <ActionChip label="SCAN" ar="مسح" hint="X" hue="#2FE05A" />
          <ActionChip label="FIRE" ar="إطلاق" hint="SPACE" hue="#FF5470" />
          <ActionChip label="DOCK" ar="التحام" hint="Y" hue="#B05CFF" />
        </div>
      </aside>

      {/* Center — canvas or motion panel */}
      <section className="relative min-h-[360px] overflow-hidden rounded-xl border border-[var(--ma-line)] bg-[var(--ma-deep)]/40">
        {isMotion ? (
          <MotionPanel key={motionTick} lang={lang} />
        ) : (
          <>
            <SceneShell
              className="h-[46vh] min-h-[360px] w-full"
              camera={[0, 1.2, 9.6]}
              controls="orbit"
              orbitAutoRotate={autoRotate}
              env={{
                particles: backdrop.particles,
                nebula: backdrop.nebula,
                floor: backdrop.floor ? -2.2 : false,
                pulse: 0.35,
              }}
              effects={{ motion: 0.2 }}
              overlay={
                <div className="pointer-events-none absolute left-3 top-2 flex flex-col gap-0.5 text-[10px] uppercase tracking-widest text-[var(--ma-muted)]">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: 'var(--ma-accent)', boxShadow: '0 0 10px var(--ma-accent)' }}
                    />
                    {lang === 'ar' ? entry.descAr : entry.descEn}
                  </span>
                  <span>
                    tier: {q.tier} · {q.reduced ? 'reduced-motion' : 'full-motion'} · dpr ≤ {q.dprMax}
                  </span>
                </div>
              }
            >
              {entry.render(get(entry.id), { impact })}
            </SceneShell>
          </>
        )}
      </section>

      {/* Right rail — debug controls */}
      <aside className="flex flex-col gap-3 text-[var(--ma-text)]">
        <div className="rounded border border-[var(--ma-line)] p-2">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-[var(--ma-muted)]">
            {lang === 'ar' ? 'مستوى الجودة' : 'Quality tier'}
          </p>
          <div className="flex gap-1">{(['low', 'medium', 'high'] as QualityTier[]).map(tierBtn)}</div>
        </div>

        <div className="rounded border border-[var(--ma-line)] p-2">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-[var(--ma-muted)]">
            {lang === 'ar' ? 'الخلفية' : 'Backdrop'}
          </p>
          <div className="flex flex-wrap gap-1">
            {(['floor', 'nebula', 'particles'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`rounded border px-2 py-1 text-[10px] uppercase tracking-widest ${
                  backdrop[k]
                    ? 'border-[var(--ma-accent)] text-[var(--ma-accent)]'
                    : 'border-[var(--ma-line)] text-[var(--ma-muted)]'
                }`}
                aria-pressed={backdrop[k]}
                onClick={() => setBackdrop((b) => ({ ...b, [k]: !b[k] }))}
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              className={`rounded border px-2 py-1 text-[10px] uppercase tracking-widest ${
                autoRotate
                  ? 'border-[var(--ma-accent)] text-[var(--ma-accent)]'
                  : 'border-[var(--ma-line)] text-[var(--ma-muted)]'
              }`}
              aria-pressed={autoRotate}
              onClick={() => setAutoRotate((a) => !a)}
            >
              {lang === 'ar' ? 'تدوير' : 'rotate'}
            </button>
          </div>
        </div>

        {!isMotion && (
          <div className="flex flex-col gap-3 rounded border border-[var(--ma-line)] p-2">
            {entry.params.map((p) => (
              <HudSlider
                key={p.key}
                label={p.en}
                labelAr={p.ar}
                value={values[`${entry.id}.${p.key}`] ?? p.def}
                min={p.min}
                max={p.max}
                step={p.step}
                unit={p.unit}
                hint={p.hint}
                onChange={(v) => set(entry.id, p.key, v)}
              />
            ))}
            {entry.id === 'shield' && (
              <ActionChip label="IMPACT" ar="صدمة" hue="#FF5470" onPress={fireImpact} />
            )}
            {entry.id === 'rocket' && (
              <ActionChip
                label="SEPARATE"
                ar="فصل"
                hue="#B05CFF"
                onPress={() => set('rocket', 'sep', (values['rocket.sep'] ?? 0) > 0.5 ? 0 : 1)}
              />
            )}
          </div>
        )}

        <button
          type="button"
          className="rounded border border-[var(--ma-line)] px-2 py-1.5 text-[10px] uppercase tracking-widest text-[var(--ma-muted)] hover:border-[var(--ma-accent)] hover:text-[var(--ma-text)]"
          onClick={() => setScreen('styleGuide')}
        >
          {lang === 'ar' ? 'دليل الأنماط →' : 'Style guide →'}
        </button>
        <p className="text-[9px] leading-relaxed text-[var(--ma-muted)]">
          {lang === 'ar'
            ? 'معاينة قراءة فقط: لا تعدّل فيزياء اللعبة، واللون الحي هنا هو نفس uAccent المستخدم في كل المشاهد.'
            : 'Read-only review: nothing touches game physics; the accent here is the same uAccent every v2 scene uses.'}
        </p>
      </aside>
    </div>
  );
}
