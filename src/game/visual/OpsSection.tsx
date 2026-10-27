/**
 * Style-guide mount for step 6 (Mission Ops scene) — the live ops orbit view
 * fed by the real mission state, plus an interactive designer demo with local
 * inclination / altitude sliders (no store writes).
 */
import { useMemo, useState } from 'react';
import { orbitReadout } from '@engine';
import { HudSlider } from '../components/controls';
import { useLang } from '../hooks';
import { useAccentBridge } from './store-adapters/accent';
import { SceneShell } from './three/core/SceneShell';
import OrbitOpsView from './OrbitOpsView';
import { OrbitOpsScene } from './three/scenes/OrbitOpsScene';

export default function OpsSection() {
  useAccentBridge();
  const lang = useLang();
  const [inclination, setInclination] = useState(52);
  const [altitude, setAltitude] = useState(600);
  const ringScale = Math.max(0.6, Math.min(1.6, altitude / 800));
  const readout = useMemo(() => orbitReadout(altitude), [altitude]);

  return (
    <div className="space-y-3" data-ops-section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="ma-holo relative h-[320px] overflow-hidden rounded-2xl border border-[var(--ma-line)]">
          <OrbitOpsView />
          <div className="pointer-events-none absolute left-3 top-2 text-[10px] uppercase tracking-widest text-[var(--ma-muted)]">
            live ops · {lang === 'ar' ? 'من حالة المهمة الحقيقية' : 'fed by the real mission state'}
          </div>
        </div>
        <div className="ma-holo relative h-[320px] overflow-hidden rounded-2xl border border-[var(--ma-line)]">
          <div className="absolute inset-0" data-scene="orbit-designer-demo">
            <SceneShell
              className="h-full w-full"
              camera={[0, 2.2, 7.4]}
              cameraFov={42}
              controls="orbit"
              orbitMinDistance={4}
              orbitMaxDistance={14}
              env={{ floor: false, particles: false, nebula: false }}
              rig={{ drift: 0.08, parallax: 0.35, target: [0, 0, 0] }}
            >
              <OrbitOpsScene target="earth" inclination={inclination} ringScale={ringScale} />
            </SceneShell>
          </div>
          <div className="pointer-events-none absolute left-3 top-2 text-[10px] uppercase tracking-widest text-[var(--ma-muted)]">
            designer demo · i = <span className="ma-num">{inclination}</span>° · h ={' '}
            <span className="ma-num">{altitude}</span> km
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <HudSlider
          label="Inclination"
          labelAr="الميل المداري"
          unit="°"
          value={inclination}
          min={0}
          max={180}
          step={1}
          onChange={setInclination}
          hint={lang === 'ar' ? 'يُميل مستوى المدار حول الكوكب' : 'Tilts the orbital plane around the planet'}
        />
        <HudSlider
          label="Altitude"
          labelAr="الارتفاع"
          unit="km"
          value={altitude}
          min={200}
          max={1400}
          step={20}
          onChange={setAltitude}
          hint={
            lang === 'ar'
              ? `الدورة ${readout.periodMin.toFixed(1)} د · السرعة ${readout.velocityKmS.toFixed(2)} كم/ث`
              : `T = ${readout.periodMin.toFixed(1)} min · v = ${readout.velocityKmS.toFixed(2)} km/s`
          }
        />
      </div>

      <p className="text-[10px] text-[var(--ma-muted)]">
        {lang === 'ar'
          ? 'اللوحة اليسرى تتحرك فقط أثناء مهمة جارية: المؤشر = اليوم الحالي (elapsedDays الحقيقي)، والعقد المرقّمة = أحداث السجل بألوان خطورتها — شغّل مهمة أو تخطَّ العد التنازلي.'
          : 'The left panel only animates while a mission is running: the marker is the real elapsed day, labelled nodes are event-log entries in severity colours — start a mission or skip the countdown.'}
      </p>
    </div>
  );
}
