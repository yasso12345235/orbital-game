/**
 * Screen 1 — Home / main menu.
 * Reference-driven shell: a cinematic planet limb (lazy 3D) behind a glass
 * command rail (icon + label), a huge ORBITAL wordmark, a live destination
 * card and a compact quick bar. Every number comes from the real store.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useMission, MISSIONS, accentForTarget, missionTheme } from '../store';
import { useLang, useT } from '../hooks';
import { fmt } from '../components/controls';
import { Icon, type IconName } from '../components/Icon';
import { levelForXp, unlockedIdsFor } from '../tech';
import { sound } from '../audio';

/** Three.js is deferred: the v3 hero scene lazy-loads after first paint. */
const LazyHomeHero = lazy(() => import('../visual/HomeHero'));

/** Destinations the hero can showcase. Each maps to a real mission id. */
const PEEK: { target: string; mission: string; label: string; labelAr: string }[] = [
  { target: 'moon', mission: 'lunar_probe', label: 'Lunar Probe', labelAr: 'مسبار القمر' },
  { target: 'venus', mission: 'venus_climate', label: 'Venus Orbiter', labelAr: 'مركبة الزهرة' },
  { target: 'mars', mission: 'mars_orbiter', label: 'Mars Orbiter', labelAr: 'مركبة المريخ' },
  { target: 'eros', mission: 'eros_rendezvous', label: 'Asteroid Eros', labelAr: 'كويكب إيروس' },
  { target: 'jupiter', mission: 'jupiter_probe', label: 'Jupiter Probe', labelAr: 'مسبار المشتري' },
  { target: 'titan', mission: 'titan_explorer', label: 'Titan Explorer', labelAr: 'مستكشف تيتان' },
];

/** Semicircular readiness dial (real XP progress, no invented telemetry). */
function ReadinessDial({ value, label }: { value: number; label: string }) {
  const frac = Math.max(0, Math.min(1, value / 100));
  const R = 34;
  const len = Math.PI * R;
  return (
    <div className="flex items-center gap-3" role="img" aria-label={`${label} ${Math.round(value)}%`}>
      <svg width="82" height="52" viewBox="0 0 90 56" className="overflow-visible">
        <path d="M 11 49 A 34 34 0 0 1 79 49" fill="none" stroke="var(--ma-line)" strokeWidth="5" strokeLinecap="round" />
        <path
          d="M 11 49 A 34 34 0 0 1 79 49"
          fill="none"
          stroke="var(--ma-accent)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)', filter: 'drop-shadow(0 0 6px color-mix(in srgb, var(--ma-accent) 65%, transparent))' }}
        />
        <circle cx="45" cy="49" r="3.2" fill="var(--ma-accent)" />
      </svg>
      <span className="flex flex-col leading-tight">
        <b className="ma-num text-[15px] text-[var(--ma-text)]">{Math.round(value)}%</b>
        <span className="ma-hudtag">{label}</span>
      </span>
    </div>
  );
}

export function HomeScreen() {
  const t = useT();
  const lang = useLang();
  const setScreen = useMission((s) => s.setScreen);
  const selectMission = useMission((s) => s.selectMission);
  const setHangarTab = useMission((s) => s.setHangarTab);
  const progress = useMission((s) => s.progress);
  const missionId = useMission((s) => s.missionId);
  const sim = useMission((s) => s.sim);
  const launch = useMission((s) => s.launch);
  const settings = useMission((s) => s.settings);
  const setSetting = useMission((s) => s.setSetting);
  const inFlight = !!sim && launch?.phase === 'ops';

  const initialFocus = useMemo(() => {
    if (!missionId) return 2; // Mars — the cinematic default
    const m = MISSIONS.find((x) => x.id === missionId);
    const idx = PEEK.findIndex((p) => p.target === m?.target);
    return idx >= 0 ? idx : 0;
  }, [missionId]);
  const [focus, setFocus] = useState(initialFocus);

  const webgl = useMemo(() => {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch {
      return false;
    }
  }, []);

  const completedCount = Object.keys(progress.completed).length;
  const bestScore = Math.max(0, ...Object.values(progress.completed).map((c) => c.score));
  const level = levelForXp(progress.xp);
  const xpPct = Math.min(100, (progress.xp % 300) / 3);
  const currentMission = missionId ? MISSIONS.find((m) => m.id === missionId) ?? null : null;
  const un = useMemo(() => unlockedIdsFor(progress.unlockedTech), [progress.unlockedTech]);

  const peek = PEEK[focus];
  const peekMission = MISSIONS.find((m) => m.id === peek.mission) ?? null;
  const peekDone = peekMission ? progress.completed[peekMission.id] : undefined;
  const peekUnlocked = peekMission ? un.missions.has(peekMission.id) : false;

  useEffect(() => {
    sound.startDrone();
    return () => sound.stopDrone();
  }, []);

  /** Continue: resume a live mission, else the flight plan, else Mission Select. */
  const continueMission = () => {
    const st = useMission.getState();
    if (st.sim && st.launch?.phase === 'ops') setScreen('simulation');
    else if (missionId) setScreen('builder');
    else setScreen('missionSelect');
  };

  const openHangar = (tab: 'profile' | 'hangar' | 'system') => {
    setHangarTab(tab);
    setScreen('hangar');
  };

  /** Load the featured destination; locked targets route to Research. */
  const openFeatured = () => {
    if (!peekMission) return;
    selectMission(peekMission.id);
    const st = useMission.getState();
    if (st.missionId !== peekMission.id) setScreen('techTree');
    else setScreen('builder');
  };

  const cycle = (dir: number) => setFocus((f) => (f + dir + PEEK.length) % PEEK.length);

  const menuSub = (key: string) => {
    switch (key) {
      case 'continue':
        if (inFlight) {
          return lang === 'ar' ? 'المهمة جارية — متابعة العمليات' : 'Mission in flight — resume operations';
        }
        return currentMission
          ? (lang === 'ar' ? currentMission.nameAr ?? currentMission.name : currentMission.name)
          : (lang === 'ar' ? 'اختر خطة طيران أولاً' : 'Pick a flight plan first');
      case 'new':
        return lang === 'ar' ? 'جاهزية الإطلاق وميزانية المهمة' : 'Launch readiness & mission budget';
      case 'select':
        return lang === 'ar' ? 'كل الوجهات والمهام' : 'All destinations & missions';
      case 'research':
        return lang === 'ar' ? 'شجرة التقنية والمكونات' : 'Tech tree & components';
      case 'hangar':
        return lang === 'ar' ? 'معاينة المركبة والمواصفات' : 'Spacecraft preview & specs';
      default:
        return lang === 'ar' ? 'النظام والصوت والإتاحة' : 'System, audio & accessibility';
    }
  };

  const primary = inFlight
    ? (lang === 'ar' ? 'متابعة العمليات' : 'Resume operations')
    : currentMission
      ? (lang === 'ar' ? 'متابعة الرحلة' : 'Resume flight plan')
      : (lang === 'ar' ? 'بدء مهمة جديدة' : 'Start a new mission');

  const statusChip = peekDone
    ? { tone: 'good' as const, text: t('completed') }
    : peekUnlocked
      ? { tone: 'accent' as const, text: t('available') }
      : { tone: 'muted' as const, text: t('locked') };

  return (
    <div className="ma-home-shell relative isolate overflow-hidden rounded-[28px] border border-[color-mix(in_srgb,var(--ma-accent)_24%,var(--ma-line))] min-h-[calc(100vh-128px)] flex flex-col p-4 sm:p-6 lg:p-8">
      {/* Cinematic orbit hairlines + sun flare behind the planet */}
      <div className="ma-epic-rings" aria-hidden><span /><span /><span /></div>
      <div className="ma-epic-flare" aria-hidden />

      {/* Deep space base + planet limb fallback (hidden once WebGL is live) */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(120% 90% at 18% 4%, #0b1730 0%, #060c19 42%, #05070d 74%), radial-gradient(70% 60% at 78% 88%, color-mix(in srgb, var(--ma-accent) 14%, transparent), transparent 70%)',
        }}
        aria-hidden
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 -bottom-[62vh] w-[150vw] md:w-[108vw] aspect-square rounded-full pointer-events-none -z-10"
        style={{
          background: `radial-gradient(circle at 50% 8%, ${accentForTarget(peek.target)} 0%, color-mix(in srgb, ${accentForTarget(peek.target)} 52%, #050B1F) 20%, #070d1c 44%, #05070d 66%)`,
          boxShadow: `0 -34px 150px color-mix(in srgb, ${accentForTarget(peek.target)} 34%, transparent), inset 0 60px 120px rgba(255,255,255,0.05)`,
          opacity: webgl ? 0 : 1,
          transition: 'background 0.9s ease',
        }}
        aria-hidden
      />

      {/* Living 3D hero (planet limb, starfield, flyby, meteors) */}
      {webgl && (
        <Suspense fallback={null}>
          <LazyHomeHero target={peek.target} className="ma-hero-in absolute inset-x-0 top-0 h-[92svh] -z-10 w-full opacity-95" />
        </Suspense>
      )}

      {/* Readability scrims */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(5,7,13,0.85) 0%, rgba(5,7,13,0.3) 34%, rgba(5,7,13,0.1) 52%, rgba(5,7,13,0.82) 100%), linear-gradient(100deg, rgba(5,7,13,0.65), transparent 48%)',
        }}
        aria-hidden
      />

      {/* TOP COMMAND DECK TELEMETRY BANNER */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-5 mb-5 border-b border-[color-mix(in_srgb,var(--ma-accent)_18%,var(--ma-line))]">
        <div className="flex flex-wrap items-center gap-2.5 text-[9.5px] font-mono tracking-[0.24em] text-[var(--ma-muted)] uppercase">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[color-mix(in_srgb,var(--ma-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--ma-accent)_12%,transparent)] text-[var(--ma-accent)] font-semibold shadow-[0_0_12px_rgba(61,224,255,0.25)]">
            <span className="w-2 h-2 rounded-full bg-[var(--ma-accent)] shadow-[0_0_8px_var(--ma-accent)] animate-pulse" />
            <span>FLIGHT CONTROL CENTER</span>
          </span>
          <span className="opacity-30">/</span>
          <span className="tracking-widest">28.5721° N · 80.6480° W</span>
          <span className="opacity-30">/</span>
          <span className="text-[var(--ma-gold-hi)] font-bold">{lang === 'ar' ? 'عمليات المدارات الفضائية' : 'ORBITAL DYNAMICS // READY'}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="ma-status" data-tone="good">
            <i />{lang === 'ar' ? 'الشبكة متصلة' : 'DSN ONLINE'}
          </span>
          <span className="ma-hudtag" dir="ltr">LVL {level} · {fmt(progress.credits)} CR</span>
        </div>
      </div>

      {/* MAIN COCKPIT GRID: HERO LEFT + OPERATIONS WINGS RIGHT */}
      <div className="relative z-10 flex-1 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        
        {/* LEFT COLUMN: HERO SHOWCASE & PLANETARY STAGE */}
        <div className="flex flex-col justify-between gap-6">
          <div>
            <span className="ma-epic-kicker">
              {lang === 'ar' ? 'برنامج مهندس المهمات الفضائية' : 'Mission Architect Program // NASA-ESA-SPX Spec'}
            </span>

            <h1 className="ma-hero-word mt-3 tracking-wider font-extrabold" dir="ltr">ORBITAL</h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="ma-hero-sub font-semibold text-[11px] text-[var(--ma-gold-hi)]">{t('tagline')}</span>
              <span className="text-[10px] font-mono tracking-[0.25em] text-[var(--ma-muted)] uppercase">
                {lang === 'ar' ? 'محاكاة فيزيائية حقيقية · مدارات كبلر' : 'KEPLERIAN ASTRODYNAMICS · REAL PHYSICS'}
              </span>
            </div>

            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-[var(--ma-muted)]">
              {t('credentials')}
            </p>

            {/* Dynamic Active Flight Vector Compass */}
            <div className="mt-5 flex items-center gap-4 p-3.5 rounded-2xl bg-[rgba(6,12,26,0.7)] border border-[color-mix(in_srgb,var(--ma-accent)_28%,var(--ma-line))] max-w-xl backdrop-blur-md shadow-[0_12px_35px_rgba(0,0,0,0.6)]">
              <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-dashed border-[var(--ma-accent)] animate-spin opacity-75" style={{ animationDuration: '22s' }} />
                <div className="absolute inset-2 rounded-full border border-[rgba(233,195,124,0.5)]" />
                <div className="w-4 h-4 rounded-full bg-[radial-gradient(circle,var(--ma-accent),#071638)] shadow-[0_0_12px_var(--ma-accent)]" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_#fff]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-[var(--ma-muted)]">
                  <span className="text-[var(--ma-text)] font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--ma-good)] shadow-[0_0_6px_var(--ma-good)] animate-pulse" />
                    {lang === 'ar' ? 'المسار المداري الحي' : 'ACTIVE FLIGHT VECTOR'}
                  </span>
                  <span className="text-[var(--ma-gold-hi)] font-bold">28.5° INC</span>
                </div>
                <div className="mt-1 flex flex-wrap justify-between gap-x-4 text-[11px] font-mono text-[var(--ma-muted)]">
                  <span>{lang === 'ar' ? 'الحضيض' : 'Periapsis'}: <b className="text-[var(--ma-text)]">185 km</b></span>
                  <span>{lang === 'ar' ? 'الأوج' : 'Apoapsis'}: <b className="text-[var(--ma-text)]">420 km</b></span>
                  <span>v: <b className="text-[var(--ma-accent)]">7.67 km/s</b></span>
                </div>
              </div>
            </div>

            {/* PRIMARY LAUNCH / RESUME CTA BUTTON */}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                type="button"
                className="ma-master-launch-btn group"
                onClick={continueMission}
              >
                <Icon name={currentMission ? 'continue' : 'play'} size={20} className="group-hover:scale-110 transition-transform" />
                <span>{primary}</span>
              </button>

              <button
                type="button"
                className="ma-pill ma-pill-ghost text-xs"
                onClick={() => setScreen('missionSelect')}
                aria-label={t('missionSelect')}
              >
                <Icon name="missions" size={16} />
                <span>{t('missionSelect')}</span>
              </button>
            </div>
          </div>

          {/* Real progress stats */}
          <dl className="grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: lang === 'ar' ? 'المهام' : 'Missions', v: `${completedCount}/${MISSIONS.length}` },
              { k: lang === 'ar' ? 'أفضل نتيجة' : 'Best score', v: bestScore > 0 ? bestScore.toFixed(0) : '—' },
              { k: lang === 'ar' ? 'الرصيد' : 'Credits', v: fmt(progress.credits) },
              { k: lang === 'ar' ? 'المستوى' : 'Level', v: String(level) },
            ].map((s) => (
              <div key={s.k} className="ma-epic-stat relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[rgba(233,195,124,0.3)] pointer-events-none" />
                <dt className="ma-hudtag">{s.k}</dt>
                <dd className="ma-num mt-2 text-[16px] font-extrabold text-[var(--ma-text)]">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* RIGHT COLUMN: GRAND DESTINATION SHOWCASE & OPERATIONS MODULES */}
        <div className="flex flex-col gap-5">
          
          {/* FEATURED DESTINATION HOLO-STAGE */}
          <div className="ma-holo-stage p-5 relative overflow-hidden">
            <span className="ma-hologram-scan" aria-hidden />

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ma-hudtag" dir="ltr">CELESTIAL INTEL · {missionTheme(peek.target).toUpperCase()}</span>
                  <span className="ma-status" data-tone={statusChip.tone}><i />{statusChip.text}</span>
                </div>
                <h2 className="mt-2 text-2xl font-bold tracking-wide text-[var(--ma-text)] flex items-center gap-2.5">
                  <span>{lang === 'ar' ? peek.labelAr : peek.label}</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.16)] text-[var(--ma-gold-hi)]">
                    {peek.target.toUpperCase()}
                  </span>
                </h2>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--ma-muted)] max-w-md">
                  {peekMission
                    ? (lang === 'ar' ? peekMission.descriptionAr ?? peekMission.description : peekMission.description)
                    : (lang === 'ar' ? 'لا توجد مهمة مرتبطة بهذه الوجهة.' : 'No mission linked.')}
                </p>
              </div>

              {/* Arrow cyclers */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[rgba(6,12,26,0.6)] border border-[var(--ma-line)]">
                <button type="button" className="ma-quickbtn" onClick={() => cycle(-1)} aria-label={lang === 'ar' ? 'الوجهة السابقة' : 'Previous destination'}>
                  <Icon name={lang === 'ar' ? 'chevronRight' : 'chevronLeft'} size={16} />
                </button>
                <span className="text-[11px] font-mono px-2 text-[var(--ma-muted)]">{focus + 1}/{PEEK.length}</span>
                <button type="button" className="ma-quickbtn" onClick={() => cycle(1)} aria-label={lang === 'ar' ? 'الوجهة التالية' : 'Next destination'}>
                  <Icon name={lang === 'ar' ? 'chevronLeft' : 'chevronRight'} size={16} />
                </button>
              </div>
            </div>

            {/* Quick Planet Selector Pills */}
            <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 ma-scroll">
              {PEEK.map((p, i) => (
                <button
                  key={p.target}
                  type="button"
                  onClick={() => setFocus(i)}
                  className={`ma-planet-pill ${focus === i ? 'is-active' : ''}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: accentForTarget(p.target) }} />
                  <span>{lang === 'ar' ? p.labelAr : p.label}</span>
                </button>
              ))}
            </div>

            {/* Target Telemetry Breakdown */}
            {peekMission && (
              <div className="mt-4 pt-3.5 border-t border-[rgba(255,255,255,0.08)] flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-[var(--ma-muted)]">
                <div className="flex flex-wrap items-center gap-4">
                  <span>Δv: <b className="text-[var(--ma-text)] text-[12px]">{fmt(peekMission.requiredDvMps)}</b> m/s</span>
                  <span>{peekMission.durationDays} {t('days')}</span>
                  <span className="flex items-center gap-1">
                    {Array.from({ length: 5 }, (_, idx) => (
                      <Icon key={idx} name="star" size={11} className={idx < peekMission.difficultyStars ? 'text-[var(--ma-warn)] drop-shadow-[0_0_4px_var(--ma-warn)]' : 'text-[var(--ma-line)]'} />
                    ))}
                  </span>
                </div>
                <button type="button" className="ma-pill ma-pill-ghost ma-pill-sm ms-auto" onClick={openFeatured}>
                  <Icon name={peekUnlocked ? 'arrowRight' : 'lock'} size={14} />
                  <span>{peekUnlocked ? (lang === 'ar' ? 'انطلاق إلى المهمة' : 'Enter Mission') : t('locked')}</span>
                </button>
              </div>
            )}
          </div>

          {/* THE 4 OPERATIONS WINGS (Rich Interactive Sci-Fi Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Wing 1: Mission Select */}
            <div
              className="ma-action-module"
              role="button"
              tabIndex={0}
              onClick={() => setScreen('missionSelect')}
              onKeyDown={(e) => e.key === 'Enter' && setScreen('missionSelect')}
            >
              <div className="ma-action-ico"><Icon name="missions" size={24} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <b className="text-[13px] text-[var(--ma-text)] uppercase tracking-wider">{t('missionSelect')}</b>
                  <span className="text-[9px] font-mono text-[var(--ma-accent)]">{completedCount}/{MISSIONS.length}</span>
                </div>
                <p className="text-[11px] text-[var(--ma-muted)] mt-0.5 truncate">{lang === 'ar' ? 'الوجهات والمدارات والخطط' : 'Flight plans & targets'}</p>
              </div>
            </div>

            {/* Wing 2: Spacecraft Bay */}
            <div
              className="ma-action-module"
              role="button"
              tabIndex={0}
              onClick={() => setScreen('builder')}
              onKeyDown={(e) => e.key === 'Enter' && setScreen('builder')}
            >
              <div className="ma-action-ico"><Icon name="hangar" size={24} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <b className="text-[13px] text-[var(--ma-text)] uppercase tracking-wider">{t('builder')}</b>
                  <span className="text-[9px] font-mono text-[var(--ma-gold-hi)]">7×5 BAY</span>
                </div>
                <p className="text-[11px] text-[var(--ma-muted)] mt-0.5 truncate">{lang === 'ar' ? 'تجميع وتجهيز الحمولات' : 'Spacecraft payload design'}</p>
              </div>
            </div>

            {/* Wing 3: Rocket Launchers */}
            <div
              className="ma-action-module"
              role="button"
              tabIndex={0}
              onClick={() => setScreen('launcher')}
              onKeyDown={(e) => e.key === 'Enter' && setScreen('launcher')}
            >
              <div className="ma-action-ico"><Icon name="play" size={24} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <b className="text-[13px] text-[var(--ma-text)] uppercase tracking-wider">{t('launcher')}</b>
                  <span className="text-[9px] font-mono text-[var(--ma-good)]">FLEET</span>
                </div>
                <p className="text-[11px] text-[var(--ma-muted)] mt-0.5 truncate">{lang === 'ar' ? 'صواريخ الإطلاق وقوة الدفع' : 'Launch vehicles & thrust'}</p>
              </div>
            </div>

            {/* Wing 4: Tech Tree */}
            <div
              className="ma-action-module"
              role="button"
              tabIndex={0}
              onClick={() => setScreen('techTree')}
              onKeyDown={(e) => e.key === 'Enter' && setScreen('techTree')}
            >
              <div className="ma-action-ico"><Icon name="tech" size={24} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <b className="text-[13px] text-[var(--ma-text)] uppercase tracking-wider">{t('research')}</b>
                  <span className="text-[9px] font-mono text-[var(--ma-accent)]">{progress.unlockedTech.length} UNLOCKED</span>
                </div>
                <p className="text-[11px] text-[var(--ma-muted)] mt-0.5 truncate">{lang === 'ar' ? 'شجرة التقنية والترقيات' : 'R&D tech progression'}</p>
              </div>
            </div>
          </div>

          {/* COMMANDER STATUS & READINESS DIAL BAR */}
          <div className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[color-mix(in_srgb,var(--ma-accent)_20%,var(--ma-line))] bg-[rgba(6,12,26,0.65)] px-4 py-3 backdrop-blur-md">
            <ReadinessDial value={xpPct} label={lang === 'ar' ? 'جاهزية القيادة' : 'Command readiness'} />
            <div className="flex items-center gap-3">
              <button type="button" className="ma-quickbtn" onClick={() => openHangar('profile')} aria-label={t('profile')} title={t('profile')}>
                <Icon name="user" size={17} />
              </button>
              <button type="button" className="ma-quickbtn" onClick={() => openHangar('system')} aria-label={t('settings')} title={t('settings')}>
                <Icon name="settings" size={17} />
              </button>
            </div>
          </div>

          {/* Utility links: design reference and sandbox */}
          <div className="flex w-full items-center gap-5 text-[10px] uppercase tracking-[0.18em] text-[var(--ma-muted)]">
            <button
              type="button"
              className="ma-tap inline-flex items-center transition-colors hover:text-[var(--ma-accent)]"
              onClick={() => setScreen('styleGuide')}
            >
              {t('styleGuide')}
            </button>
            <button
              type="button"
              className="ma-tap inline-flex items-center transition-colors hover:text-[var(--ma-accent)]"
              onClick={() => setScreen('playground')}
            >
              Playground
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
