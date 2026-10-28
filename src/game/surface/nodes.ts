/**
 * surface/nodes.ts — deterministic resource field.
 *
 * The field is a pure function of the expedition seed, so the same save always
 * shows the same deposits. Depletion lives in `state.taken`.
 */
import { RESOURCE_IDS, surfaceProfileFor, type ResourceId } from './model';
import { rngFrom, type SurfaceNode } from './engine';

const COUNT = 34;

export function surfaceNodes(seed: number, target: string): SurfaceNode[] {
  const profile = surfaceProfileFor(target);
  const rand = rngFrom(seed ^ 0x9e3779b9);
  const weights = RESOURCE_IDS.map((id) => profile.bias[id] ?? 0.1);
  const total = weights.reduce((a, b) => a + b, 0);
  const pick = (): ResourceId => {
    let r = rand() * total;
    for (let i = 0; i < RESOURCE_IDS.length; i++) {
      r -= weights[i];
      if (r <= 0) return RESOURCE_IDS[i];
    }
    return RESOURCE_IDS[RESOURCE_IDS.length - 1];
  };

  const nodes: SurfaceNode[] = [];
  for (let i = 0; i < COUNT; i++) {
    const angle = rand() * Math.PI * 2;
    // Keep a clear apron around the lander, then spread out to the horizon.
    const radius = 13 + Math.pow(rand(), 0.72) * 52;
    nodes.push({
      id: i,
      kind: pick(),
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      scale: 0.75 + rand() * 0.6,
    });
  }
  return nodes;
}
