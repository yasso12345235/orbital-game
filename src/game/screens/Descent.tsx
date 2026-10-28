/**
 * Descent screen — powered landing on the chosen world.
 *
 * The player flies the last 900 m: hold thrust to kill vertical speed, use the
 * lateral jets to line up with the pad, watch the propellant. Guidance physics
 * live here (pure numbers), the store only receives the outcome.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMission } from '../store';
import { useLang, useReducedMotion } from '../hooks';
import { PanelTag } from '../components/controls';
import { surfaceProfileFor } from '../surface/model';
import { sound } from '../audio';

const LazyDescentView = lazy(() => import('../visual/DescentView'));

const START_ALT = 800;
const START_VY = 10;
const TIME_SCALE = 2.4;
const GRAVITY_SCALE = 0.9;
const THRUST_G = 2.1;
const MAX_VY_TOUCHDOWN = 3.5;
const MAX_DRIFT = 10;
const FUEL_BURN = 4; // %/s at full throttle

interface Flight {
  altitude: number;
  vy: number;
  x: number;
  vx: number;
  fuel: number;
  thrust: number;
  landings: number;
}

export function DescentScreen() {
  const lang = useLang();
  const reduced = useReducedMotion();
  const descent = useMission((s) => s.descent);
  const landExpedition = useMission((s) => s.landExpedition);
  const failDescent = useMission((s) => s.failDescent);
  const retryDescent = useMission((s) => s.retryDescent);
  const abortExpedition = useMission((s) => s.abortExpedition);
  const setDescent = useMission((s) => s.setDescent);

  const profile = useMemo(() => surfaceProfileFor(descent?.target), [descent?.target]);

  const flight = useRef<Flight>({
    altitude: descent?.altitude ?? START_ALT,
    vy: descent?.vy ?? START_VY,
    x: descent?.x ?? 0,
    vx: descent?.vx ?? 0,
    fuel: descent?.fuel ?? 100,
    thrust: 0,
    landings: 0,
  });
  const hold = useRef(false);
  const lateral = useRef(0);
  const auto = useRef(false);
  const finished = useRef(false);

  const [hud, setHud] = useState({ ...flight.current });
  const [outcome, setOutcome] = useState<'flying' | 'landed' | 'crashed'>('flying');
  const [autoOn, setAutoOn] = useState(false);
  const [attempt, setAttempt] = useState(descent?.attempts ?? 0);

  const beeped = useRef(false);

  const reset = useCallback(() => {
    flight.current = {
      altitude: START_ALT,
      vy: START_VY,
      x: 0,
      vx: 0,
      fuel: 100,
      thrust: 0,
      landings: 0,
    };
    finished.current = false;
    beeped.current = false;
    setOutcome('flying');
    setHud({ ...flight.current });
  }, []);

  // Guidance loop — 60 Hz physics, 10 Hz HUD.
  useEffect(() => {
    if (!descent) return;
    let raf = 0;
    let last = performance.now();
    let hudAt = 0;

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const f = flight.current;
      if (finished.current) {
        raf = requestAnimationFrame(step);
        return;
      }

      const g = profile.gravity * GRAVITY_SCALE;
      // Auto-guidance: a conservative suicide burn. Target speed follows the
      // braking-distance curve for the thrust actually available, so the last
      // metres stay inside the touchdown limit even at high gravity.
      if (auto.current) {
        const aNet = g * (THRUST_G - 1);
        const stopDist = Math.max(0, f.altitude - 1.4);
        const need = Math.sqrt(2 * aNet * stopDist) * 0.9;
        const targetVy = Math.max(1.1, Math.min(9.5, need));
        hold.current = f.vy > targetVy && f.fuel > 0;
      }
      f.thrust += ((hold.current && f.fuel > 0 ? 1 : 0) - f.thrust) * Math.min(1, dt * 12);
      if (f.thrust > 0.02) f.fuel = Math.max(0, f.fuel - FUEL_BURN * f.thrust * dt);

      const accel = g - g * THRUST_G * f.thrust;
      f.vy += accel * TIME_SCALE * dt;
      f.altitude -= f.vy * TIME_SCALE * dt;

      f.vx += (lateral.current * 7 - f.vx * 0.9) * dt * TIME_SCALE;
      f.x += f.vx * TIME_SCALE * dt;
      f.x = Math.max(-40, Math.min(40, f.x));

      if (f.altitude <= 2 && f.vy < 9 && !beeped.current) {
        beeped.current = true;
        sound.play('beep');
      }

      if (f.altitude <= 0) {
        finished.current = true;
        const speed = Math.max(0, f.vy);
        const drift = Math.abs(f.x);
        const ok = speed <= MAX_VY_TOUCHDOWN && drift <= MAX_DRIFT;
        setOutcome(ok ? 'landed' : 'crashed');
        sound.play(ok ? 'success' : 'failure');
        if (ok) setDescent({ fuel: f.fuel, touchdown: speed, phase: 'landed' });
        else failDescent(speed);
        setHud({ ...f });
        raf = requestAnimationFrame(step);
        return;
      }

      if (now - hudAt > 100) {
        hudAt = now;
        setHud({ ...f });
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [descent, failDescent, profile.gravity, setDescent]);

  // Keyboard: SPACE/↑ thrust, A/D or ←/→ lateral, Shift for full auto abort.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        hold.current = true;
      }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') lateral.current = -1;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') lateral.current = 1;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') hold.current = false;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') {
        lateral.current = 0;
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // A soft landing is handed to the store once the touchdown plate settles.
  useEffect(() => {
    if (outcome !== 'landed') return;
    const t = setTimeout(() => {
      landExpedition(hud.vy, hud.fuel);
    }, 1500);
    return () => clearTimeout(t);
  }, [outcome, hud.vy, hud.fuel, landExpedition]);

  if (!descent) {
    return (
      <div className="ma-panel p-8 text-center">
        <p className="text-sm text-[var(--ma-muted)]">
          {lang === 'ar' ? 'لا يوجد هبوط جارٍ.' : 'No descent in progress.'}
        </p>
        <button type="button" className="ma-pill ma-pill-accent mt-4" onClick={() => useMission.getState().setScreen('results')}>
          {lang === 'ar' ? 'العودة للنتائج' : 'Back to results'}
        </button>
      </div>
    );
  }

  const speedTone = hud.vy > 6 ? 'var(--ma-bad)' : hud.vy > MAX_VY_TOUCHDOWN ? 'var(--ma-warn)' : 'var(--ma-good)';
  const alignTone = Math.abs(hud.x) > MAX_DRIFT ? 'var(--ma-bad)' : Math.abs(hud.x) > MAX_DRIFT * 0.6 ? 'var(--ma-warn)' : 'var(--ma-good)';
  const altPct = Math.max(0, Math.min(100, (hud.altitude / START_ALT) * 100));

  return (
    <div className="ma-enter flex flex-col gap-3" data-screen="descent">
      <section className="relative ma-panel overflow-hidden">
        <div className="relative h-[46vh] min-h-[300px] sm:h-[54vh]">
          <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-xs text-[var(--ma-muted)]">…</div>}>
            <LazyDescentView thrust={hud.thrust} settled={outcome !== 'flying'} crashed={outcome === 'crashed'} />
          </Suspense>

          {/* Mission strip */}
          <div className="pointer-events-none absolute inset-x-4 top-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <PanelTag ar="هبوط موجه" en="POWERED DESCENT" />
              <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-white/70">
                {lang === 'ar' ? profile.nameAr : profile.nameEn}
              </p>
            </div>
            <div className="text-right text-[10px] uppercase tracking-[0.2em] text-white/60">
              <div>{lang === 'ar' ? 'محاولة' : 'Attempt'} {attempt + 1}</div>
              <div className="ma-num text-[var(--ma-gold)]">{Math.abs(hud.x).toFixed(1)} m drift</div>
            </div>
          </div>

          {/* Flight data */}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 grid grid-cols-3 gap-2">
            <div className="ma-flight-stat">
              <span>{lang === 'ar' ? 'الارتفاع' : 'Altitude'}</span>
              <b className="ma-num" style={{ color: altPct < 12 ? 'var(--ma-warn)' : '#fff' }}>
                {Math.max(0, hud.altitude).toFixed(0)}
              </b>
              <i>m</i>
            </div>
            <div className="ma-flight-stat">
              <span>{lang === 'ar' ? 'سرعة الهبوط' : 'Descent rate'}</span>
              <b className="ma-num" style={{ color: speedTone }}>{Math.max(0, hud.vy).toFixed(1)}</b>
              <i>m/s</i>
            </div>
            <div className="ma-flight-stat">
              <span>{lang === 'ar' ? 'الوقود' : 'Propellant'}</span>
              <b className="ma-num" style={{ color: hud.fuel < 18 ? 'var(--ma-bad)' : 'var(--ma-gold)' }}>
                {hud.fuel.toFixed(0)}%
              </b>
              <i>{lang === 'ar' ? 'متاح' : 'left'}</i>
            </div>
          </div>

          {/* Descent corridor / target alignment: altitude tape on the right edge */}
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
            <div className="ma-descent-rail">
              <span style={{ bottom: `${altPct}%` }} />
              <em className="ma-num" style={{ color: alignTone }}>{hud.x > 0 ? '▶' : hud.x < 0 ? '◀' : '●'}</em>
              <b className="ma-descent-rail-label">ALT</b>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(233,195,124,0.14)] p-3">
          <button
            type="button"
            className="ma-pill ma-pill-accent ma-descent-thrust select-none"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              hold.current = true;
            }}
            onPointerUp={() => { hold.current = false; }}
            onPointerCancel={() => { hold.current = false; }}
            onPointerLeave={() => { hold.current = false; }}
            onKeyDown={(e) => { if (e.code === 'Space' || e.code === 'Enter') hold.current = true; }}
            onKeyUp={() => { hold.current = false; }}
          >
            {lang === 'ar' ? '↑ دفع' : '↑ THRUST'}
          </button>
          <div className="flex gap-2">
            {[-1, 1].map((dir) => (
              <button
                key={dir}
                type="button"
                className="ma-pill ma-pill-ghost ma-descent-lat"
                aria-label={dir < 0 ? 'left' : 'right'}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  lateral.current = dir;
                }}
                onPointerUp={() => { lateral.current = 0; }}
                onPointerCancel={() => { lateral.current = 0; }}
                onPointerLeave={() => { lateral.current = 0; }}
              >
                {dir < 0 ? '◀' : '▶'}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`ma-chip ${autoOn ? 'ma-chip-solid' : ''}`}
            aria-pressed={autoOn}
            onClick={() => {
              const next = !autoOn;
              setAutoOn(next);
              auto.current = next;
              if (!next) hold.current = false;
            }}
          >
            {lang === 'ar' ? 'طيار آلي' : 'AUTO-GUIDE'}
          </button>
          <span className="ml-auto hidden text-[10px] uppercase tracking-[0.18em] text-[var(--ma-muted)] md:block">
            {lang === 'ar' ? 'مسافة/↑ دفع · ← → توجيه' : 'hold SPACE · A/D to translate'}
          </span>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="ma-panel p-4">
          <p className="ma-hudtag">GUIDANCE</p>
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--ma-muted)]">
            {lang === 'ar'
              ? `الهدف: هبوط بسرعة ≤ ${MAX_VY_TOUCHDOWN} م/ث وانحراف ≤ ${MAX_DRIFT} م. الجذب هنا ${profile.gravity.toFixed(2)} م/ث².`
              : `Target: touch down under ${MAX_VY_TOUCHDOWN} m/s with less than ${MAX_DRIFT} m of drift. Local gravity ${profile.gravity.toFixed(2)} m/s².`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em]">
            <span className="ma-hudtag">{lang === 'ar' ? profile.hazardAr : profile.hazardEn}</span>
          </div>
        </div>
        <div className="ma-panel p-4">
          <p className="ma-hudtag">CHECKLIST</p>
          <ul className="mt-2 space-y-1.5 text-[12px]">
            <li className="flex justify-between gap-2">
              <span>{lang === 'ar' ? 'سرعة الهبوط' : 'Descent rate'}</span>
              <b className="ma-num" style={{ color: speedTone }}>{Math.max(0, hud.vy).toFixed(1)} m/s</b>
            </li>
            <li className="flex justify-between gap-2">
              <span>{lang === 'ar' ? 'الانحراف عن المنصة' : 'Pad offset'}</span>
              <b className="ma-num" style={{ color: alignTone }}>{Math.abs(hud.x).toFixed(1)} m</b>
            </li>
            <li className="flex justify-between gap-2">
              <span>{lang === 'ar' ? 'الوقود' : 'Propellant'}</span>
              <b className="ma-num">{hud.fuel.toFixed(0)}%</b>
            </li>
          </ul>
        </div>
      </div>

      {outcome !== 'flying' && (
        <div className="ma-descent-outcome" role="status">
          <div className="ma-panel p-6 text-center max-w-md mx-auto">
            <PanelTag
              ar={outcome === 'landed' ? 'هبوط ناجح' : 'فشل الهبوط'}
              en={outcome === 'landed' ? 'TOUCHDOWN' : 'HARD IMPACT'}
            />
            <h3 className="ma-title text-2xl mt-2">
              {outcome === 'landed'
                ? (lang === 'ar' ? 'المركبة على السطح' : 'Vehicle on the surface')
                : (lang === 'ar' ? 'سرعات الهبوط خارج الحدود' : 'Touchdown outside limits')}
            </h3>
            <p className="ma-num text-[12px] text-[var(--ma-muted)] mt-2">
              {Math.max(0, hud.vy).toFixed(1)} m/s · {Math.abs(hud.x).toFixed(1)} m drift · {hud.fuel.toFixed(0)}% fuel
            </p>
            {outcome === 'landed' ? (
              <p className="mt-3 text-[12px] text-[var(--ma-good)]">
                {lang === 'ar' ? 'جارٍ إنزال الفريق…' : 'Deploying the surface team…'}
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className="ma-pill ma-pill-accent"
                  onClick={() => {
                    retryDescent();
                    setAttempt((n) => n + 1);
                    reset();
                  }}
                >
                  {lang === 'ar' ? 'إعادة المحاولة' : 'TRY AGAIN'}
                </button>
                <button type="button" className="ma-pill ma-pill-ghost" onClick={abortExpedition}>
                  {lang === 'ar' ? 'إلغاء البعثة' : 'ABORT'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {reduced && (
        <p className="text-[10px] text-[var(--ma-muted)]">
          {lang === 'ar' ? 'وضع الحركة المخففة: استخدم الطيار الآلي للهبوط الآمن.' : 'Reduced motion: use AUTO-GUIDE for a safe landing.'}
        </p>
      )}
    </div>
  );
}
