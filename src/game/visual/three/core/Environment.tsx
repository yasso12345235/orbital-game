/**
 * Environment — the shared v3 world backdrop for every scene: nebula washes,
 * drifting dust + stars and the holo grid floor, all quality-scaled and
 * reduced-motion aware. The canvas stays transparent by default so the CSS
 * aurora background keeps breathing through; pass `background` for full-bleed
 * scenes (Home, Launch) that own the whole viewport.
 */
import { WORLD } from '../../theme/tokens';
import { useVisualQuality } from '../quality';
import { HoloFloor, Nebula, ParticleField } from '../shapes';

export interface EnvironmentProps {
  /** Drifting dust + stars layer. */
  particles?: boolean;
  /** Nebula washes behind the scene. */
  nebula?: boolean;
  /** Holo grid floor — true (y = -2.2), a custom y, or false. */
  floor?: boolean | number;
  /** Floor scan-pulse strength. */
  pulse?: number;
  /** Fog [near, far] in world units, or false to disable. */
  fog?: [number, number] | false;
  /** Opaque background colour (hex) — default false keeps the canvas transparent. */
  background?: string | false;
}

export function Environment({
  particles = true,
  nebula = true,
  floor = true,
  pulse = 0.35,
  fog = false,
  background = false,
}: EnvironmentProps) {
  const q = useVisualQuality();
  const dust = Math.max(600, Math.round(q.particles * 0.35));

  return (
    <>
      {background !== false && <color attach="background" args={[background]} />}
      {fog !== false && <fog attach="fog" args={[WORLD.fog, fog[0], fog[1]]} />}
      {nebula && <Nebula intensity={0.55} />}
      {particles && <ParticleField count={dust} spread={30} drift={0.5} />}
      {floor !== false && (
        <HoloFloor y={typeof floor === 'number' ? floor : -2.2} pulse={pulse} pulseSpeed={4} />
      )}
    </>
  );
}
