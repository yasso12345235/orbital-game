/**
 * BuilderScene — step 5: the live spacecraft preview on the Builder screen,
 * driven by the real design (read-only store access):
 *   · solar wings deploy when a solar array is fitted (eased inside the kit),
 *   · the RTG boom appears when the nuclear unit is fitted
 *     (`outputPowerW > 0` in the component data — the same field the engine's
 *     power model reads).
 * The kit idles on the holo floor; drag-orbit inspection is wired in the
 * enclosing lazy entry (BuilderPreview).
 */
import { useMemo } from 'react';
import { lookupTables, useMission } from '../../../store';
import { SpacecraftKit } from '../shapes';

export function BuilderScene() {
  const powerId = useMission((s) => s.design.components.power);

  const power = useMemo(() => {
    if (!powerId) return null;
    return lookupTables().components[powerId] ?? null;
  }, [powerId]);

  const solar = (power?.solarAreaM2 ?? 0) > 0;
  const rtg = (power?.outputPowerW ?? 0) > 0 ? 1 : 0;

  return (
    <group position={[0, 0.32, 0]}>
      <SpacecraftKit unfold={solar ? 1 : 0.12} rtg={rtg} thrust={0.1} spin={0.35} />
    </group>
  );
}
