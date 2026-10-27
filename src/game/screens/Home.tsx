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
    <div className="relative isolate overflow-hidden rounded-[26px] border border-[color-mix(in_srgb,var(--ma-accent)_16%,var(--ma-line))] min-h-[calc(100vh-128px)] flex flex-col">
      {/* Deep space base + planet limb fallback (hidden once WebGL is live). */}
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

      {/* Living 3D hero (planet limb, starfield, flyby, meteors). */}
      {webgl && (
        <Suspense fallback={null}>
          <LazyHomeHero target={peek.target} className="ma-hero-in absolute inset-0 -z-10 w-full h-full opacity-95" />
        </Suspense>
      )}

      {/* Readability scrims: keep the console legible over the bright limb. */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(5,7,13,0.78) 0%, rgba(5,7,13,0.24) 34%, rgba(5,7,13,0.06) 52%, rgba(5,7,13,0.72) 100%), linear-gradient(100deg, rgba(5,7,13,0.62), transparent 46%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 flex-1 grid gap-6 lg:grid-cols-[minmax(0,1fr)_318px] p-5 sm:p-7 lg:p-9">
        {/* ------------------------------------------------ hero column */}
        <div className="flex min-w-0 flex-col justify-between gap-8">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="ma-status" data-tone="accent"><i />{lang === 'ar' ? 'مركز التحكم متصل' : 'Mission control online'}</span>
              <span className="ma-hudtag" dir="ltr">MISSION ARCHITECT PROGRAM · v1.6</span>
            </div>

            <h1 className="ma-hero-word mt-6" dir="ltr">ORBITAL</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="ma-hero-sub">{t('tagline')}</span>
              <span className="ma-num text-[10px] tracking-[0.24em] text-[var(--ma-muted)] uppercase">
                {lang === 'ar' ? `المستوى ${level} · ${fmt(progress.credits)} رصيد` : `LVL ${level} · ${fmt(progress.credits)} CR`}
              </span>
            </div>
            <p className="mt-4 max-w-xl text-[12.5px] leading-relaxed text-[var(--ma-muted)]">{t('credentials')}</p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button type="button" className="ma-pill ma-pill-accent" onClick={continueMission}>
                <Icon name={currentMission ? 'continue' : 'play'} size={16} />
                <span>{primary}</span>
              </button>
              <button type="button" className="ma-pill ma-pill-ghost" onClick={() => setScreen('missionSelect')} aria-label={t('missionSelect')}>
                <Icon name="missions" size={16} />
                <span>{t('missionSelect')}</span>
              </button>
            </div>

            {/* Real progress tiles */}
            <dl className="mt-8 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { k: lang === 'ar' ? 'المهام' : 'Missions', v: `${completedCount}/${MISSIONS.length}` },
                { k: lang === 'ar' ? 'أفضل نتيجة' : 'Best score', v: bestScore > 0 ? bestScore.toFixed(0) : '—' },
                { k: lang === 'ar' ? 'الرصيد' : 'Credits', v: fmt(progress.credits) },
                { k: lang === 'ar' ? 'المستوى' : 'Level', v: String(level) },
              ].map((s) => (
                <div key={s.k} className="rounded-xl border border-[color-mix(in_srgb,var(--ma-line)_86%,transparent)] bg-[rgba(6,12,26,0.5)] px-3 py-2 backdrop-blur-sm">
                  <dt className="ma-hudtag">{s.k}</dt>
                  <dd className="ma-num mt-1 text-[15px] text-[var(--ma-text)]">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* ------------------------------------ featured destination card */}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="ma-panel relative w-full max-w-xl overflow-hidden" data-tone={peekDone ? 'good' : undefined}>
              <div
                className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full opacity-70 blur-[2px]"
                style={{ background: `radial-gradient(circle at 36% 32%, ${accentForTarget(peek.target)}, #0b1a3d 58%, transparent 72%)` }}
                aria-hidden
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="ma-hudtag" dir="ltr">FEATURED TARGET · {missionTheme(peek.target).toUpperCase()}</span>
                    <span className="ma-status" data-tone={statusChip.tone}><i />{statusChip.text}</span>
                  </div>
                  <h2 className="mt-2 truncate text-[17px] font-semibold tracking-wide text-[var(--ma-text)]">
                    {lang === 'ar' ? peek.labelAr : peek.label}
                  </h2>
                  <p className="mt-1 max-w-sm text-[11.5px] leading-relaxed text-[var(--ma-muted)]">
                    {peekMission
                      ? (lang === 'ar' ? peekMission.descriptionAr ?? peekMission.description : peekMission.description)
                      : (lang === 'ar' ? 'لا توجد مهمة مرتبطة بهذه الوجهة.' : 'No mission is linked to this destination.')}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-1">
                  <button type="button" className="ma-quickbtn" onClick={() => cycle(-1)} aria-label={lang === 'ar' ? 'الوجهة السابقة' : 'Previous destination'}>
                    <Icon name={lang === 'ar' ? 'chevronRight' : 'chevronLeft'} size={16} />
                  </button>
                  <button type="button" className="ma-quickbtn" onClick={() => cycle(1)} aria-label={lang === 'ar' ? 'الوجهة التالية' : 'Next destination'}>
                    <Icon name={lang === 'ar' ? 'chevronLeft' : 'chevronRight'} size={16} />
                  </button>
                </div>
              </div>

              {peekMission && (
                <div className="relative mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[color-mix(in_srgb,var(--ma-line)_80%,transparent)] pt-3">
                  <span className="ma-num text-[11px] text-[var(--ma-muted)]">Δv <b className="text-[var(--ma-text)]">{peekMission.requiredDvMps}</b> m/s</span>
                  <span className="ma-num text-[11px] text-[var(--ma-muted)]">{peekMission.durationDays} {t('days')}</span>
                  <span className="flex items-center gap-1" aria-label={`${t('difficulty')} ${peekMission.difficultyStars}/5`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Icon key={i} name="star" size={10} className={i < peekMission.difficultyStars ? 'text-[var(--ma-warn)]' : 'text-[var(--ma-line)]'} />
                    ))}
                  </span>
                  {peekDone && <span className="ma-num text-[10px] text-[var(--ma-good)]">{peekDone.grade} · {peekDone.score.toFixed(0)}</span>}
                  <button type="button" className="ma-pill ma-pill-ghost ma-pill-sm ms-auto" onClick={openFeatured}>
                    <Icon name={peekUnlocked ? 'arrowRight' : 'lock'} size={14} />
                    <span>{peekUnlocked ? (lang === 'ar' ? 'افتح المهمة' : 'Open mission') : t('locked')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Lab / review routes stay reachable but quiet. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.18em] text-[var(--ma-muted)]">
            <span className="ma-hudtag" dir="ltr">{lang === 'ar' ? 'أدوات المختبر' : 'LAB TOOLS'}</span>
            <button type="button" className="ma-tap inline-flex items-center hover:text-[var(--ma-accent)] transition-colors" aria-label={t('styleGuide')} onClick={() => setScreen('styleGuide')}>
              {t('styleGuide')}
            </button>
            <span className="h-3 w-px bg-[var(--ma-line)]" aria-hidden />
            <button type="button" className="ma-tap inline-flex items-center hover:text-[var(--ma-accent)] transition-colors" aria-label="Playground" onClick={() => setScreen('playground')}>
              {lang === 'ar' ? 'الملعب 3D' : 'Playground'}
            </button>
          </div>
        </div>

        {/* ------------------------------------------------ command rail */}
        <aside className="flex flex-col gap-3 lg:items-end">
          <nav className="ma-menu" aria-label={lang === 'ar' ? 'قائمة القيادة' : 'Command menu'}>
            <div className="ma-menu-head">
              <span>{lang === 'ar' ? 'القيادة' : 'COMMAND'}</span>
              <span className="ma-status" data-tone="accent"><i />{lang === 'ar' ? 'نشط' : 'ACTIVE'}</span>
            </div>

            <button type="button" className="ma-menu-item is-primary" onClick={continueMission} aria-label={t('continueMission')}>
              <span className="ma-menu-ico"><Icon name={currentMission ? 'continue' : 'play'} size={18} /></span>
              <span className="ma-menu-label">
                <b>{t('continueMission')}</b>
                <span>{menuSub('continue')}</span>
              </span>
              <span className="ma-menu-key">↵</span>
            </button>

            <div className="ma-menu-divider" />

            {([
              { id: 'new', icon: 'plus' as IconName, key: 'newMission' as const, onClick: () => setScreen('missionSelect') },
              { id: 'select', icon: 'missions' as IconName, key: 'missionSelect' as const, onClick: () => setScreen('missionSelect') },
              { id: 'research', icon: 'tech' as IconName, key: 'research' as const, onClick: () => setScreen('techTree') },
              { id: 'hangar', icon: 'hangar' as IconName, key: 'hangar' as const, onClick: () => openHangar('hangar') },
              { id: 'settings', icon: 'settings' as IconName, key: 'settings' as const, onClick: () => openHangar('system') },
            ]).map((item) => (
              <button
                key={item.id}
                type="button"
                className="ma-menu-item"
                onClick={item.onClick}
                aria-label={t(item.key)}
              >
                <span className="ma-menu-ico"><Icon name={item.icon} size={18} /></span>
                <span className="ma-menu-label">
                  <b>{t(item.key)}</b>
                  <span>{menuSub(item.id)}</span>
                </span>
              </button>
            ))}
          </nav>

          {/* Quick access bar (Ref 5) — same real routes as the rail. */}
          <div className="ma-quickbar w-full justify-between lg:w-auto" aria-label={lang === 'ar' ? 'وصول سريع' : 'Quick access'}>
            <button type="button" className="ma-quickbtn" onClick={() => openHangar('profile')} aria-label={t('profile')} title={t('profile')}>
              <Icon name="user" size={17} />
            </button>
            <button type="button" className="ma-quickbtn" onClick={() => openHangar('hangar')} aria-label={t('hangar')} title={t('hangar')}>
              <Icon name="hangar" size={17} />
            </button>
            <button type="button" className="ma-quickbtn" onClick={() => setScreen('techTree')} aria-label={t('research')} title={t('research')}>
              <Icon name="tech" size={17} />
            </button>
            <button type="button" className="ma-quickbtn" onClick={() => openHangar('system')} aria-label={t('settings')} title={t('settings')}>
              <Icon name="settings" size={17} />
            </button>
            <span className="ma-quick-sep" aria-hidden />
            <button
              type="button"
              className={`ma-quickbtn ${settings.sound ? 'is-on' : ''}`}
              onClick={() => setSetting('sound', !settings.sound)}
              aria-label={t('sound')}
              aria-pressed={settings.sound}
              title={t('sound')}
            >
              <Icon name={settings.sound ? 'volume' : 'mute'} size={17} />
            </button>
            <button
              type="button"
              className="ma-quickbtn"
              onClick={() => setSetting('lang', lang === 'ar' ? 'en' : 'ar')}
              aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
              title={lang === 'ar' ? 'English' : 'العربية'}
            >
              <span className="ma-num text-[10px] font-semibold">{lang === 'ar' ? 'EN' : 'ع'}</span>
            </button>
          </div>

          <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--ma-line)_80%,transparent)] bg-[rgba(6,12,26,0.42)] px-3 py-2 lg:w-auto lg:min-w-[300px]">
            <ReadinessDial value={xpPct} label={lang === 'ar' ? 'جاهزية القيادة' : 'Command readiness'} />
            <span className="flex flex-col items-end gap-1 text-[9px] uppercase tracking-[0.18em] text-[var(--ma-muted)]">
              <span className="ma-num">{progress.xp} {t('xp')}</span>
              <span>{lang === 'ar' ? 'حتى المستوى التالي' : 'to next level'}</span>
            </span>
          </div>
        </aside>
      </div>

      {/* Mobile destination switcher (the desktop arrows live in the card). */}
      <div className="relative z-10 flex items-center justify-center gap-0.5 pb-4 sm:hidden">
        {PEEK.map((p, i) => (
          <button
            key={p.target}
            type="button"
            onClick={() => setFocus(i)}
            aria-label={lang === 'ar' ? p.labelAr : p.label}
            aria-pressed={focus === i}
            className="ma-dotbtn"
          >
            <span
              className="ma-dot"
              style={{
                width: focus === i ? 26 : 8,
                background: focus === i ? accentForTarget(p.target) : 'var(--ma-line)',
                opacity: focus === i ? 1 : 0.7,
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
