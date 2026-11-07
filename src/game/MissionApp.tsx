/**
 * Mission Architect — app shell.
 * Owns RTL/LTR direction, dynamic accent theme, cinematic transitions,
 * the unified input layer, toasts, AI helper and the v3 control surface.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import '@fontsource/silkscreen/400.css';
import '@fontsource/orbitron/400.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/700.css';
import '@fontsource/jetbrains-mono/400.css';
import './theme.css';

import { useMission, MISSIONS, lookupTables, missionTheme } from './store';
import type { ScreenId } from './store';
import { useInputLayer } from './input';
import { useLang, useReducedMotion, useT } from './hooks';
import type { StringKey } from './i18n';
import { Toasts, fmt } from './components/controls';
import { ShortcutSheet } from './components/ShortcutSheet';
import { AIHelper, AIChip } from './components/AIHelper';
import { Icon, type IconName } from './components/Icon';
import { levelForXp } from './tech';
import { HomeScreen } from './screens/Home';
import { HangarScreen } from './screens/Hangar';
import { MissionSelectScreen } from './screens/MissionSelect';
import { BuilderScreen } from './screens/Builder';
import { LauncherScreen } from './screens/Launcher';
import { OrbitScreen } from './screens/Orbit';
import { SimulationScreen } from './screens/Simulation';
import { FlightScreen } from './screens/Flight';
import { ResultsScreen } from './screens/Results';
import { DescentScreen } from './screens/Descent';
import { SurfaceScreen } from './screens/Surface';
import { TechTreeScreen } from './screens/TechTree';
import { StyleGuideScreen } from './screens/StyleGuide';
import { sound } from './audio';

// v2 visual-layer review route — lazy so R3F/drei stay out of the main chunk.
const PlaygroundScreen = lazy(() => import('./visual/PlaygroundScreen'));
// v3 step 3 — wormhole transition played when leaving Home (lazy chunk).
const WormholeOverlay = lazy(() => import('./visual/WormholeOverlay'));

/** Screens a wormhole may warp into (meta routes are excluded). */
const WARP_TARGETS: ReadonlySet<ScreenId> = new Set<ScreenId>([
  'hangar',
  'missionSelect',
  'builder',
  'launcher',
  'orbit',
  'simulation',
  'results',
  'techTree',
  'descent',
  'surface',
  'flight',
]);

export default function MissionApp() {
  const screen = useMission((s) => s.screen);
  const lang = useLang();
  const t = useT();
  const reduced = useReducedMotion();
  const setScreen = useMission((s) => s.setScreen);
  const missionId = useMission((s) => s.missionId);
  const hasSurface = useMission((s) => !!s.surface);
  const descentFlying = useMission((s) => s.descent?.phase === 'flying');
  const settings = useMission((s) => s.settings);
  const setSetting = useMission((s) => s.setSetting);
  const loadWarning = useMission((s) => s.loadWarning);
  const dismissLoadWarning = useMission((s) => s.dismissLoadWarning);
  const progress = useMission((s) => s.progress);
  const sim = useMission((s) => s.sim);
  const level = levelForXp(progress.xp);

  const [utcTime, setUtcTime] = useState(() => new Date().toISOString().substring(11, 19));
  useEffect(() => {
    const timer = setInterval(() => {
      setUtcTime(new Date().toISOString().substring(11, 19));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useInputLayer();

  useEffect(() => { sound.setMuted(!settings.sound); sound.setVolume(settings.volume); sound.setEffectsVolume(settings.effectsVolume); sound.setAmbienceVolume(settings.ambienceVolume); }, [settings.sound, settings.volume, settings.effectsVolume, settings.ambienceVolume]);

  // Subtle hover feedback across the whole console (throttled; never on touch).
  useEffect(() => {
    if (!settings.sound) return;
    let last = 0;
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const el = (e.target as HTMLElement | null)?.closest('button, [role="button"], a');
      if (!el) return;
      const now = Date.now();
      if (now - last < 140) return;
      last = now;
      sound.play('keyHover');
    };
    document.addEventListener('pointerover', onOver);
    return () => document.removeEventListener('pointerover', onOver);
  }, [settings.sound]);

  // Wormhole transition (step 3) — plays once when leaving Home for a game screen.
  const [warp, setWarp] = useState(false);
  const prevScreenRef = useRef(screen);
  useEffect(() => {
    const prev = prevScreenRef.current;
    prevScreenRef.current = screen;
    if (prev === 'home' && screen !== 'home' && !reduced && WARP_TARGETS.has(screen)) setWarp(true);
  }, [screen, reduced]);

  // Warm the wormhole chunk while the visitor lingers on Home.
  useEffect(() => {
    if (screen === 'home') void import('./visual/WormholeOverlay');
  }, [screen]);

  // Accent theme from the current mission target.
  const theme = useMemo(() => {
    if (!missionId) return 'earth';
    const m = MISSIONS.find((x) => x.id === missionId);
    return missionTheme(m?.target ?? 'earth');
  }, [missionId]);

  // System title remains constant; the deck shows where we are.
  const subtitle = useMemo(() => {
    if (!missionId) return t('tagline');
    const m = MISSIONS.find((x) => x.id === missionId);
    if (!m) return t('tagline');
    const launcher = useMission.getState().launcherId;
    const ln = launcher ? lookupTables().launchers[launcher]?.name ?? '' : '';
    return `${lang === 'ar' ? m.nameAr ?? m.name : m.name}${ln ? ` · ${ln}` : ''}`;
  }, [missionId, lang, t]);

  // Keep the active destination visible inside the horizontally scrolling
  // screen rail (direct jumps from GO/Resume can land on an off-screen item).
  const navRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('.ma-navbtn.is-active');
    active?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [screen]);

  const screens: Record<string, JSX.Element> = {
    home: <HomeScreen />,
    hangar: <HangarScreen />,
    missionSelect: <MissionSelectScreen />,
    builder: <BuilderScreen />,
    launcher: <LauncherScreen />,
    orbit: <OrbitScreen />,
    simulation: <SimulationScreen />,
    flight: <FlightScreen />,
    results: <ResultsScreen />,
    descent: <DescentScreen />,
    surface: <SurfaceScreen />,
    techTree: <TechTreeScreen />,
    styleGuide: <StyleGuideScreen />,
    playground: (
      <Suspense fallback={null}>
        <PlaygroundScreen />
      </Suspense>
    ),
  };

  return (
    <div
      className={`ma-root ${reduced ? 'ma-reduced' : ''} min-h-screen px-3 py-3 md:px-5`}
      data-theme={theme}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Ambient dynamic deep-space cosmos: parallax stars, nebulae, twinkles, cosmic dust & shooting stars */}
      <div className="ma-ambient" aria-hidden>
        <i className="ma-amb-stars" />
        <i className="ma-amb-stars-2" />
        <i className="ma-amb-aurora ma-amb-aurora-a" />
        <i className="ma-amb-aurora ma-amb-aurora-b" />
        <i className="ma-amb-nebula-core" />
        <i className="ma-amb-twinkle" />
        <i className="ma-amb-cosmic-dust" />
        <i className="ma-amb-shooting-star ma-shooting-1" />
        <i className="ma-amb-shooting-star ma-shooting-2" />
        <i className="ma-amb-grain" />
      </div>
      {/* Top bar — floating glass chrome */}
      {/* Master Sci-Fi Spacecraft Bridge HUD Topbar (Always visible across all screens) */}
      <header className="ma-topbar mb-4">
        <div className="ma-topbar-main">
          {/* Logo & Orbital Gyroscope */}
          <div className="ma-brand">
            <button
              type="button"
              className="ma-logo group"
              onClick={() => { setScreen('home'); sound.play('key'); }}
              aria-label={t('gameTitle')}
            >
              <span className="ma-logo-orbit relative flex items-center justify-center">
                <span className="absolute inset-0 rounded-full border border-[var(--ma-accent)] opacity-60 animate-spin" style={{ animationDuration: '24s' }} />
                <span className="absolute inset-1 rounded-full border border-dashed border-[var(--ma-gold)] opacity-40 animate-spin" style={{ animationDuration: '14s', animationDirection: 'reverse' }} />
                <Icon name="orbit" size={20} className="relative z-10 text-[var(--ma-accent)] drop-shadow-[0_0_8px_var(--ma-accent)] group-hover:scale-110 transition-transform" />
              </span>
              <span className="ma-logo-copy">
                <span className="ma-logo-word font-black tracking-widest text-[20px] bg-gradient-to-r from-white via-[#d5e9ff] to-[var(--ma-accent)] bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(61,224,255,0.4)]">
                  {t('gameTitle')}
                </span>
                <span className="ma-logo-sub text-[8px] font-bold tracking-[0.3em] uppercase text-[var(--ma-gold-hi)] opacity-90">
                  {lang === 'ar' ? 'مختبر المهمات الفضائية' : 'SPACE MISSION LAB'}
                </span>
              </span>
            </button>
            <span className="hidden lg:block h-7 w-px bg-[var(--ma-line)]" aria-hidden />
            <span className="text-[11px] text-[var(--ma-muted)] hidden lg:block truncate max-w-[260px] font-medium">{subtitle}</span>
          </div>

          {/* Master Sci-Fi Navigation Deck — Always visible on all screens */}
          <nav ref={navRef} className="ma-screennav" aria-label="Flight Deck Navigation">
            {([
              { id: 'home', icon: 'home', labelKey: 'home' },
              { id: 'missionSelect', icon: 'missions', labelKey: 'missionSelect' },
              { id: 'builder', icon: 'builder', labelKey: 'builder' },
              { id: 'launcher', icon: 'launcher', labelKey: 'launcher' },
              { id: 'orbit', icon: 'orbit', labelKey: 'orbit' },
              { id: 'techTree', icon: 'tech', labelKey: 'techTree' },
              { id: 'hangar', icon: 'hangar', labelKey: 'hangar' },
            ] as const).map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ma-navbtn flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all duration-200 ${
                  screen === item.id
                    ? 'is-active shadow-[0_0_16px_rgba(233,195,124,0.3)] ring-1 ring-[var(--ma-gold)]/40'
                    : 'hover:bg-[rgba(61,224,255,0.08)] hover:text-white'
                }`}
                onClick={() => { setScreen(item.id); sound.play('key'); }}
                aria-current={screen === item.id ? 'page' : undefined}
              >
                <Icon name={item.icon} size={15} />
                <span>{t(item.labelKey as StringKey)}</span>
              </button>
            ))}

            {sim && (
              <button
                type="button"
                className={`ma-navbtn flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all duration-200 border border-[var(--ma-good)]/60 bg-[rgba(47,224,90,0.12)] text-[var(--ma-good)] shadow-[0_0_14px_rgba(47,224,90,0.25)] ${
                  screen === 'simulation' ? 'is-active' : ''
                }`}
                onClick={() => { setScreen('simulation'); sound.play('key'); }}
                aria-current={screen === 'simulation' ? 'page' : undefined}
              >
                <Icon name="simulation" size={15} />
                <span>{t('simulation')}</span>
                <span className="w-2 h-2 rounded-full bg-[var(--ma-good)] animate-ping" />
              </button>
            )}

            <button
              type="button"
              className={`ma-navbtn flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all duration-200 ${
                screen === 'flight' ? 'is-active shadow-[0_0_16px_rgba(61,224,255,0.3)] ring-1 ring-[var(--ma-accent)]/40' : ''
              }`}
              onClick={() => { setScreen('flight'); sound.play('key'); }}
              aria-current={screen === 'flight' ? 'page' : undefined}
            >
              <Icon name="rocket" size={15} />
              <span>{t('flight')}</span>
            </button>

            {descentFlying && (
              <button
                type="button"
                className={`ma-navbtn flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all duration-200 ${
                  screen === 'descent' ? 'is-active' : ''
                }`}
                onClick={() => { setScreen('descent'); sound.play('key'); }}
                aria-current={screen === 'descent' ? 'page' : undefined}
              >
                <Icon name="target" size={15} />
                <span>{t('descent')}</span>
              </button>
            )}

            {hasSurface && (
              <button
                type="button"
                className={`ma-navbtn flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all duration-200 ${
                  screen === 'surface' ? 'is-active' : ''
                }`}
                onClick={() => { setScreen('surface'); sound.play('key'); }}
                aria-current={screen === 'surface' ? 'page' : undefined}
              >
                <Icon name="globe" size={15} />
                <span>{t('surface')}</span>
              </button>
            )}
          </nav>

          {/* Commander Status, Telemetry & Controls */}
          <div className="ma-topbar-tools">
            {/* Live Credits Ticker */}
            <button
              type="button"
              onClick={() => { setScreen('techTree'); sound.play('key'); }}
              title={lang === 'ar' ? 'الرصيد الفضائي — انقر لفتح شجرة التقنيات' : 'Space Credits — Click to open Tech tree'}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--ma-gold)] bg-[rgba(233,195,124,0.14)] hover:bg-[rgba(233,195,124,0.24)] text-white text-xs font-mono font-bold shadow-[0_0_14px_rgba(233,195,124,0.25)] transition-all cursor-pointer"
            >
              <span>🪙</span>
              <span className="text-[var(--ma-gold-hi)] font-black">+{fmt(progress.credits)}</span>
              <span className="text-[var(--ma-gold)]/60 text-[10px]">CR</span>
            </button>

            {/* Officer Level Badge */}
            <span
              className="ma-hudtag px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg border border-[var(--ma-accent)] bg-[rgba(61,224,255,0.12)] text-[var(--ma-accent)] shadow-[0_0_10px_rgba(61,224,255,0.2)]"
              dir="ltr"
              title={lang === 'ar' ? `رتبة القائد: المستوى ${level}` : `Commander Rank: Level ${level}`}
            >
              LVL {level}
            </span>

            {/* DSN Telemetry Lock & Clock */}
            <div className="ma-topbar-telemetry hidden xl:flex items-center gap-2.5 px-3 py-1 rounded-full border border-[color-mix(in_srgb,var(--ma-accent)_24%,var(--ma-line))] bg-[rgba(6,12,26,0.65)] text-[10px] ma-num text-[var(--ma-muted)] shadow-inner">
              <span className="flex items-center gap-1.5 text-[var(--ma-good)]">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--ma-good)] shadow-[0_0_8px_var(--ma-good)] animate-pulse" />
                <span className="font-semibold tracking-wider text-[9px] uppercase">{lang === 'ar' ? 'الاتصال مستقر' : 'DSN LOCKED'}</span>
              </span>
              <span className="opacity-30">|</span>
              <span className="tracking-widest text-[var(--ma-text)] font-mono">UTC {utcTime}</span>
            </div>

            {/* Sound Toggle */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={`ma-topbar-quickbtn ${settings.sound ? 'is-active' : ''}`}
                onClick={() => setSetting('sound', !settings.sound)}
                aria-label={t('sound')}
                title={settings.sound ? (lang === 'ar' ? 'كتم الصوت' : 'Mute Sound') : (lang === 'ar' ? 'تشغيل الصوت' : 'Enable Sound')}
              >
                <Icon name={settings.sound ? 'volume' : 'mute'} size={15} />
              </button>
              {settings.sound && !reduced && (
                <div className="ma-equalizer hidden sm:flex" aria-hidden>
                  <i /><i /><i /><i /><i />
                </div>
              )}
            </div>

            {/* Language Switcher */}
            <button
              type="button"
              className="ma-topbar-quickbtn font-bold text-xs"
              onClick={() => setSetting('lang', lang === 'ar' ? 'en' : 'ar')}
              aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
              title={lang === 'ar' ? 'English' : 'العربية'}
            >
              <span className="ma-num text-[11px] font-black">{lang === 'ar' ? 'EN' : 'ع'}</span>
            </button>

            <AIChip />
            <div className="ma-tool-keys">
              <ShortcutSheet />
            </div>
          </div>
        </div>
      </header>

      {loadWarning && (
        <div className="ma-loadwarning mb-3" role="status">
          <span className="ma-loadwarning-ico" aria-hidden><Icon name="warning" size={16} /></span>
          <div className="min-w-0 flex-1">
            <b>{t('saveNotice')}</b>
            <span dir="ltr">{loadWarning}</span>
          </div>
          <button type="button" className="ma-btn-ghost" onClick={dismissLoadWarning}>
            {t('dismiss')}
          </button>
        </div>
      )}

      {/* Screen body with cinematic transition */}
      <main className="pb-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={reduced ? false : { opacity: 0, scale: 0.965, y: 14, filter: 'blur(7px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.985, y: -10, filter: 'blur(5px)' }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            {screens[screen] ?? <HomeScreen />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Live Astrodynamics Telemetry Stream Marquee */}
      <div className="ma-telemetry-ticker my-3 overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--ma-accent)_20%,var(--ma-line))] bg-[rgba(4,8,18,0.72)] backdrop-blur-md py-1.5 text-[9px] font-mono tracking-[0.24em] text-[var(--ma-muted)] uppercase" aria-hidden>
        <div className="ma-ticker-track flex items-center gap-8 whitespace-nowrap">
          <span className="flex items-center gap-2 text-[var(--ma-accent)] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ma-accent)] animate-ping" />
            ORBITAL SPACE LAB // LIVE OPS
          </span>
          <span className="opacity-30">///</span>
          <span>FLIGHT DIRECTOR: NOMINAL</span>
          <span className="opacity-30">///</span>
          <span className="text-[var(--ma-gold-hi)] font-semibold">ORBIT DYNAMICS: 2-BODY KEPLERIAN + J2 PERTURBATION</span>
          <span className="opacity-30">///</span>
          <span>COMM LINK: S-BAND 2.45 GHz CARRIER LOCK</span>
          <span className="opacity-30">///</span>
          <span>DELTA-V BUDGET: OPTIMIZED</span>
          <span className="opacity-30">///</span>
          <span className="text-[var(--ma-good)] font-semibold">SYSTEM TELEMETRY: GREEN 100%</span>
          <span className="opacity-30">///</span>
          <span>ATTITUDE CONTROL: REACTION WHEELS ARMED</span>
          <span className="opacity-30">///</span>
          <span>SOLAR FLUX: 1361 W/M²</span>
          <span className="opacity-30">///</span>
          <span className="flex items-center gap-2 text-[var(--ma-accent)] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ma-accent)] animate-ping" />
            ORBITAL SPACE LAB // LIVE OPS
          </span>
          <span className="opacity-30">///</span>
          <span>FLIGHT DIRECTOR: NOMINAL</span>
          <span className="opacity-30">///</span>
          <span className="text-[var(--ma-gold-hi)] font-semibold">ORBIT DYNAMICS: 2-BODY KEPLERIAN + J2 PERTURBATION</span>
          <span className="opacity-30">///</span>
          <span>COMM LINK: S-BAND 2.45 GHz CARRIER LOCK</span>
          <span className="opacity-30">///</span>
          <span>DELTA-V BUDGET: OPTIMIZED</span>
          <span className="opacity-30">///</span>
          <span className="text-[var(--ma-good)] font-semibold">SYSTEM TELEMETRY: GREEN 100%</span>
          <span className="opacity-30">///</span>
          <span>ATTITUDE CONTROL: REACTION WHEELS ARMED</span>
          <span className="opacity-30">///</span>
          <span>SOLAR FLUX: 1361 W/M²</span>
        </div>
      </div>

      <AIHelper />
      <Toasts />
      {warp && (
        <Suspense fallback={null}>
          <WormholeOverlay onDone={() => setWarp(false)} />
        </Suspense>
      )}
      {!reduced && <div className="ma-scanband" aria-hidden />}
      <p className="text-center text-[10px] text-[var(--ma-muted)] pb-2">{t('simplNote')}</p>
    </div>
  );
}
