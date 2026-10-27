/**
 * LaunchScene — step 7: the R3F launch cinematic. One timeline (progress
 * 0…1, owned by `useLaunchProgress` in the screen) drives the ascent, camera,
 * sky, plume and callouts. The stack height scales with the launcher's real
 * LEO capacity (same sqrt law as the legacy scene) — nothing here invents
 * mission state. The pad/world falls away instead of the rocket flying to the
 * edge of the frustum, which keeps the vehicle framed from T−0 to orbit.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  DoubleSide,
  type GridHelper,
  type Group,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
  type PointLight,
  type PointsMaterial,
  type ShaderMaterial,
} from 'three';
import { lookupTables } from '../../../store';
import { uAccent } from '../../store-adapters/accent';
import { useVisualQuality } from '../quality';
import { Rocket } from '../shapes';
import { syncAccent } from '../shapes/util';
import launchSkyVert from '../shaders/launchSky.vert.glsl?raw';
import launchSkyFrag from '../shaders/launchSky.frag.glsl?raw';

export interface LaunchCallout {
  text: string;
  ar: string;
}

/** Mirrors the legacy callout table (same thresholds, same wording). */
const CALLOUTS: { at: number; text: string; ar: string }[] = [
  { at: 0.02, text: 'TERMINAL COUNT', ar: 'العد التنازلي النهائي' },
  { at: 0.18, text: 'IGNITION', ar: 'الإشعال' },
  { at: 0.32, text: 'TOWER CLEAR', ar: 'تجاوز البرج' },
  { at: 0.58, text: 'MAX-Q', ar: 'أقصى ضغط ديناميكي' },
  { at: 0.74, text: 'STAGE SEPARATION', ar: 'فصل المرحلة' },
  { at: 0.9, text: 'ORBIT INSERTION', ar: 'الوصول للمدار' },
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export interface LaunchSceneProps {
  progress: number;
  launcherId: string;
  /** 0…1 rumble strength from the screen (already reduced-motion aware). */
  shake?: number;
  onCallout?: (c: LaunchCallout) => void;
}

export function LaunchScene({ progress, launcherId, shake = 0, onCallout }: LaunchSceneProps) {
  const q = useVisualQuality();
  const launcher = useMemo(() => lookupTables().launchers[launcherId] ?? null, [launcherId]);
  const capacity = launcher?.capacityToLeoKg ?? 1000;
  // Same monotonic law as the legacy rocket, compressed to stay in frame.
  const stackH = 5.2 + Math.min(3.2, Math.sqrt(capacity) * 0.02);
  const stackR = 0.42 + Math.min(0.24, Math.sqrt(capacity) * 0.0012);

  const progressRef = useRef(progress);
  progressRef.current = progress;
  const shakeRef = useRef(shake);
  shakeRef.current = shake;
  const calloutRef = useRef(onCallout);
  calloutRef.current = onCallout;
  const lastCallout = useRef(-1);

  const rocket = useRef<Group>(null);
  const world = useRef<Group>(null);
  const groundMat = useRef<MeshStandardMaterial>(null);
  const gridRef = useRef<GridHelper>(null);
  const ringMat = useRef<MeshBasicMaterial>(null);
  const starsMat = useRef<PointsMaterial>(null);
  const smokeMat = useRef<PointsMaterial>(null);
  const flameLight = useRef<PointLight>(null);
  const skyMat = useRef<ShaderMaterial>(null);

  const skyUniforms = useMemo(
    () => ({ uProgress: { value: 0 }, uAccent: { value: uAccent.value.clone() } }),
    [],
  );

  const stars = useMemo(() => {
    const n = 1400;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // spherical shell well inside the 60-unit sky dome, outside the action
      const theta = Math.random() * Math.PI * 2;
      const y = Math.random() * 1.6 - 0.6;
      const r = 34 + Math.random() * 14;
      const horiz = Math.sqrt(Math.max(0, 1 - Math.min(1, y * y))) * r;
      arr.set([Math.cos(theta) * horiz, y * r, Math.sin(theta) * horiz], i * 3);
    }
    return arr;
  }, []);

  const smokeGeo = useMemo(() => {
    const n = 240;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.1 + Math.random() * 1.9;
      arr.set([Math.cos(a) * r, 0.2 + Math.random() * 0.9, Math.sin(a) * r], i * 3);
    }
    return arr;
  }, []);

  useFrame((state) => {
    const p = progressRef.current;
    const t = state.clock.elapsedTime;
    const reduced = q.reduced;
    const thrust = p < 0.14 ? 0 : p < 0.68 ? (p < 0.58 ? 1 : 0.88) : 0;
    const fall = smooth(0.16, 1, p);

    // callouts (same one-shot order as the legacy scene)
    for (let i = CALLOUTS.length - 1; i >= 0; i--) {
      if (p >= CALLOUTS[i].at && lastCallout.current < i) {
        lastCallout.current = i;
        calloutRef.current?.(CALLOUTS[i]);
        break;
      }
    }

    // the world (pad + grid + ground) falls away; the vehicle stays framed
    if (world.current) world.current.position.y = -Math.pow(fall, 1.7) * 90;
    if (rocket.current) rocket.current.position.y = 0.34 + stackH * 0.45 + smooth(0.12, 1, p) * 2.2;

    // pad smoke billows at ignition then thins out
    if (smokeMat.current) {
      const puff = smooth(0.1, 0.2, p) * (1 - smooth(0.3, 0.58, p));
      smokeMat.current.opacity = puff * 0.5;
      smokeMat.current.size = 0.4 + smooth(0.1, 0.42, p) * 1.0;
    }

    // ground + grid fade as the camera clears the pad
    const g = 1 - smooth(0.28, 0.56, p);
    if (groundMat.current) groundMat.current.opacity = g;
    const gridMat = gridRef.current?.material;
    if (gridMat) {
      gridMat.transparent = true;
      gridMat.opacity = g * 0.55;
    }

    // stars fade in as the sky turns to space
    if (starsMat.current) starsMat.current.opacity = smooth(0.3, 0.86, p) * 0.9;

    // exhaust light on the pad, then carried by the vehicle
    if (flameLight.current) {
      flameLight.current.intensity =
        thrust * (26 + Math.sin(t * 42) * 7 + (reduced ? 0 : Math.random() * 5)) * (1 - p * 0.5);
      flameLight.current.position.y = (rocket.current?.position.y ?? 0) - stackH * 0.55;
    }

    // aurora accent sync (pad ring + sky tint)
    syncAccent(ringMat.current, 1.1);
    skyUniforms.uAccent.value.copy(uAccent.value);
    if (skyMat.current) skyMat.current.uniforms.uProgress.value = p;

    // camera: slow dolly + rumble (owned here — SceneShell runs controls="none")
    const cam = state.camera;
    const rise = smooth(0.1, 1, p);
    const idle = reduced ? 0 : 1;
    const cx = 8.6 - rise * 4.0 + Math.sin(t * 0.25) * 0.14 * idle;
    const cy = 3.1 + rise * 1.4 + Math.sin(t * 0.31) * 0.1 * idle;
    const cz = 10.8 - rise * 3.3;
    const sh = reduced ? 0 : shakeRef.current;
    cam.position.set(
      cx + (Math.random() - 0.5) * sh * 0.42,
      cy + (Math.random() - 0.5) * sh * 0.42,
      cz + (Math.random() - 0.5) * sh * 0.26,
    );
    cam.lookAt(0, 3.2 + rise * 1.9, 0);
  });

  return (
    <group>
      {/* sky dome — one shader, dawn → space on uProgress */}
      <mesh scale={[60, 60, 60]} renderOrder={-10}>
        <sphereGeometry args={[1, 32, 20]} />
        <shaderMaterial
          ref={skyMat}
          uniforms={skyUniforms}
          vertexShader={launchSkyVert}
          fragmentShader={launchSkyFrag}
          side={BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* stars over the dome (additive, fade in with altitude) */}
      <points renderOrder={-5}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={starsMat}
          size={0.16}
          sizeAttenuation
          transparent
          opacity={0}
          color="#CFD8FF"
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>

      {/* world: pad, mast, ground, grid — falls away after ignition */}
      <group ref={world}>
        <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
          <circleGeometry args={[90, 48]} />
          <meshStandardMaterial ref={groundMat} color="#0A1222" roughness={0.95} metalness={0.05} transparent />
        </mesh>
        <gridHelper ref={gridRef} args={[60, 30, '#1B2A50', '#101A33']} position={[0, 0.02, 0]} />

        {/* launch pad */}
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[2.5, 2.8, 0.32, 48]} />
          <meshStandardMaterial color="#131C33" metalness={0.55} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.335, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[2.02, 2.2, 64]} />
          <meshBasicMaterial ref={ringMat} color="#46C8FF" transparent opacity={0.6} side={DoubleSide} depthWrite={false} />
        </mesh>

        {/* service mast + arms */}
        <mesh position={[-3.15, 3.5, 0]}>
          <boxGeometry args={[0.16, 7, 0.16]} />
          <meshStandardMaterial color="#3A4E78" metalness={0.55} roughness={0.45} />
        </mesh>
        <mesh position={[-2.45, 5.1, 0]}>
          <boxGeometry args={[1.35, 0.1, 0.1]} />
          <meshStandardMaterial color="#4A5F8C" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[-2.45, 6.1, 0]}>
          <boxGeometry args={[1.05, 0.1, 0.1]} />
          <meshStandardMaterial color="#4A5F8C" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[-3.15, 7.05, 0]}>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshBasicMaterial color="#FF4D6A" />
        </mesh>

        {/* ignition smoke ring */}
        <points position-y={0.4}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[smokeGeo, 3]} />
          </bufferGeometry>
          <pointsMaterial
            ref={smokeMat}
            size={0.5}
            sizeAttenuation
            transparent
            opacity={0}
            color="#9FB4D8"
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      </group>

      {/* the stack — real launcher capacity sets its size */}
      <group ref={rocket} position={[0, 0.34 + stackH * 0.45, 0]}>
        <Rocket
          sep={smooth(0.74, 0.8, progress)}
          thrust={progress < 0.14 ? 0 : progress < 0.68 ? (progress < 0.58 ? 1 : 0.88) : 0}
          radius={stackR}
          height={stackH}
          fins={4}
        />
      </group>

      <pointLight ref={flameLight} color="#FFB266" intensity={0} distance={30} decay={2} />

      {/* cool rim + warm fill so the white stack reads white on the dawn sky */}
      <directionalLight position={[-7, 9, -5]} intensity={2.1} color="#A8CDFF" />
      <directionalLight position={[6, 2, 7]} intensity={0.55} color="#FFE4BE" />
    </group>
  );
}
