/**
 * ORBITAL — one vector icon family (24×24, 1.7 stroke).
 * No emoji anywhere in the UI: every glyph is a stroked path that inherits
 * `currentColor`, so it follows the active planet accent automatically.
 */
import type { CSSProperties, ReactNode } from 'react';

export type IconName =
  | 'home' | 'hangar' | 'missions' | 'builder' | 'launcher' | 'orbit'
  | 'simulation' | 'results' | 'tech' | 'settings'
  | 'play' | 'continue' | 'plus' | 'lock' | 'check' | 'star'
  | 'chevronLeft' | 'chevronRight' | 'arrowRight' | 'arrowLeft' | 'close'
  | 'fuel' | 'energy' | 'hull' | 'nav' | 'science' | 'comms'
  | 'warning' | 'info' | 'target' | 'globe' | 'radar' | 'engine'
  | 'wrench' | 'volume' | 'mute' | 'user' | 'chart' | 'clock' | 'rocket' | 'spark';

const P: Record<IconName, ReactNode> = {
  home: <><path d="M3.5 10.4 12 3.6l8.5 6.8" /><path d="M5.6 9v10.4h12.8V9" /><path d="M9.7 19.4v-5.6h4.6v5.6" /></>,
  hangar: <><path d="M3 20.4V8.2L12 3l9 5.2v12.2" /><path d="M3 20.4h18" /><path d="M7 20.4v-7.2l5-2.9 5 2.9v7.2" /><path d="M12 13.6v6.8" /></>,
  missions: <><circle cx="12" cy="12" r="8.6" /><path d="M3.4 12h17.2" /><path d="M12 3.4c2.5 2.6 3.8 5.5 3.8 8.6s-1.3 6-3.8 8.6c-2.5-2.6-3.8-5.5-3.8-8.6S9.5 6 12 3.4Z" /></>,
  builder: <><path d="M4 6.4 12 2.8l8 3.6v11.2l-8 3.6-8-3.6Z" /><path d="M4 6.4 12 10l8-3.6" /><path d="M12 10v11.2" /><path d="M8 8.2l8-3.6" /></>,
  launcher: <><path d="M12 2.8c3.2 2.5 4.8 5.5 4.8 9.1V17H7.2v-5.1c0-3.6 1.6-6.6 4.8-9.1Z" /><path d="M7.2 12.4 4.6 15v3.3h2.6" /><path d="M16.8 12.4 19.4 15v3.3h-2.6" /><path d="M10.2 17.8c.4 1.6 1 2.7 1.8 3.4.8-.7 1.4-1.8 1.8-3.4" /></>,
  orbit: <><circle cx="12" cy="12" r="3.1" /><ellipse cx="12" cy="12" rx="9.2" ry="4.3" transform="rotate(-24 12 12)" /><circle cx="19.1" cy="7.2" r="1.35" fill="currentColor" stroke="none" /></>,
  simulation: <><path d="M3.6 12h3.2l2.1-5.4 4.1 11 2.2-5.6h5.2" /><path d="M3.6 19.4h16.8" opacity=".45" /></>,
  results: <><path d="M4 20.2V13h3.6v7.2" /><path d="M10.2 20.2V8.6h3.6v11.6" /><path d="M16.4 20.2V4.2H20v16" /><path d="M3 20.2h18" /></>,
  tech: <><circle cx="12" cy="4.8" r="2.4" /><circle cx="5.6" cy="18.6" r="2.4" /><circle cx="18.4" cy="18.6" r="2.4" /><path d="M10.8 7 6.8 16.4" /><path d="M13.2 7l4 9.4" /><path d="M8 18.6h8" /></>,
  settings: <><circle cx="12" cy="12" r="3.1" /><path d="M12 2.9v2.4M12 18.7v2.4M4.5 7.7l2 1.2M17.5 15.1l2 1.2M4.5 16.3l2-1.2M17.5 8.9l2-1.2" /></>,
  play: <path d="M8.2 5.4 19 12 8.2 18.6Z" />,
  continue: <><circle cx="12" cy="12" r="8.8" /><path d="M10.2 8.4 15 12l-4.8 3.6Z" /></>,
  plus: <path d="M12 4.8v14.4M4.8 12h14.4" />,
  lock: <><rect x="5" y="10.4" width="14" height="10" rx="2.4" /><path d="M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6" /><circle cx="12" cy="15.4" r="1.3" fill="currentColor" stroke="none" /></>,
  check: <path d="m5 12.6 4.4 4.4L19 6.6" />,
  star: <path d="m12 3.4 2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 16.93 6.7 19.71l1.01-5.9L3.42 9.63l5.93-.86Z" fill="currentColor" stroke="none" />,
  chevronLeft: <path d="M14.8 5.6 8.4 12l6.4 6.4" />,
  chevronRight: <path d="M9.2 5.6 15.6 12l-6.4 6.4" />,
  arrowRight: <><path d="M4.4 12h15.2" /><path d="m14.4 6.8 5.2 5.2-5.2 5.2" /></>,
  arrowLeft: <><path d="M19.6 12H4.4" /><path d="m9.6 6.8-5.2 5.2 5.2 5.2" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  fuel: <><path d="M5.2 20.4V5.6A1.6 1.6 0 0 1 6.8 4h5.2a1.6 1.6 0 0 1 1.6 1.6v14.8" /><path d="M3.4 20.4h12" /><path d="M13.6 10.2h2.2l2.6 2.6v5.4a1.4 1.4 0 0 0 2.8 0V9.4l-2.2-2.2" /><path d="M7.2 7.6h4.4" /></>,
  energy: <><path d="M13.2 2.8 5.6 13.6h5.4l-1.2 7.6 8.6-11.6h-5.8Z" /></>,
  hull: <><path d="M12 2.9 4.6 6v5.9c0 4.4 3 7.7 7.4 9.2 4.4-1.5 7.4-4.8 7.4-9.2V6Z" /><path d="M9 12.2l2.1 2.1 4-4.2" opacity=".8" /></>,
  nav: <><circle cx="12" cy="12" r="8.8" /><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1Z" /></>,
  science: <><path d="M9.4 3h5.2" /><path d="M10.2 3v5.2L5.4 17a2.4 2.4 0 0 0 2.1 3.6h9a2.4 2.4 0 0 0 2.1-3.6l-4.8-8.8V3" /><path d="M7.4 14.2h9.2" /></>,
  comms: <><path d="M12 14.6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /><path d="M8.2 7.6a5.4 5.4 0 0 0 0 7.6M15.8 7.6a5.4 5.4 0 0 1 0 7.6" /><path d="M5.4 5a9.4 9.4 0 0 0 0 12.8M18.6 5a9.4 9.4 0 0 1 0 12.8" /></>,
  warning: <><path d="M12 3.6 21 19.8H3Z" /><path d="M12 9.2v4.6" /><circle cx="12" cy="16.8" r="1" fill="currentColor" stroke="none" /></>,
  info: <><circle cx="12" cy="12" r="8.8" /><path d="M12 10.8v5.4" /><circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none" /></>,
  target: <><circle cx="12" cy="12" r="8.6" /><circle cx="12" cy="12" r="4.6" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  globe: <><circle cx="12" cy="12" r="8.8" /><path d="M3.4 12h17.2" /><path d="M12 3.2c2.6 2.7 3.9 5.7 3.9 8.8s-1.3 6.1-3.9 8.8c-2.6-2.7-3.9-5.7-3.9-8.8s1.3-6.1 3.9-8.8Z" /></>,
  radar: <><circle cx="12" cy="12" r="8.8" /><circle cx="12" cy="12" r="5.2" opacity=".6" /><path d="M12 3.2V12l6.2 6.2" /><circle cx="15.4" cy="8.4" r="1.4" fill="currentColor" stroke="none" /></>,
  engine: <><path d="M8 6.4h8v7.2a4 4 0 0 1-4 4 4 4 0 0 1-4-4Z" /><path d="M10 2.8h4v3.6h-4Z" /><path d="M9.6 17.8c.4 1.7 1.2 2.5 2.4 2.9 1.2-.4 2-1.2 2.4-2.9" /></>,
  wrench: <><path d="M14.4 6.4a4.4 4.4 0 0 0 5.6 5.6l-8 8a2.3 2.3 0 0 1-3.2-3.2l8-8a4.4 4.4 0 0 0-5.6-5.6l2.8 2.8-2 2-2.8-2.8a4.4 4.4 0 0 0 5.2 1.2Z" /></>,
  volume: <><path d="M4 9.6h3.4L12 5.4v13.2L7.4 14.4H4Z" /><path d="M15.4 9a4.2 4.2 0 0 1 0 6M17.8 6.4a7.8 7.8 0 0 1 0 11.2" /></>,
  mute: <><path d="M4 9.6h3.4L12 5.4v13.2L7.4 14.4H4Z" /><path d="m15.4 9.4 5 5.2M20.4 9.4l-5 5.2" /></>,
  user: <><circle cx="12" cy="8.2" r="3.8" /><path d="M4.8 20.6c.6-3.6 3.5-5.6 7.2-5.6s6.6 2 7.2 5.6" /></>,
  chart: <><path d="M3.6 19.4V4.6M3.6 19.4h16.8" /><path d="M7 15.6l3.4-4.2 3 2.4 3.8-5.4" /></>,
  clock: <><circle cx="12" cy="12" r="8.8" /><path d="M12 7.2V12l3.2 2" /></>,
  rocket: <><path d="M12 2.8c3.2 2.5 4.8 5.5 4.8 9.1V17H7.2v-5.1c0-3.6 1.6-6.6 4.8-9.1Z" /><path d="M7.2 12.4 4.6 15v3.3h2.6M16.8 12.4 19.4 15v3.3h-2.6" /><path d="M10.2 17.8c.4 1.6 1 2.7 1.8 3.4.8-.7 1.4-1.8 1.8-3.4" /></>,
  spark: <><path d="M12 3v3.4M12 17.6V21M3 12h3.4M17.6 12H21" /><path d="m5.6 5.6 2.4 2.4M16 16l2.4 2.4M18.4 5.6 16 8M8 16l-2.4 2.4" /></>,
};

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
  title?: string;
}

export function Icon({ name, size = 20, className = '', style, strokeWidth = 1.7, title }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`ma-icon shrink-0 ${className}`}
      style={style}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {P[name]}
    </svg>
  );
}

/** Inline glyph for use inside an existing <svg> (tech tree, radar, maps). */
export function Glyph({ name, x, y, size = 20, color = 'currentColor' }: { name: IconName; x: number; y: number; size?: number; color?: string }) {
  const s = size / 24;
  return (
    <g
      transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s})`}
      fill="none"
      stroke={color}
      strokeWidth={1.7 / s}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color }}
    >
      {P[name]}
    </g>
  );
}
