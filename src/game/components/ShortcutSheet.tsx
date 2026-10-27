/**
 * Shortcut sheet — a small "Keys" chip in the top bar opening a glass overlay
 * that lists every binding (mission, flow, directional) from the player's
 * live keybindings. This is the discovery layer of the v3 control system:
 * no gamepad buttons on screen, but nothing is hidden either.
 */
import { useEffect, useState } from 'react';
import { useMission } from '../store';
import { useLang } from '../hooks';
import { keyLabel } from './MissionControl';

const CMD_LABEL: Record<string, { en: string; ar: string }> = {
  FIRE: { en: 'Fire thruster', ar: 'إطلاق الدفع' },
  WARP: { en: 'Time warp', ar: 'تسريع الزمن' },
  SCAN: { en: 'Scan', ar: 'مسح' },
  NAV: { en: 'Navigate', ar: 'ملاحة' },
  COM: { en: 'Communicate', ar: 'اتصال' },
  SHLD: { en: 'Shield', ar: 'حماية' },
  CONFIRM: { en: 'Go / confirm', ar: 'تأكيد / متابعة' },
  BACK: { en: 'Back', ar: 'رجوع' },
  NEXT_SLOT: { en: 'Next slot / field', ar: 'الحقل التالي' },
  PAUSE: { en: 'Pause / dismiss', ar: 'إيقاف مؤقت' },
  UP: { en: 'Up', ar: 'أعلى' },
  DOWN: { en: 'Down', ar: 'أسفل' },
  LEFT: { en: 'Left', ar: 'يسار' },
  RIGHT: { en: 'Right', ar: 'يمين' },
};

const GROUPS: { en: string; ar: string; rows: string[] }[] = [
  { en: 'Mission', ar: 'المهمة', rows: ['FIRE', 'WARP', 'SCAN', 'NAV', 'COM', 'SHLD'] },
  { en: 'Flow', ar: 'التنقل', rows: ['CONFIRM', 'BACK', 'NEXT_SLOT', 'PAUSE'] },
  { en: 'Directional', ar: 'الاتجاهات', rows: ['UP', 'DOWN', 'LEFT', 'RIGHT'] },
];

export function ShortcutSheet() {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const kb = useMission((s) => s.settings.keybindings);

  // Esc closes the sheet (capture, so the global PAUSE binding stays parked).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="ma-chip ma-chip-ghost"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="ma-chip-k" aria-hidden>⌨</span>
        <span>{lang === 'ar' ? 'المفاتيح' : 'Keys'}</span>
      </button>

      {open && (
        <div
          className="ma-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={lang === 'ar' ? 'اختصارات المفاتيح' : 'Keyboard shortcuts'}
          onClick={() => setOpen(false)}
        >
          <div className="ma-sheet-panel ma-panel p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="ma-hudtag" dir="ltr">{lang === 'ar' ? 'المفاتيح · KEYS' : 'KEYS · المفاتيح'}</span>
              <button type="button" className="ma-btn-ghost" onClick={() => setOpen(false)}>
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
            <p className="text-[11px] text-[var(--ma-muted)] mb-4">
              {lang === 'ar'
                ? 'لوحة المفاتيح وذراع التحكم يدعمان كل الأوامر — أعد التعيين من الحظيرة.'
                : 'Keyboard and gamepad drive every command — rebind them in the Hangar.'}
            </p>
            <div className="space-y-4">
              {GROUPS.map((g) => (
                <div key={g.en}>
                  <p className="ma-kpi-label uppercase mb-2">{lang === 'ar' ? g.ar : g.en}</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {g.rows.map((cmd) => {
                      const label = CMD_LABEL[cmd];
                      const code = kb[cmd];
                      return (
                        <li key={cmd} className="flex items-center justify-between gap-3 text-[12px] text-[var(--ma-text)]">
                          <span>{label ? (lang === 'ar' ? label.ar : label.en) : cmd}</span>
                          <span className="ma-kbd" dir="ltr">{code ? keyLabel(code) : '—'}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
