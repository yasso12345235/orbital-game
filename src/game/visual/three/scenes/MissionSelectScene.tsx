/**
 * MissionSelectScene — step 5: the live target planet for the carousel's
 * selected mission, wrapped in its accessible orbit rings (ring count hints
 * at mission tier). The target prop swaps the surface texture in place —
 * no canvas remount, no GL context churn.
 */
import { OrbitRing, ParticleField, Planet } from '../shapes';

/** Earth-like targets get a cloud shell (mirrors the procedural textures). */
const EARTHLIKE = new Set(['earth', 'leo', 'gto', 'geo']);

export interface MissionSelectSceneProps {
  target?: string;
  /** Outer orbit rings shown (mission tiers). */
  orbits?: number;
}

export function MissionSelectScene({ target = 'earth', orbits = 2 }: MissionSelectSceneProps) {
  return (
    <group>
      <Planet
        target={target}
        radius={1.35}
        spin={1.1}
        cloud={EARTHLIKE.has(target) ? 0.7 : 0}
        atmosphere={1.6}
      />
      <OrbitRing radius={2.0} tilt={64} speed={0.55} dashes={36} satellites={2} />
      {orbits > 1 && <OrbitRing radius={2.55} tilt={18} speed={0.4} dashes={52} satellites={1} />}
      <ParticleField count={1400} spread={8.5} drift={0.7} />
    </group>
  );
}
