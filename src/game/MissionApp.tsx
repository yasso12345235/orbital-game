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
]);

export default function MissionApp() {
  const screen = useMission((s) => s.screen);
  const lang = useLang();
  const t = useT();
  const reduced = useReducedMotion();
  const setScreen = useMission((s) => s.setScreen);
  const missionId = useMission((s) => s.missionId);
  const settings = useMission((s) => s.settings);
  const loadWarning = useMission((s) => s.loadWarning);
  const dismissLoadWarning = useMission((s) => s.dismissLoadWarning);

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

  const screens: Record<string, JSX.Element> = {
    home: <HomeScreen />,
    hangar: <HangarScreen />,
    missionSelect: <MissionSelectScreen />,
    builder: <BuilderScreen />,
    launcher: <LauncherScreen />,
    orbit: <OrbitScreen />,
    simulation: <SimulationScreen />,
    results: <ResultsScreen />,
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
      {/* Top bar — floating glass chrome */}
      <header className={screen === 'home' ? 'ma-menubar mb-4' : 'ma-topbar mb-4 flex items-center justify-between gap-3 flex-wrap'}>
        <div className="flex items-center gap-3 min-w-0">
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
        <div className="flex items-center gap-2 flex-wrap">
          {screen !== 'home' && (
            <nav className="flex items-center gap-0.5 flex-wrap" aria-label="Screens">
              {(['home', 'hangar', 'missionSelect', 'builder', 'launcher', 'orbit', 'simulation', 'results', 'techTree'] as const).map((s) => (
                s === 'simulation' && !useMission.getState().sim ? null : (
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
            </nav>
          )}
          {screen === 'home' && (
            <span className="ma-status hidden md:inline-flex" data-tone="accent">
              <i /> MISSION ARCHITECT PROGRAM · v1.5
            </span>
          )}
          <AIChip />
          <ShortcutSheet />
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
