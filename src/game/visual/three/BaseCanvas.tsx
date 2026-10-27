/**
 * BaseCanvas — the shared R3F canvas for every v2 scene.
 * ACES tone mapping + sRGB output (R3F defaults), adaptive DPR via
 * PerformanceMonitor, loop paused when the tab is hidden, graceful
 * context-loss overlay, quality-tier AA and a WebGL-unavailable fallback.
 */
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { AccentDriver } from '../store-adapters/accent';
import { useVisualQuality } from './quality';
import { EffectsRig, type EffectsProps } from './post/EffectsRig';

function webglAvailable(): boolean {
  try {
    if (!window.WebGLRenderingContext) return false;
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    // Release the probe context immediately. Browsers cap the number of live WebGL
    // contexts (~16) and a leaked probe on every scene mount starves later canvases,
    // which then come up with a lost context — postprocessing's EffectComposer reads
    // `getContextAttributes().alpha` and throws. The probe must not stay alive.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export interface BaseCanvasProps {
  children: ReactNode;
  className?: string;
  /** Mount the standard post stack (true) or pass custom effect settings. */
  effects?: boolean | EffectsProps;
  /** 2D fallback rendered when WebGL is unavailable. */
  fallback?: ReactNode;
  cameraPosition?: [number, number, number];
  cameraFov?: number;
  /**
   * Listen for pointer events on this element instead of the canvas — lets
   * pointer-events-none hero layers (Home, Launch) keep parallax alive.
   */
  eventSource?: HTMLElement;
}

export function BaseCanvas({
  children,
  className = '',
  effects = true,
  fallback = null,
  cameraPosition = [0, 1.5, 9],
  cameraFov = 42,
  eventSource,
}: BaseCanvasProps) {
  const q = useVisualQuality();
  const [ok] = useState(webglAvailable);
  const [dpr, setDpr] = useState(q.dprMax);
  const [visible, setVisible] = useState(true);
  const [lost, setLost] = useState(false);

  // Performance budget: pause the render loop when the tab is hidden.
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  if (!ok) return <>{fallback}</>;

  return (
    <div className={`relative ${className}`}>
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={dpr}
        shadows={q.shadows}
        camera={{ position: cameraPosition, fov: cameraFov, near: 0.1, far: 2000 }}
        gl={{ antialias: q.antialias, alpha: true, powerPreference: 'high-performance' }}
        {...(eventSource ? { eventSource, eventPrefix: 'client' as const } : {})}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMappingExposure = 1.1;
          const el = gl.domElement;
          el.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setLost(true);
          });
          el.addEventListener('webglcontextrestored', () => setLost(false));
        }}
      >
        <PerformanceMonitor
          onDecline={() => setDpr((d) => Math.max(q.dprMin, d - 0.25))}
          onIncline={() => setDpr((d) => Math.min(q.dprMax, d + 0.25))}
        />
        <AccentDriver />
        <Suspense fallback={null}>
          {children}
          {effects ? <EffectsRig {...(typeof effects === 'object' ? effects : {})} /> : null}
        </Suspense>
      </Canvas>
      {lost && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[var(--ma-void)]/85 p-4 text-center">
          <p className="text-[12px] text-[var(--ma-muted)]">
            WebGL context lost — attempting to restore…
            <br />
            <span className="font-ar" dir="rtl">فُقد سياق الرسم ثلاثي الأبعاد — جارِ الاستعادة…</span>
          </p>
        </div>
      )}
    </div>
  );
}
