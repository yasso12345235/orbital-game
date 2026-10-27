/**
 * MiniGlobe — a tiny pure-SVG globe for mission cards. No WebGL context cost,
 * so it can live in the main chunk (moved out of the legacy three scene module
 * in step 9).
 */
const TARGET_COLORS: Record<string, string> = {
  earth: '#46C8FF',
  leo: '#46C8FF',
  gto: '#46C8FF',
  geo: '#46C8FF',
  mars: '#FF6A3D',
  jupiter: '#A77BFF',
  europa: '#D9C6FF',
  moon: '#9AD1FF',
  venus: '#FFC55A',
  eros: '#C9B29B',
  titan: '#E8A03D',
};

export function MiniGlobe({ target, size = 64, className = '' }: { target: string; size?: number; className?: string }) {
  const color = TARGET_COLORS[target] ?? '#46C8FF';
  const gid = `mg-${target}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <radialGradient id={gid} cx="35%" cy="30%">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="70%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor="#02050F" stopOpacity="1" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="20" fill={`url(#${gid})`} />
      <circle cx="32" cy="32" r="24" fill="none" stroke={color} strokeOpacity="0.45" strokeWidth="1" strokeDasharray="3 4" />
    </svg>
  );
}
