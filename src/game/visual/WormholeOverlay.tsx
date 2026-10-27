/**
 * WormholeOverlay — full-screen transition played when leaving Home (step 3).
 *
 * rAF owns the timeline: it drives the shader progress through a ref (no
 * re-renders) and the CSS veil opacity directly. Default run 1.5 s; under
 * prefers-reduced-motion it degrades to a short veil-only dip (no motion,
 * no tunnel canvas), so the a11y contract holds everywhere.
 */
import { Suspense, useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks';
import { BaseCanvas } from './three/BaseCanvas';
import { WormholeScene } from './three/scenes/Wormhole';

const VEIL =
  'radial-gradient(circle at 50% 50%, rgba(5,11,31,0.85) 0%, rgba(2,5,15,0.97) 68%, #02050F 100%)';

export interface WormholeOverlayProps {
  /** Total run time in ms (shader mode; veil-only mode clamps to 440 ms). */
  duration?: number;
  onDone: () => void;
}

export default function WormholeOverlay({ duration = 1500, onDone }: WormholeOverlayProps) {
  const reduced = useReducedMotion();
  const veilOnly = reduced;
  const ms = veilOnly ? 440 : duration;

  const progress = useRef(0);
  const veilRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      progress.current = p;
      if (veilRef.current) {
        const fadeIn = Math.min(1, p / 0.18);
        const fadeOut = 1 - Math.min(1, Math.max(0, (p - 0.72) / 0.28));
        const peak = veilOnly ? 0.8 : 0.95;
        veilRef.current.style.opacity = String(fadeIn * fadeOut * peak);
      }
      if (p >= 1) {
        if (!doneRef.current) {
          doneRef.current = true;
          onDoneRef.current();
        }
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ms, veilOnly]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[90] overflow-hidden"
      data-wormhole="1"
      data-mode={veilOnly ? 'veil' : 'shader'}
      aria-hidden
    >
      <div ref={veilRef} className="absolute inset-0" style={{ opacity: 0, background: VEIL }} />
      {!veilOnly && (
        <div className="absolute inset-0">
          <BaseCanvas
            className="h-full w-full"
            cameraPosition={[0, 0, 10]}
            cameraFov={45}
            effects={{ motion: 0.6, grade: false }}
            fallback={null}
          >
            <Suspense fallback={null}>
              <WormholeScene progress={progress} />
            </Suspense>
          </BaseCanvas>
        </div>
      )}
    </div>
  );
}
