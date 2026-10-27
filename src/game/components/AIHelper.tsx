/** Mission Control AI helper — short canned answers with an "explain more" button. */
import { useMemo, useState } from 'react';
import { useMission, lookupTables } from '../store';
import { useLang, useT } from '../hooks';
import { PanelTag } from './controls';

interface QA { keys: string[]; short: string; shortAr: string; long: string; longAr: string }

/** Top-bar entry point for the AI helper — the panel itself opens as a dialog. */
export function AIChip() {
  const aiOpen = useMission((s) => s.aiOpen);
  const toggle = useMission((s) => s.toggleAi);
  const t = useT();
  return (
    <button
      type="button"
      className={`ma-chip ${aiOpen ? '' : 'ma-chip-ghost'}`}
      onClick={toggle}
      aria-haspopup="dialog"
      aria-expanded={aiOpen}
      aria-label={t('aiHelper')}
    >
      🤖 AI
    </button>
  );
}

export function AIHelper() {
  const t = useT();
  const lang = useLang();
  const open = useMission((s) => s.aiOpen);
  const toggle = useMission((s) => s.toggleAi);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const budget = useMission((s) => s.validate?.budget);
  const missionId = useMission((s) => s.missionId);
  const mission = missionId ? lookupTables().missions[missionId] : null;

  const qa: QA[] = useMemo(() => [
    {
      keys: ['mass', 'كتلة', 'weight', 'heavy'],
      short: budget ? `Mass ${budget.totalMassKg.toFixed(0)} kg vs capacity ${budget.launcherCapacityKg.toFixed(0)} kg (margin ${budget.massMarginKg >= 0 ? '+' : ''}${budget.massMarginKg.toFixed(0)} kg).` : 'Pick a mission first.',
      shortAr: budget ? `الكتلة ${budget.totalMassKg.toFixed(0)} كغ مقابل السعة ${budget.launcherCapacityKg.toFixed(0)} كغ (الهامش ${budget.massMarginKg.toFixed(0)} كغ).` : 'اختر مهمة أولًا.',
      long: 'Mass margin = launcher capacity − (dry mass + propellant). Keep 10–20% margin so real-world uncertainties (fluid residuals, growth) do not block the mission. Every kg of propellant adds less dv than the last (rocket equation).',
      longAr: 'هامش الكتلة = سعة الصاروخ − (الكتلة الجافة + الوقود). أبقِ هامشًا 10–20٪ لأن عدم اليقين الواقعي يتطلب ذلك، وكل كيلوغرام وقود يضيف دلتا-في أقل من سابقه.',
    },
    {
      keys: ['power', 'solar', 'battery', 'طاقة', 'بطارية', 'شمس'],
      short: budget ? `Generation ${budget.generationW.toFixed(0)} W vs load ${budget.loadW.toFixed(0)} W; battery ${budget.batteryWh.toFixed(0)} Wh.` : 'Pick a mission first.',
      shortAr: budget ? `التوليد ${budget.generationW.toFixed(0)} واط مقابل الحمل ${budget.loadW.toFixed(0)} واط؛ البطارية ${budget.batteryWh.toFixed(0)} واط-ساعة.` : 'اختر مهمة أولًا.',
      long: 'Generation P = area × efficiency × flux × cos(angle). Flux drops with distance² (1361 W/m² at Earth, 590 at Mars, 50 at Jupiter), so far missions need bigger arrays. The battery must carry the load through eclipse with ~20% margin.',
      longAr: 'التوليد P = المساحة × الكفاءة × التدفق × جيب التمام. التدفق يهبط بمربع المسافة (1361 عند الأرض، 590 عند المريخ، 50 عند المشتري)، لذا تحتاج المهام البعيدة ألواحًا أكبر، والبطارية تغطي الظل بهامش 20٪.',
    },
    {
      keys: ['dv', 'delta', 'fuel', 'propellant', 'وقود', 'دلتا'],
      short: budget ? `Available dv ${budget.availableDvMps.toFixed(0)} m/s vs required ${budget.requiredDvMps.toFixed(0)} m/s.` : 'Pick a mission first.',
      shortAr: budget ? `دلتا-في المتاحة ${budget.availableDvMps.toFixed(0)} م/ث مقابل المطلوبة ${budget.requiredDvMps.toFixed(0)} م/ث.` : 'اختر مهمة أولًا.',
      long: 'Δv = Isp × g₀ × ln(m₀/m_f). To get more dv: raise Isp (chemical ~320 s, ion ~2500 s) or carry more propellant — but propellant mass has diminishing returns inside the same tank capacity.',
      longAr: 'Δv = Isp × g₀ × ln(m₀/m_f). لزيادة دلتا-في: ارفع الدفع النوعي (كيميائي ~320 ث، أيوني ~2500 ث) أو احمل وقودًا أكثر مع الانتباه للعائد المتناقص.',
    },
    {
      keys: ['cost', 'budget', 'credits', 'تكلفة', 'ميزانية'],
      short: budget ? `Total ${budget.costTotal.toFixed(0)} credits (launcher ${budget.costBreakdown.launcher.toFixed(0)}, ops ${budget.costBreakdown.operations.toFixed(0)}).` : 'Pick a mission first.',
      shortAr: budget ? `الإجمالي ${budget.costTotal.toFixed(0)} رصيدًا (الصاروخ ${budget.costBreakdown.launcher.toFixed(0)}، التشغيل ${budget.costBreakdown.operations.toFixed(0)}).` : 'اختر مهمة أولًا.',
      long: 'Cost = design + hardware + launcher + (ops per month × duration months). Long missions are dominated by operations — this is why cheap launchers still make expensive missions if ops drags on.',
      longAr: 'التكلفة = التصميم + العتاد + الصاروخ + (التشغيل الشهري × عدد الأشهر). المهام الطويلة يغلب عليها التشغيل.',
    },
    {
      keys: ['link', 'comm', 'delay', 'اتصال', 'تأخير'],
      short: mission ? `Target ${mission.target}: one-way light delay depends on distance; downlink rate scales with power × gain / d².` : 'Pick a mission first.',
      shortAr: mission ? `الهدف ${mission.target}: تأخير الضوء يعتمد على المسافة، ومعدل الإرسال يتناسب مع القدرة × الكسب ÷ المسافة².` : 'اختر مهمة أولًا.',
      long: 'Long light delay means commands arrive late — the spacecraft must be autonomous. That is why deep-space missions use safe modes and onboard fault protection, and why we simulate COM retries.',
      longAr: 'التأخير الطويل يعني وصول الأوامر متأخرًا، لذا تحتاج المركبة استقلالية وحماية ذاتية — وهذا سبب محاكاة إعادة المحاولة COM.',
    },
    {
      keys: ['reliability', 'redundancy', 'risk', 'موثوقية', 'خطر'],
      short: budget ? `System reliability ${(budget.reliability * 100).toFixed(1)}% (spacecraft ${(budget.spacecraftReliability * 100).toFixed(1)}%).` : 'Pick a mission first.',
      shortAr: budget ? `موثوقية النظام ${(budget.reliability * 100).toFixed(1)}٪ (المركبة ${(budget.spacecraftReliability * 100).toFixed(1)}٪).` : 'اختر مهمة أولًا.',
      long: 'Series reliability multiplies: P = Π Rᵢ — adding subsystems lowers it. Redundancy raises each unit to 1 − (1−R)² but costs extra mass and money, so you spend margin where the payoff is biggest.',
      longAr: 'الموثوقية التسلسلية تتضاعف: P = Π Rᵢ — إضافة الأنظمة تخفضها. التكرار يرفع كل وحدة إلى 1 − (1−R)² لكنه يكلف كتلة ورصيدًا.',
    },
  ], [budget, mission]);

  const answer = useMemo(() => {
    if (!q.trim()) return null;
    const lower = q.toLowerCase();
    const hit = qa.find((item) => item.keys.some((k) => lower.includes(k)));
    if (!hit) {
      return {
        short: 'Try asking about mass, power, delta-v, cost, link or reliability.',
        shortAr: 'اسأل عن الكتلة أو الطاقة أو دلتا-في أو التكلفة أو الوصلة أو الموثوقية.',
        long: 'Each keyword maps to a design check with real numbers from your current spacecraft.',
        longAr: 'كل كلمة مفتاحية تقابل فحصًا بالبيانات الفعلية لمركبتك الحالية.',
      };
    }
    return hit;
  }, [q, qa]);

  if (!open) {
    return null;
  }

  return (
    <aside className="fixed top-24 right-4 z-[60] w-[320px] ma-panel p-3" aria-label={t('aiHelper')}>
      <div className="flex items-center justify-between mb-2">
        <PanelTag ar="ذكاء مركز التحكم" en="MISSION CONTROL AI" />
        <button type="button" className="text-xs opacity-60 hover:opacity-100" onClick={toggle} aria-label="Close helper">✕</button>
      </div>
      <input
        className="ma-input w-full"
        placeholder={t('aiPlaceholder')}
        value={q}
        onChange={(e) => { setQ(e.target.value); setExpanded(null); }}
        aria-label={t('aiPlaceholder')}
      />
      {answer && (
        <div className="mt-2 text-[12px]">
          <p>{lang === 'ar' ? answer.shortAr : answer.short}</p>
          {expanded !== null ? (
            <p className="mt-2 text-[11px] text-[var(--ma-muted)]">{lang === 'ar' ? answer.longAr : answer.long}</p>
          ) : (
            <button type="button" className="mt-2 text-[11px] underline text-[var(--ma-accent)]" onClick={() => setExpanded(0)}>
              {t('explainMore')}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
