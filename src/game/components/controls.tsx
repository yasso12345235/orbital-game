/**
 * Mission Architect — core HUD components (panels, gauges, KPI numerals,
 * sliders, toasts). Interactive mission commands live in MissionControl.tsx
 * (the v3 contextual chips) and always dispatch named engine commands.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMission } from '../store';
import { useLang, useT } from '../hooks';
import type { StringKey } from '../i18n';

/* ------------------------------------------------------------------ */
/* Count-up: animate numeric KPI values from their previous value      */
/* ------------------------------------------------------------------ */
export function useCountUp(value: string | number, durationMs = 750): string | number {
  const reduced = useMission((s) => s.settings.reducedMotion);
  const isNum = typeof value === 'number' && Number.isFinite(value);
  const [disp, setDisp] = useState<string | number>(value);
  const fromRef = useRef(0);
  const rafRef = useRef(0);
  useEffect(() => {
    if (!isNum) { setDisp(value); return; }
    const target = value as number;
    if (reduced) { setDisp(target); fromRef.current = target; return; }
    const from = fromRef.current;
    if (from === target) { setDisp(target); return; }
    const t0 = performance.now();
    const step = (now: number) => {
      const f = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - Math.pow(1 - f, 3);
      const cur = from + (target - from) * eased;
      setDisp(Number.isInteger(target) ? Math.round(cur) : Number(cur.toFixed(2)));
      if (f < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, isNum, reduced, durationMs]);
  return isNum ? disp : value;
}

/* ------------------------------------------------------------------ */
/* Bilingual label: Arabic above English when lang=ar, reversed for en  */
/* ------------------------------------------------------------------ */
export function Bi({ ar, en, stack }: { ar: string; en: string; stack?: boolean }) {
  const lang = useLang();
  const first = lang === 'ar' ? ar : en;
  const second = lang === 'ar' ? en : ar;
  if (!stack) {
    return (
      <span className="inline-flex flex-col leading-tight">
        <span className={lang === 'ar' ? 'font-ar' : ''}>{first}</span>
        <span className="opacity-60 text-[0.85em]">{second}</span>
      </span>
    );
  }
  return (
    <span className="flex flex-col leading-tight">
      <span className={`ma-bilingual-ar ${lang === 'ar' ? 'font-ar' : ''}`}>{first}</span>
      <span className="ma-bilingual-en uppercase">{second}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Panels                                                              */
/* ------------------------------------------------------------------ */
export function PanelTag({ ar, en }: { ar: string; en: string }) {
  const lang = useLang();
  return (
    <span className="ma-hudtag" dir="ltr">
      {lang === 'ar' ? `${ar} · ${en}` : `${en} · ${ar}`}
    </span>
  );
}

export function HudFrame({
  tag, tagAr, children, className = '', tight, title, tone,
}: { tag: string; tagAr?: string; children: ReactNode; className?: string; tight?: boolean; title?: string; tone?: 'warn' | 'bad' | 'good' }) {
  return (
    <section className={`ma-panel ${tight ? 'p-3' : 'p-4'} ${className}`} title={title} aria-label={tag} data-tone={tone}>
      <header className="-mt-1 mb-3 flex items-center gap-2">
        <PanelTag ar={tagAr ?? tag} en={tag} />
      </header>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* KPI + ring gauge                                                    */
/* ------------------------------------------------------------------ */
export function Kpi({ ar, en, value, unit, accent, big }: { ar: string; en: string; value: string | number; unit?: string; accent?: string; big?: boolean }) {
  const lang = useLang();
  const shown = useCountUp(value);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="ma-kpi-label uppercase" title={en}>
        {lang === 'ar' ? ar : en}
      </span>
      <span className={`ma-kpi-num ${big ? '' : 'text-[1.9rem]'} ma-num`} style={{ color: accent }}>
        {shown}
        {unit && <span className="text-[0.5em] opacity-70 ml-1">{unit}</span>}
      </span>
      <span className="text-[10px] opacity-55">{lang === 'ar' ? en : ar}</span>
    </div>
  );
}

/** Semicircular ring gauge that animates from 0 with ease-out; stepped needle. */
export function RingGauge({
  value, max = 100, ar, en, unit = '%', color, dangerBelow, size = 132, decimals = 0,
}: { value: number; max?: number; ar: string; en: string; unit?: string; color?: string; dangerBelow?: number; size?: number; decimals?: number }) {
  const lang = useLang();
  const shown = Number(useCountUp(value));
  const frac = Math.max(0, Math.min(1, value / max));
  const R = 46;
  const track = Math.PI * R; // semicircle length
  const low = dangerBelow !== undefined && frac * max < dangerBelow;
  const stroke = low ? 'var(--ma-bad)' : (color ?? 'var(--ma-accent)');
  const needleAngle = -90 + frac * 180;
  return (
    <div className="flex flex-col items-center" role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={`${en} ${value}/${max}`}>
      <svg width={size} height={size * 0.62} viewBox="0 0 120 76" className="overflow-visible">
        <path d="M 14 66 A 46 46 0 0 1 106 66" fill="none" stroke="var(--ma-line)" strokeWidth="8" strokeLinecap="round" />
        <path
          d="M 14 66 A 46 46 0 0 1 106 66"
          fill="none" stroke={stroke} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${track}`}
          strokeDashoffset={track * (1 - frac)}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1), stroke 0.4s ease', filter: `drop-shadow(0 0 6px ${low ? 'var(--ma-bad)' : 'var(--ma-accent)'})` }}
        />
        <g style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: '60px 66px', transition: 'transform 0.9s steps(14)' }}>
          <line x1="60" y1="66" x2="60" y2="28" stroke="var(--ma-text)" strokeWidth="2" strokeLinecap="round" />
        </g>
        <circle cx="60" cy="66" r="5" fill="var(--ma-panel)" stroke={stroke} strokeWidth="2" />
      </svg>
      <span className="ma-kpi-num text-[1.35rem] ma-num" style={{ color: stroke }}>
        {shown.toFixed(decimals)}
        <span className="text-[0.5em] opacity-70 ml-0.5">{unit}</span>
      </span>
      <span className="ma-kpi-label uppercase">{lang === 'ar' ? ar : en}</span>
      <span className="text-[9px] opacity-50">{lang === 'ar' ? en : ar}</span>
    </div>
  );
}

/** Circular gauge (full ring) with animated sweep; colour follows tone. */
export function RadialGauge({
  value, max = 100, ar, en, unit = '%', size = 112, decimals = 0, tone,
  lowAt, warnAt, note,
}: {
  value: number; max?: number; ar: string; en: string; unit?: string; size?: number;
  decimals?: number; tone?: 'accent' | 'good' | 'warn' | 'bad';
  lowAt?: number; warnAt?: number; note?: string;
}) {
  const lang = useLang();
  const shown = Number(useCountUp(value));
  const frac = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const auto: 'accent' | 'good' | 'warn' | 'bad' = lowAt !== undefined && value <= lowAt
    ? 'bad'
    : warnAt !== undefined && value <= warnAt
      ? 'warn'
      : 'accent';
  const resolved = tone ?? auto;
  const color = resolved === 'bad' ? 'var(--ma-bad)' : resolved === 'warn' ? 'var(--ma-warn)' : resolved === 'good' ? 'var(--ma-good)' : 'var(--ma-accent)';
  const R = 44;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative grid place-items-center"
        style={{ width: size, height: size }}
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${en} ${Math.round(value)} ${unit}`}
      >
        <svg width={size} height={size} viewBox="0 0 112 112" className="overflow-visible" aria-hidden>
          <circle cx="56" cy="56" r={R} fill="none" stroke="var(--ma-line)" strokeWidth="6" opacity="0.75" />
          <circle
            cx="56"
            cy="56"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
            transform="rotate(-90 56 56)"
            style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1), stroke 0.35s ease', filter: `drop-shadow(0 0 5px ${color})` }}
          />
          <circle cx="56" cy="56" r={R - 9} fill="none" stroke="var(--ma-line)" strokeWidth="0.6" strokeDasharray="2 5" opacity="0.65" />
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="ma-num text-[1.28rem] leading-none" style={{ color }}>
            {shown.toFixed(decimals)}
            <span className="text-[0.55em] opacity-70">{unit}</span>
          </span>
          <span className="ma-hudtag mt-1.5">{lang === 'ar' ? ar : en}</span>
        </div>
      </div>
      <span className="text-[9px] uppercase tracking-[0.14em] text-[var(--ma-muted)] text-center">
        {note ?? (lang === 'ar' ? en : ar)}
      </span>
    </div>
  );
}

/** Sparkline for a real time series (no synthetic wave). */
export function Sparkline({
  data, label, unit = '', height = 36, tone = 'accent', min, max, decimals = 0,
}: {
  data: number[]; label: string; unit?: string; height?: number; tone?: 'accent' | 'good' | 'warn' | 'bad';
  min?: number; max?: number; decimals?: number;
}) {
  const color = tone === 'bad' ? 'var(--ma-bad)' : tone === 'warn' ? 'var(--ma-warn)' : tone === 'good' ? 'var(--ma-good)' : 'var(--ma-accent)';
  const values = data.length ? data : [0, 0];
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const W = 100;
  const H = 30;
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? W : (i / (values.length - 1)) * W;
    const y = H - ((v - lo) / span) * (H - 4) - 2;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const last = values[values.length - 1];
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.14em] text-[var(--ma-muted)]">
        <span>{label}</span>
        <span className="ma-num text-[var(--ma-text)]">{last.toFixed(decimals)}{unit && <span className="opacity-60"> {unit}</span>}</span>
      </div>
      <svg className="ma-spark" style={{ height }} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${label} trend, latest ${last.toFixed(decimals)} ${unit}`}>
        <line className="grid" x1="0" y1={H * 0.5} x2={W} y2={H * 0.5} />
        <path className="area" d={area} style={{ fill: `color-mix(in srgb, ${color} 13%, transparent)` }} />
        <path className="line" d={line} style={{ stroke: color, filter: `drop-shadow(0 0 4px color-mix(in srgb, ${color} 55%, transparent))` }} />
        {pts.length > 0 && (
          <circle className="dot" cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="1.6" style={{ fill: color }} />
        )}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Learn-mode box: shows the real calculation after each stage         */
/* ------------------------------------------------------------------ */export function LearnBox({ formula, substitution, result, note }: { formula: string; substitution: string; result: string; note?: string }) {
  const t = useT();
  const lang = useLang();
  return (
    <div className="mt-3 border border-dashed border-[color-mix(in_srgb,var(--ma-accent)_45%,transparent)] rounded-lg p-3 bg-[color-mix(in_srgb,var(--ma-accent)_6%,transparent)]">
      <div className="ma-hudtag mb-2" dir="ltr">LEARN · {lang === 'ar' ? 'تعلّم' : 'LEARN'}</div>
      <p className="text-[11px] uppercase tracking-wider text-[var(--ma-muted)] mb-1">{t('learnTitle')}</p>
      <p className="ma-num text-sm" dir="ltr" style={{ fontFamily: 'var(--ma-mono)' }}>{formula}</p>
      <p className="ma-num text-xs opacity-80 mt-1" dir="ltr" style={{ fontFamily: 'var(--ma-mono)' }}>= {substitution}</p>
      <p className="ma-num text-sm mt-1" dir="ltr" style={{ fontFamily: 'var(--ma-mono)', color: 'var(--ma-accent)' }}>= {result}</p>
      {note && <p className="text-[11px] opacity-70 mt-2">{note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pixel slider                                                        */
/* ------------------------------------------------------------------ */
export function HudSlider({
  label, labelAr, value, min, max, step = 1, unit, onChange, disabled, hint,
}: {
  label: string; labelAr: string; value: number; min: number; max: number; step?: number; unit: string;
  onChange: (v: number) => void; disabled?: boolean; hint?: string;
}) {
  const lang = useLang();
  return (
    <label className={`block ${disabled ? 'opacity-45' : ''}`} title={hint}>
      <span className="flex items-center justify-between text-[11px] uppercase tracking-wider text-[var(--ma-muted)]">
        <span>{lang === 'ar' ? labelAr : label}</span>
        <span className="ma-num" style={{ fontFamily: 'var(--ma-hud)' }}>{value.toLocaleString()} {unit}</span>
      </span>
      <input
        type="range"
        className="w-full mt-1 ma-range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="block text-[9px] opacity-50">{lang === 'ar' ? label : labelAr}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Toast stack                                                         */
/* ------------------------------------------------------------------ */
export function Toasts() {
  const toasts = useMission((s) => s.toasts);
  const dismiss = useMission((s) => s.dismissToast);
  const colors: Record<string, string> = { info: 'var(--ma-accent)', good: 'var(--ma-good)', bad: 'var(--ma-bad)', warn: 'var(--ma-warn)' };
  return (
    <div className="fixed top-4 right-4 z-[80] flex flex-col gap-2 max-w-sm" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className="ma-panel px-3 py-2 text-left text-xs"
          style={{ borderColor: colors[t.kind] }}
        >
          <span style={{ color: colors[t.kind], fontFamily: 'var(--ma-pixel)', fontSize: 10 }} className="block uppercase">
            {t.kind === 'bad' ? 'ALERT' : t.kind === 'warn' ? 'CAUTION' : t.kind === 'good' ? 'NOMINAL' : 'INFO'}
          </span>
          {t.msg}
        </button>
      ))}
    </div>
  );
}

/** Small helper: format numbers compactly. */
export function fmt(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (abs >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function useStr(key: StringKey): string {
  const t = useT();
  return useMemo(() => t(key), [t, key]);
}
