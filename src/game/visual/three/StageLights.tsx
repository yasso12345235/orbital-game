/**
 * StageLights — the shared three-point lighting rig for v2 scenes:
 * warm key, cyan rim, violet fill, cool ambient. Tuned for ACES + bloom.
 */
import { PALETTE } from '../theme/tokens';

export function StageLights() {
  return (
    <>
      <ambientLight color={PALETTE.panel} intensity={0.9} />
      <directionalLight color="#FFE9C4" intensity={1.35} position={[5, 6, 4]} />
      <pointLight color="#46C8FF" intensity={26} distance={40} decay={2} position={[-7, -2, -6]} />
      <pointLight color="#A77BFF" intensity={18} distance={40} decay={2} position={[0, 5, -9]} />
      <pointLight color="#FFE9C4" intensity={10} distance={30} decay={2} position={[4, -3, 7]} />
    </>
  );
}
