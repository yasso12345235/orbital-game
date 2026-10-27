/**
 * OrbitOpsScene — step 6: the live operations orbit view. The dashed ring maps
 * the mission window: the travelling craft is “today” (eased toward the real
 * `sim.elapsedDays`, snapped under reduced motion), and the labelled nodes sit
 * at their event days with severity colours — the same days as the DOM
 * timeline below the canvas. The designer variant (`live=false`) drops the
 * craft + nodes and only reflects the tuned inclination and altitude mapping.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { lookupTables, useMission } from '../../../store';
import { useVisualQuality } from '../quality';
import { DataNode, OrbitRing, ParticleField, Planet, SpacecraftKit } from '../shapes';

/** Earth-like targets get a cloud shell (mirrors the procedural textures). */
const EARTHLIKE = new Set(['earth', 'leo', 'gto', 'geo']);
const CRITICAL = '#FF4D6A';
const WARN = '#FFC542';
/** The ring is the mission window: one full lap over `durationDays`. */
const LAPS = 1;

export interface OrbitOpsSceneProps {
  target?: string;
  /** Orbital inclination (deg) — tilts the ring plane. */
  inclination?: number;
  /** Ring-radius multiplier (altitude mapping on the designer). */
  ringScale?: number;
  /** Live sim: travelling craft + event nodes from the real event log. */
  live?: boolean;
}

export function OrbitOpsScene({
  target = 'earth',
  inclination = 0,
  ringScale = 1,
  live = false,
}: OrbitOpsSceneProps) {
  const q = useVisualQuality();
  const sim = useMission((s) => (live ? s.sim : null));
  const powerId = useMission((s) => s.design.components.power);

  const radius = 2.3 * ringScale;

  // Design-driven craft (read-only, same mapping as the Builder preview).
  const power = useMemo(() => {
    if (!powerId) return null;
    return lookupTables().components[powerId] ?? null;
  }, [powerId]);
  const solar = (power?.solarAreaM2 ?? 0) > 0;
  const rtg = (power?.outputPowerW ?? 0) > 0 ? 1 : 0;

  // Notable events (warn/critical) as labelled nodes — day fraction → ring angle.
  const nodes = useMemo(() => {
    if (!sim) return [];
    const dur = Math.max(1, sim.durationDays);
    return sim.eventLog
      .filter((e) => e.severity !== 'info')
      .slice(-4)
      .map((e, i) => ({
        key: `${i}-${e.kind}-${e.day.toFixed(1)}`,
        label: `${e.kind.toUpperCase()} · D${e.day.toFixed(0)}`,
        angle: Math.min(1, Math.max(0, e.day / dur)) * Math.PI * 2 * LAPS,
        color: e.severity === 'critical' ? CRITICAL : WARN,
      }));
  }, [sim]);

  const marker = useRef<Group>(null);
  const angle = useRef(0);

  useFrame((_, dt) => {
    const g = marker.current;
    if (!g || !live) return;
    const s = useMission.getState().sim;
    if (!s) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const frac = s.durationDays > 0 ? Math.min(1, s.elapsedDays / s.durationDays) : 0;
    const to = frac * Math.PI * 2 * LAPS;
    // The store ticks at 10 Hz — ease between ticks for smooth travel.
    angle.current = q.reduced ? to : angle.current + (to - angle.current) * Math.min(1, dt * 3);
    const a = angle.current;
    g.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    // Hold attitude along the direction of travel (local +Z → tangent).
    g.rotation.y = -a;
  });

  return (
    <group>
      <Planet
        target={target}
        radius={1.45}
        spin={1}
        cloud={EARTHLIKE.has(target) ? 0.7 : 0}
        atmosphere={1.5}
      />

      {/* Node (yaw) + inclination tilt: the plane reads as an ellipse, never edge-on. */}
      <group rotation={[0, 0.55, 0]}>
        <group rotation={[0, 0, (inclination * Math.PI) / 180]}>
          <OrbitRing radius={radius} tilt={0} speed={0.35} dashes={live ? 72 : 56} satellites={live ? 0 : 3} />
          {nodes.map((n) => (
            <DataNode
              key={n.key}
              label={n.label}
              color={n.color}
              position={[Math.cos(n.angle) * radius, 0, Math.sin(n.angle) * radius]}
              pulse={0.8}
              rings={1}
              leader={0.9}
            />
          ))}
          {live && (
            <group ref={marker} visible={false}>
              <group scale={0.26}>
                <SpacecraftKit unfold={solar ? 1 : 0.12} rtg={rtg} thrust={0} spin={0} />
              </group>
            </group>
          )}
        </group>
      </group>

      <ParticleField count={live ? 4200 : 3000} spread={14} drift={0.7} size={0.6} />
    </group>
  );
}
