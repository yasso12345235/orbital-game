/**
 * HomeScene — the v3 Home hero (step 3): a slow planetary limb over a deep
 * starfield, the spacecraft kit on a flyby, and occasional meteors.
 *
 * Read-only contract: the only game state it touches is the peek target
 * (surface texture) and the shared uAccent (atmosphere/rims) — the visuals
 * mirror the store/UI state and never invent their own physics.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  CanvasTexture,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
} from 'three';
import { Planet, SpacecraftKit, OrbitRing } from '../shapes';
import { mulberry32 } from '../shapes/util';
import { useVisualQuality } from '../quality';
import { WORLD } from '../../theme/tokens';

const EARTHLIKE = new Set(['earth', 'leo', 'gto', 'geo']);
const PLANET_R = 30;

/* ------------------------------------------------------------------ */
/* Deep starfield — constant-pixel points on a wide shell              */
/* ------------------------------------------------------------------ */
function Starfield({ count = 900 }: { count?: number }) {
  const q = useVisualQuality();
  const n = Math.max(180, Math.min(count, Math.round(q.particles * 0.08)));

  const positions = useMemo(() => {
    const rnd = mulberry32(7);
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = rnd() * Math.PI * 2;
      const ph = Math.acos(rnd() * 2 - 1);
      const r = 95 + rnd() * 60;
      arr[i * 3] = Math.sin(ph) * Math.cos(th) * r;
      arr[i * 3 + 1] = Math.cos(ph) * r;
      arr[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    }
    return arr;
  }, [n]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={2.2}
        sizeAttenuation={false}
        transparent
        opacity={0.75}
        color={WORLD.starCool}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/* Meteor streaks — soft additive quads on a simple spawn schedule     */
/* ------------------------------------------------------------------ */
function streakTexture(): CanvasTexture {
  const w = 256;
  const h = 32;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const v = ctx.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.5, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  const tex = new CanvasTexture(cv);
  return tex;
}

function Meteors({ count = 2 }: { count?: number }) {
  const q = useVisualQuality();
  const tex = useMemo(streakTexture, []);
  useEffect(() => () => tex.dispose(), [tex]);

  const groups = useRef<(Group | null)[]>([]);
  const mats = useRef<(MeshBasicMaterial | null)[]>([]);
  const plan = useMemo(() => {
    const rnd = mulberry32(42);
    return Array.from({ length: count }, (_, i) => ({
      wait: 2.5 + i * 3.5 + rnd() * 4,
      period: 7 + rnd() * 5,
      y0: 16 + rnd() * 22,
      dir: rnd() > 0.5 ? 1 : -1,
      speed: 85 + rnd() * 60,
    }));
  }, [count]);
  const live = useRef(plan.map((m) => ({ active: false, s: 0, wait: m.wait, x0: 0, y0: m.y0, z: -30 })));

  useFrame((_, dt) => {
    if (q.reduced) return;
    const d = Math.min(dt, 0.05);
    plan.forEach((m, i) => {
      const st = live.current[i];
      const g = groups.current[i];
      const mat = mats.current[i];
      if (!g || !mat) return;
      if (!st.active) {
        mat.opacity = 0;
        st.wait -= d;
        if (st.wait <= 0) {
          st.active = true;
          st.s = 0;
          st.x0 = -m.dir * 95;
          st.y0 = m.y0;
          st.z = -30 - Math.random() * 30;
        }
        return;
      }
      st.s += (d * m.speed) / 120;
      if (st.s >= 1) {
        st.active = false;
        st.wait = m.period;
        mat.opacity = 0;
        return;
      }
      g.position.set(st.x0 + st.s * 120 * m.dir, st.y0 - st.s * 34, st.z);
      g.rotation.z = m.dir > 0 ? -0.28 : 0.28;
      mat.opacity = Math.sin(Math.PI * st.s) * 0.8;
    });
  });

  if (q.reduced) return null;
  return (
    <>
      {plan.map((_, i) => (
        <group key={i} ref={(el) => { groups.current[i] = el; }}>
          <mesh>
            <planeGeometry args={[20, 0.5]} />
            <meshBasicMaterial
              ref={(el) => { mats.current[i] = el; }}
              map={tex}
              color="#DCEBFF"
              transparent
              opacity={0}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Spacecraft flyby — the shared kit crossing above the limb           */
/* ------------------------------------------------------------------ */
function FlyBy() {
  const q = useVisualQuality();
  const pivot = useRef<Group>(null);
  const angle = useRef(Math.PI * 0.3);

  useFrame((_, dt) => {
    const g = pivot.current;
    if (!g) return;
    if (!q.reduced) angle.current += dt * 0.14;
    const a = angle.current;
    g.position.set(
      Math.cos(a) * (PLANET_R + 5),
      6 + Math.sin(a) * 8,
      Math.sin(a) * (PLANET_R + 5),
    );
    g.rotation.y = a;
  });

  return (
    <group rotation={[0, 0, 0.4]}>
      <group ref={pivot}>
        <group scale={1.7} rotation={[0.15, 0, 0]}>
          <SpacecraftKit unfold={1} rtg={0} thrust={0.5} spin={0.9} />
        </group>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Distant sun — a narrow flare that lifts the whole frame             */
/* ------------------------------------------------------------------ */
function sunTexture(): CanvasTexture {
  const s = 256;
  const cv = document.createElement('canvas');
  cv.width = s;
  cv.height = s;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.08, 'rgba(255,246,220,0.95)');
  g.addColorStop(0.2, 'rgba(255,214,150,0.5)');
  g.addColorStop(0.45, 'rgba(255,180,110,0.14)');
  g.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new CanvasTexture(cv);
}

function SunFlare() {
  const q = useVisualQuality();
  const tex = useMemo(sunTexture, []);
  useEffect(() => () => tex.dispose(), [tex]);
  const halo = useRef<Mesh>(null);

  useFrame((state) => {
    const m = halo.current?.material as MeshBasicMaterial | undefined;
    if (!m || q.reduced) return;
    m.opacity = 0.72 + Math.sin(state.clock.elapsedTime * 0.55) * 0.07;
  });

  return (
    <group position={[48, 30, -74]}>
      <mesh ref={halo}>
        <planeGeometry args={[92, 92]} />
        <meshBasicMaterial map={tex} transparent opacity={0.72} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      {/* Anamorphic streak */}
      <mesh rotation={[0, 0, -0.22]}>
        <planeGeometry args={[70, 0.7]} />
        <meshBasicMaterial color="#ffe6bb" transparent opacity={0.18} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */
export interface HomeSceneProps {
  /** Peek target — drives the surface texture (UI state, not physics). */
  target?: string;
}

export function HomeScene({ target = 'earth' }: HomeSceneProps) {
  return (
    <>
      <Starfield />
      <SunFlare />
      <group position={[0, -PLANET_R - 2.4, 0]} rotation={[0, 0, 0.3]}>
        <Planet
          target={target}
          radius={PLANET_R}
          spin={1.6}
          cloud={EARTHLIKE.has(target) ? 0.8 : 0}
          atmosphere={2.2}
        />
        {/* ORBITAL signature: one thin accent orbit ring hugging the limb. */}
        <OrbitRing radius={PLANET_R * 1.16} tilt={-16} speed={0.32} dashes={64} satellites={2} />
      </group>
      <FlyBy />
      <Meteors />
    </>
  );
}
