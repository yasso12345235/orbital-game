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
import { Toasts } from './components/controls';
import { ShortcutSheet } from './components/ShortcutSheet';
import { AIHelper, AIChip } from './components/AIHelper';
import { Icon } from './components/Icon';
import { HomeScreen } from './screens/Home';
import { HangarScreen } from './screens/Hangar';
import { MissionSelectScreen } from './screens/MissionSelect';
import { BuilderScreen } from './screens/Builder';
import { LauncherScreen } from './screens/Launcher';
import { OrbitScreen } from './screens/Orbit';
import { SimulationScreen } from './screens/Simulation';
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
      {/* Ambient deep-space layer: parallax stars, aurora blooms, film grain, radar sweep. */}
      <div className="ma-ambient" aria-hidden>
        <i className="ma-amb-stars" />
        <i className="ma-amb-stars-2" />
        <i className="ma-amb-aurora ma-amb-aurora-a" />
        <i className="ma-amb-aurora ma-amb-aurora-b" />
        <i className="ma-amb-radar" />
        <i className="ma-amb-grain" />
      </div>
      {/* Top bar — floating glass chrome */}
      <header className={screen === 'home' ? 'ma-menubar mb-4' : 'ma-topbar mb-4'}>
        <div className="ma-topbar-main">
          <div className="ma-brand">
            <button
              type="button"
              className="ma-logo"
              onClick={() => setScreen('home')}
              aria-label={t('gameTitle')}
            >
              <span className="ma-logo-orbit"><Icon name="orbit" size={19} /></span>
              <span className="ma-logo-copy">
                <span className="ma-logo-word">{t('gameTitle')}</span>
                <span className="ma-logo-sub">{t('tagline')}</span>
              </span>
            </button>
            <span className="hidden lg:block h-7 w-px bg-[var(--ma-line)]" aria-hidden />
            <span className="text-[11px] text-[var(--ma-muted)] hidden lg:block truncate max-w-[300px]">{subtitle}</span>
          </div>

          {screen !== 'home' && (
            <nav ref={navRef} className="ma-screennav" aria-label="Screens">
              {(['home', 'hangar', 'missionSelect', 'builder', 'launcher', 'orbit', 'simulation', 'results', 'techTree'] as ScreenId[]).map((s) => (
                (s === 'simulation' && !useMission.getState().sim) || (s === 'descent' && !descentFlying)
                  ? null
                  : (
                    <button
                      key={s}
                      type="button"
                      className={`ma-navbtn ${screen === s ? 'is-active' : ''}`}
                      onClick={() => setScreen(s)}
                      aria-current={screen === s ? 'page' : undefined}
                    >
                      {t(s as StringKey)}
                    </button>
                  )
              ))}
              {descentFlying && (
                <button
                  type="button"
                  className={`ma-navbtn ${screen === 'descent' ? 'is-active' : ''}`}
                  onClick={() => setScreen('descent')}
                  aria-current={screen === 'descent' ? 'page' : undefined}
                >
                  {t('descent')}
                </button>
              )}
              {hasSurface && (
                <button
                  type="button"
                  className={`ma-navbtn ${screen === 'surface' ? 'is-active' : ''}`}
                  onClick={() => setScreen('surface')}
                  aria-current={screen === 'surface' ? 'page' : undefined}
                >
                  {t('surface')}
                </button>
              )}
            </nav>
          )}

          <div className="ma-topbar-tools">
            <div className="ma-topbar-telemetry hidden xl:flex items-center gap-2.5 px-3 py-1 rounded-full border border-[color-mix(in_srgb,var(--ma-accent)_24%,var(--ma-line))] bg-[rgba(6,12,26,0.65)] text-[10px] ma-num text-[var(--ma-muted)] shadow-inner">
              <span className="flex items-center gap-1.5 text-[var(--ma-good)]">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--ma-good)] shadow-[0_0_8px_var(--ma-good)] animate-pulse" />
                <span className="font-semibold tracking-wider text-[9px] uppercase">{lang === 'ar' ? 'الاتصال مستقر' : 'DSN LOCKED'}</span>
              </span>
              <span className="opacity-30">|</span>
              <span className="tracking-widest text-[var(--ma-text)]">UTC {utcTime}</span>
            </div>

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

            <button
              type="button"
              className="ma-topbar-quickbtn"
              onClick={() => setSetting('lang', lang === 'ar' ? 'en' : 'ar')}
              aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
              title={lang === 'ar' ? 'English' : 'العربية'}
            >
              <span className="ma-num text-[11px] font-bold">{lang === 'ar' ? 'EN' : 'ع'}</span>
            </button>

            {screen === 'home' && (
              <span className="ma-status hidden md:inline-flex" data-tone="accent">
                <i /> MISSION ARCHITECT PROGRAM · v1.7
              </span>
            )}
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
