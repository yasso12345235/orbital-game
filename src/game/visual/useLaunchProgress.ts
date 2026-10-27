/**
 * useLaunchProgress — rAF timeline for the launch cinematic. Progress is
 * derived from elapsed time only (never mission state) and onDone fires once.
 * This used to live in the legacy vanilla three module; the v3 visual layer
 * owns it so no screen needs to import `three/scenes`.
 */
import { useEffect, useRef, useState } from 'react';

export function useLaunchProgress(active: boolean, durationS: number, onDone?: () => void) {
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);
  const startRef = useRef<number | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!active) {
      setProgress(0);
      startRef.current = null;
      doneRef.current = false;
      return;
    }
    let raf = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / (durationS * 1000));
      setProgress(p);
      if (p >= 1 && !doneRef.current) {
        doneRef.current = true;
        onDoneRef.current?.();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, durationS]);

  return progress;
}
