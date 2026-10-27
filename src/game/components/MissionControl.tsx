/**
 * v3 mission control surface — replaces the legacy pixel Command Deck.
 *
 * Actions are contextual glass chips that live INSIDE the screen that needs
 * them (the operations view), each carrying the player's live keybinding as a
 * kbd hint. Telemetry moved to a slim status rail instead of a permanent
 * control bar. Everything dispatches the same named engine commands, so the
 * keyboard/gamepad input layer and these chips are fully interchangeable.
 */
import type { CommandName } from '@engine';
import { useMission } from '../store';
import { useLang, useT } from '../hooks';
import { haptic } from '../input';
import type { StringKey } from '../i18n';
import { PanelTag } from './controls';

/** Key-code → compact display label (Space → SPACE, KeyW → W, ArrowUp → ↑). */
export function keyLabel(code?: string): string {
  if (!code) return '';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const arrows: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  if (arrows[code]) return arrows[code];
  const named: Record<string, string> = {
    Space: 'SPACE', Enter: 'ENTER', NumpadEnter: 'ENTER', Escape: 'ESC', Backspace: '⌫', Tab: 'TAB',
    ShiftLeft: '⇧', ShiftRight: '⇧', ControlLeft: 'CTRL', ControlRight: 'CTRL', AltLeft: 'ALT', AltRight: 'ALT',
    Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backquote: '`',
  };
  return named[code] ?? code.toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Action chip — the one interactive control primitive (glass + glow)  */
/* ------------------------------------------------------------------ */
export function ActionChip({
  command, label, ar, hint, hue, disabled, onPress,
}: {
  command?: CommandName;
  label: string;
  ar?: string;
  /** Optional key hint — raw KeyboardEvent.code or a short display string. */
  hint?: string;
  /** Chip hue (CSS colour) for border/glow; defaults to the live accent. */
  hue?: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const dispatch = useMission((s) => s.dispatch);
  const pulse = useMission((s) => (command ? s.commandPulse[command] : undefined));
  const live = !!pulse && Date.now() - pulse < 240;
  const click = () => {
    haptic();
    if (command) dispatch(command, { playerInitiated: true });
    onPress?.();
  };
  return (
    <button
      type="button"
      className={`ma-chip ${live ? 'is-live' : ''}`}
      style={{ ['--chip-hue' as string]: hue ?? 'var(--ma-accent)' }}
      disabled={disabled}
      aria-label={ar ? `${label} — ${ar}` : label}
      aria-pressed={live || undefined}
      onClick={click}
    >
      {hint && <span className="ma-chip-k" aria-hidden dir="ltr">{keyLabel(hint)}</span>}
      <span className="flex flex-col items-start leading-tight">
        <span>{label}</span>
        {ar && <small>{ar}</small>}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Status rail — slim live telemetry (fuel · energy · shield)          */
/* ------------------------------------------------------------------ */
export interface RailValues {
  fuel: number;
  energy: number;
  shield: number;
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

export function StatusRail({ values }: { values?: RailValues }) {
  const t = useT();
  const lang = useLang();
  const sim = useMission((s) => s.sim);
  const validate = useMission((s) => s.validate);
  const launch = useMission((s) => s.launch);

  const ops = launch?.phase === 'ops' ? sim : null;
  const tankCap = validate?.budget.propellantMassKg ?? 0;
  const fuel = values?.fuel ?? (ops && tankCap > 0 ? clampPct((ops.propRemainingKg / tankCap) * 100) : 0);
  const energy = values?.energy ?? (ops ? clampPct(ops.batteryCapacityWh > 0 ? (ops.batteryChargeWh / ops.batteryCapacityWh) * 100 : 0) : 0);
  const shield = values?.shield ?? (ops ? (ops.safeMode ? 100 : clampPct((validate?.budget.reliability ?? 0.9) * 110 - 10)) : 0);

  const segs = [
    { key: 'fuel', label: t('fuel'), value: fuel, color: '#2FE05A' },
    { key: 'energy', label: t('energy'), value: energy, color: 'var(--ma-accent)' },
    { key: 'shield', label: t('shield'), value: shield, color: '#B05CFF' },
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-3"
      role="group"
      aria-label={lang === 'ar' ? 'حالة الأنظمة' : 'System status'}
    >
      {segs.map((s) => {
        const low = s.value < 20;
        const tone = low ? 'var(--ma-bad)' : s.color;
        return (
          <div
            key={s.key}
            className="ma-rail-seg"
            role="meter"
            aria-valuenow={Math.round(s.value)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${s.label} ${s.value.toFixed(0)}%`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="ma-rail-label">{s.label}</span>
              <span className="ma-rail-val ma-num" style={{ color: tone }}>
                {s.value.toFixed(0)}<span className="text-[10px] opacity-60 ml-0.5">%</span>
              </span>
            </div>
            <div className="ma-rail-bar mt-1.5">
              <i
                className={low ? 'ma-rail-low' : ''}
                style={{
                  width: `${s.value}%`,
                  background: `linear-gradient(90deg, ${tone}, color-mix(in srgb, ${tone} 55%, white))`,
                  boxShadow: `0 0 10px ${tone}`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mission control — the operations-phase command surface              */
/* ------------------------------------------------------------------ */
const OPS_CHIPS: { command: CommandName; hue: string }[] = [
  { command: 'FIRE', hue: '#FF5470' },
  { command: 'WARP', hue: '#B05CFF' },
  { command: 'SCAN', hue: '#2FE05A' },
  { command: 'NAV', hue: '#2F9CFF' },
  { command: 'COM', hue: '#FFB81F' },
  { command: 'SHLD', hue: '#B05CFF' },
];

const CHIP_LABEL: Record<string, StringKey> = {
  FIRE: 'fire', WARP: 'warp', SCAN: 'scan', NAV: 'nav', COM: 'com', SHLD: 'shld',
};

export function MissionActions() {
  const t = useT();
  const lang = useLang();
  const kb = useMission((s) => s.settings.keybindings);

  return (
    <section className="ma-rail" aria-label={lang === 'ar' ? 'مركز التحكم' : 'Mission control'}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <PanelTag ar="مركز التحكم" en="MISSION CONTROL" />
        <span className="text-[10px] uppercase tracking-widest text-[var(--ma-muted)]">
          {lang === 'ar'
            ? 'انقر الشرائح أو استخدم المفاتيح المعروضة عليها'
            : 'Click the chips — or use the keys printed on them'}
        </span>
      </div>
      <StatusRail />
      <div className="mt-4 flex flex-wrap gap-2">
        {OPS_CHIPS.map(({ command, hue }) => (
          <ActionChip
            key={command}
            command={command}
            label={t(CHIP_LABEL[command])}
            hint={kb[command]}
            hue={hue}
          />
        ))}
      </div>
    </section>
  );
}
