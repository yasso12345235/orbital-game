/** Style Guide — every control state, palette and typography sample (deliverable). */
import { Suspense, lazy, useState } from 'react';
import { useMission } from '../store';
import { useLang } from '../hooks';
import { Bi, HudFrame, Kpi, PanelTag, RingGauge } from '../components/controls';
import { ActionChip, StatusRail } from '../components/MissionControl';

/** v2 visual core — lazy chunk (R3F + post-processing stay out of the main bundle). */
const VisualCoreSection = lazy(() => import('../visual/VisualCoreSection'));
/** v2 step 3 — Home scene + wormhole review surface (lazy chunk). */
const HomeSceneSection = lazy(() => import('../visual/HomeSceneSection'));
/** v2 step 5 — Mission Select + Builder scenes review surface (lazy chunk). */
const ScreensSection = lazy(() => import('../visual/ScreensSection'));
/** v2 step 6 — Mission Ops scene review surface (lazy chunk). */
const OpsSection = lazy(() => import('../visual/OpsSection'));
/** v2 step 7 — launch cinematic review surface (lazy chunk). */
const LaunchSection = lazy(() => import('../visual/LaunchSection'));

export function StyleGuideScreen() {
  const lang = useLang();
  const setScreen = useMission((s) => s.setScreen);
  const [themePreview, setThemePreview] = useState<string>('earth');
  const [danger, setDanger] = useState(false);

  return (
    <div className="ma-enter flex flex-col gap-4" data-guide>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="ma-title text-3xl">{lang === 'ar' ? 'دليل الأنماط' : 'Style Guide'}</h2>
          <span className="ma-title-u" />
        </div>
        <div className="flex gap-2">
          {['earth', 'mars', 'jupiter', 'moon'].map((th) => (
            <button
              key={th}
              type="button"
              className={`px-3 py-1.5 rounded-lg border text-[11px] uppercase ${themePreview === th ? 'border-[var(--ma-accent)] text-[var(--ma-accent)]' : 'border-[var(--ma-line)] text-[var(--ma-muted)]'}`}
              onClick={() => {
                setThemePreview(th);
                const root = document.querySelector('.ma-root') as HTMLElement | null;
                root?.setAttribute('data-theme', th);
              }}
            >
              {th}
            </button>
          ))}
          <button type="button" className={`px-3 py-1.5 rounded-lg border text-[11px] uppercase ${danger ? 'border-[var(--ma-bad)] text-[var(--ma-bad)]' : 'border-[var(--ma-line)] text-[var(--ma-muted)]'}`} onClick={() => {
            setDanger(!danger);
            document.querySelector('.ma-root')?.classList.toggle('ma-critical', !danger);
          }}>
            {lang === 'ar' ? 'وضع حر' : 'critical mode'}
          </button>
          <button type="button" className="px-3 py-1.5 rounded-lg border border-[var(--ma-line)] text-[11px] uppercase" onClick={() => setScreen('playground')}>
            {lang === 'ar' ? 'الملعب 3D ←' : '3D playground →'}
          </button>
          <button type="button" className="px-3 py-1.5 rounded-lg border border-[var(--ma-line)] text-[11px] uppercase" onClick={() => setScreen('home')}>
            ← {lang === 'ar' ? 'الرئيسية' : 'home'}
          </button>
        </div>
      </div>

      {/* Controls — v3 context system */}
      <HudFrame tag="CONTROL SYSTEM" tagAr="نظام التحكم">
        <p className="text-[11px] text-[var(--ma-muted)] mb-4">
          {lang === 'ar'
            ? 'شريط الكونسول البكسلي أُزيل بالكامل. الأوامر الآن شرائح زجاجية سياقية تظهر داخل الشاشة التي تحتاجها (لوحة المهمة في شاشة المحاكاة)، وكل شريحة تعرض مفتاح اللوحة المرتبط بها.'
            : 'The pixel console is gone. Commands are now contextual glass chips that appear inside the screen that needs them (the mission panel in Simulation), and each chip prints its live keyboard binding.'}
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="ma-kpi-label uppercase mb-2">Action chips</p>
            <div className="flex flex-wrap gap-3 items-center">
              <ActionChip label="SCAN" ar="مسح" hint="X" hue="#2FE05A" />
              <ActionChip label="FIRE" ar="إطلاق" hint="Space" hue="#FF5470" />
              <ActionChip label="WARP" ar="زمن" hint="KeyW" hue="#B05CFF" />
              <ActionChip label="DISABLED" disabled />
            </div>
            <p className="text-[10px] text-[var(--ma-muted)] mt-3">
              idle · hover glow · live pulse when the command fires · disabled · optional kbd hint (raw KeyboardEvent.code or short label)
            </p>
          </div>
          <div>
            <p className="ma-kpi-label uppercase mb-2">Status rail</p>
            <StatusRail values={{ fuel: danger ? 12 : 72, energy: danger ? 8 : 55, shield: danger ? 6 : 88 }} />
            <p className="text-[10px] text-[var(--ma-muted)] mt-3">
              Fuel · Energy · Shield — slim glowing lines on glass; below 20% the segment switches to critical and pulses.
            </p>
          </div>
        </div>
      </HudFrame>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <HudFrame tag="PALETTE" tagAr="اللوحة">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Void', '#02050F'], ['Deep Space', '#050B1F'], ['Panel', '#0B1A3D'],
              ['Line', '#1B2A50'], ['Text', '#E8F1FF'], ['Muted', '#8FA3C8'],
              ['Earth', '#46C8FF'], ['Mars', '#FF6A3D'], ['Jupiter/Europa', '#A77BFF'],
              ['Progress', '#2FE39A'], ['Critical', '#FF4D6A'], ['Warning', '#FFC542'],
            ].map(([name, hex]) => (
              <div key={hex} className="flex flex-col items-center gap-1">
                <span className="w-10 h-10 rounded-lg border border-[var(--ma-line)]" style={{ background: hex }} />
                <span className="text-[9px] text-[var(--ma-muted)]">{name}</span>
                <span className="text-[9px] ma-num">{hex}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[var(--ma-muted)] mt-3">Accent cross-fades in 0.6s on data-theme change; critical mode switches all accents to red.</p>
        </HudFrame>

        <HudFrame tag="TYPOGRAPHY" tagAr="الخطوط">
          <p className="ma-title text-3xl">Cormorant serif</p>
          <p className="ma-kpi-num ma-num">0123456789</p>
          <p className="ma-kpi-label uppercase">Orbitron / Rajdhani — HUD numbers</p>
          <p style={{ fontFamily: 'var(--ma-pixel)' }} className="text-[11px] mt-2">Silkscreen pixel legends — panel tags &amp; badges</p>
          <p style={{ fontFamily: 'var(--ma-mono)' }} className="text-[12px] mt-2">JetBrains Mono — telemetry 123.45 m/s</p>
          <p className="font-ar text-[15px] mt-2">خط القاهرة — نص عربي واضح للطلاب</p>
          <p className="text-[11px] mt-2">Inter — UI text body copy.</p>
          <div className="mt-3">
            <Kpi ar="الكتلة" en="Mass" value={1234} unit="kg" accent="var(--ma-accent)" />
          </div>
        </HudFrame>

        <HudFrame tag="LAYOUT RULES" tagAr="قواعد التخطيط">
          <ul className="text-[12px] space-y-2 list-disc pl-4">
            <li>One dominant central visual per screen (planet, spacecraft, grid).</li>
            <li>Glass side panels frame it and never cover it.</li>
            <li>Slanted gradient header tag + thin accent border + HUD corner brackets.</li>
            <li>Context actions: chips live inside the screen that needs them — no permanent control bar.</li>
            <li>Bilingual labels: Arabic above English (or reversed by UI language). Numbers stay LTR.</li>
            <li>Leader lines animate on; labels hide behind the planet (occlusion tested).</li>
          </ul>
          <div className="flex items-center gap-3 mt-3">
            <div className="ma-floor" style={{ width: 60, height: 30, background: '#0B1A3D', borderRadius: 6 }} />
            <span className="text-[10px] text-[var(--ma-muted)]">glossy floor reflection sample</span>
          </div>
        </HudFrame>
      </div>

      <HudFrame tag="TAGS + GAUGES" tagAr="الوسوم والعدادات">
        <div className="flex items-center gap-4 flex-wrap">
          <PanelTag ar="وسم" en="PANEL TAG" />
          <PanelTag ar="آخر" en="ANOTHER" />
          <RingGauge value={danger ? 12 : 78} ar="الطاقة" en="Energy" unit="%" dangerBelow={20} />
          <RingGauge value={danger ? 95 : 40} ar="الكتلة" en="Mass" unit="%" />
          <Bi ar="نص ثنائي اللغة" en="Bilingual caption" stack />
        </div>
      </HudFrame>

      <HudFrame tag="VISUAL CORE v2 · 3D" tagAr="النواة البصرية ٣د">
        <p className="text-[11px] text-[var(--ma-muted)] mb-3">
          Base canvas + post stack + shared <span className="ma-num">uAccent</span> uniform (step 1 of the
          visual-layer rebuild). Switch the theme buttons above — the 3D accent cross-fades in 0.6 s exactly
          like the UI.
        </p>
        <Suspense
          fallback={
            <div className="grid h-[340px] place-items-center text-[11px] uppercase tracking-widest text-[var(--ma-muted)]">
              Loading 3D core…
            </div>
          }
        >
          <VisualCoreSection />
        </Suspense>
      </HudFrame>

      <HudFrame tag="HOME SCENE + WORMHOLE · 3D" tagAr="مشهد الرئيسية + الثقب الدودي">
        <p className="text-[11px] text-[var(--ma-muted)] mb-3">
          {lang === 'ar'
            ? 'الخطوة 3: الرئيسية تعمل الآن على عقدة SceneShell — طرف الكوكب (نسيج الهدف المحدد)، حقل نجوم، تحليق المركبة، ونيازك عابرة. زر التشغيل يعيد انتقال الثقب الدودي كما يحدث عند مغادرة الرئيسية.'
            : 'Step 3: Home runs on the SceneShell contract — planet limb (peek-target surface), starfield, spacecraft flyby and passing meteors. The button replays the wormhole transition exactly as leaving Home does.'}
        </p>
        <Suspense
          fallback={
            <div className="grid h-[340px] place-items-center text-[11px] uppercase tracking-widest text-[var(--ma-muted)]">
              Loading home scene…
            </div>
          }
        >
          <HomeSceneSection />
        </Suspense>
      </HudFrame>

      <HudFrame tag="MISSION SELECT + BUILDER · 3D" tagAr="اختيار المهمة + بناء المركبة ٣د">
        <p className="text-[11px] text-[var(--ma-muted)] mb-3">
          {lang === 'ar'
            ? 'الخطوة 5: لوحة «الكوكب المباشر» في اختيار المهمة صارت مشهد R3F (كوكب الهدف + حلقات مدارية + غبار)، ومعاينة البناء تُغذّى من التصميم الفعلي — الألواح الشمسية تُنشر عند تركيبها، وذراع المفاعل النووي RTG يظهر عند تركيبه — مع سحب للتدوير.'
            : 'Step 5: the Mission Select “live planet” panel is now an R3F scene (target planet + orbit rings + dust), and the builder preview is fed by the real design — solar wings deploy when an array is fitted, the nuclear RTG boom appears when it is, and the bay supports drag-orbit inspection.'}
        </p>
        <Suspense
          fallback={
            <div className="grid h-[340px] place-items-center text-[11px] uppercase tracking-widest text-[var(--ma-muted)]">
              Loading screens…
            </div>
          }
        >
          <ScreensSection />
        </Suspense>
      </HudFrame>

      <HudFrame tag="MISSION OPS · 3D" tagAr="عمليات المهمة ٣د">
        <p className="text-[11px] text-[var(--ma-muted)] mb-3">
          {lang === 'ar'
            ? 'الخطوة 6: «عرض المدار الحي» في المحاكاة وشاشة تصميم المدار صارا مشهد R3F واحداً — الحلقة = نافذة المهمة، والمركبة المتحركة = اليوم الحالي من elapsedDays الحقيقي، والعقد المرقّمة = أحداث السجل في أيامها وبألوان خطورتها (نفس مواضع الشريط الزمني). اليمين: عرض تجريبي بميل وارتفاع محليين. الحالة الحية تظهر أثناء مهمة جارية فقط.'
            : 'Step 6: the Simulation’s “orbit view” and the Orbit designer now run one shared R3F scene — the ring is the mission window, the travelling craft is today’s real elapsed day, and labelled nodes are event-log entries at their days in severity colours (matching the DOM timeline). Right: a demo with local inclination/altitude. The live board animates only while a mission is running.'}
        </p>
        <Suspense
          fallback={
            <div className="grid h-[340px] place-items-center text-[11px] uppercase tracking-widest text-[var(--ma-muted)]">
              Loading ops scene…
            </div>
          }
        >
          <OpsSection />
        </Suspense>
      </HudFrame>

      <HudFrame tag="LAUNCH CINEMATIC · 3D" tagAr="سينمائي الإطلاق ٣د">
        <p className="text-[11px] text-[var(--ma-muted)] mb-3">
          {lang === 'ar'
            ? 'الخطوة 7: سينمائي الإطلاق أُعيد بناؤه بالكامل على R3F — سماء متدرجة بشيدر تمرّ من الفجر إلى الفضاء، منصة وبرج خدمة شبكي، دخان إشعال، ولهب متوهّج، بينما تسقط الأرض والمنصة بينما تبقى المركبة في الإطار. ارتفاع الصاروخ مشتق من سعة الإطلاق الحقيقية. اسحب الشريط الزمني أو شغّل المعاينة — نفس مشهد المحاكاة تماماً.'
            : 'Step 7: the launch cinematic is fully rebuilt on R3F — a shader sky blending dawn into space, a pad with a service mast, ignition smoke and a glowing plume, while the ground falls away and the vehicle stays framed. Stack height derives from the real launcher capacity. Scrub the timeline or play the preview — this is exactly what the Simulation renders.'}
        </p>
        <Suspense
          fallback={
            <div className="grid h-[340px] place-items-center text-[11px] uppercase tracking-widest text-[var(--ma-muted)]">
              Loading launch…
            </div>
          }
        >
          <LaunchSection />
        </Suspense>
      </HudFrame>
    </div>
  );
}
