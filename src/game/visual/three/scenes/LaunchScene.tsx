/**
 * LaunchScene — step 7: the R3F launch cinematic. One timeline (progress
 * 0…1, owned by `useLaunchProgress` in the screen) drives the ascent, camera,
 * sky, plume and callouts. The stack height scales with the launcher's real
 * LEO capacity (same sqrt law as the legacy scene) — nothing here invents
 * mission state. The pad/world falls away instead of the rocket flying to the
 * edge of the frustum, which keeps the vehicle framed from T−0 to orbit.
 */
import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  DoubleSide,
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

const CONCRETE = '#242c3e';
const CONCRETE_DARK = '#151c2b';
const STEEL = '#44587f';
const STEEL_LIGHT = '#93a6c6';
const TANK = '#c9d3e2';
const GOLD = '#e9c37c';

/**
 * A working launch complex instead of an empty disc: apron, flame trench,
 * service tower with crew access arm, propellant farm, water tower, assembly
 * hangar, floodlights, perimeter and a ridge line on the horizon. Everything is
 * built from primitives so it costs no assets and scales with the quality tier.
 */
function LaunchComplex({
  groundMat,
  ringMat,
  low,
}: {
  groundMat: RefObject<MeshStandardMaterial>;
  ringMat: RefObject<MeshBasicMaterial>;
  low: boolean;
}) {
  const towerH = 11.4;
  const levels = low ? 4 : 8;

  return (
    <group>
      {/* regolith / terrain */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <circleGeometry args={[90, 48]} />
        <meshStandardMaterial ref={groundMat} color="#0A1222" roughness={0.95} metalness={0.05} transparent />
      </mesh>

      {/* low rolling ridge line so the horizon is not a flat void */}
      {Array.from({ length: low ? 18 : 34 }, (_, i) => {
        const n = low ? 18 : 34;
        const a = (i / n) * Math.PI * 2 + 0.12;
        const r = 52 + ((i * 7) % 5) * 4;
        const h = 3.4 + ((i * 5) % 7) * 0.8;
        return (
          <mesh key={`ridge-${i}`} position={[Math.cos(a) * r, h * 0.3 - 0.8, Math.sin(a) * r]} scale={[2.8, 1, 2.2]}>
            <sphereGeometry args={[h, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshStandardMaterial color="#232019" roughness={1} metalness={0} flatShading />
          </mesh>
        );
      })}

      {/* concrete apron + expansion joints + work ring */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[14.5, 15, 0.12, 64]} />
        <meshStandardMaterial color={CONCRETE} roughness={0.9} metalness={0.12} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.1}>
        <ringGeometry args={[12.1, 12.5, 96]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.26} side={DoubleSide} depthWrite={false} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={`joint-${i}`} position={[0, 0.1, 0]} rotation-y={(i / 8) * Math.PI}>
          <boxGeometry args={[0.06, 0.02, 29]} />
          <meshBasicMaterial color="#151b29" />
        </mesh>
      ))}
      {/* access road running away from the pad */}
      <mesh position={[7.4, 0.04, 15]} rotation-y={0.32}>
        <boxGeometry args={[6.4, 0.04, 20]} />
        <meshStandardMaterial color="#1a2233" roughness={0.95} />
      </mesh>

      {/* flame trench: dark channel with concrete cheeks and a deflector wedge */}
      <mesh position={[0, 0.11, 6.8]}>
        <boxGeometry args={[3.6, 0.02, 8.8]} />
        <meshBasicMaterial color="#080c15" />
      </mesh>
      {[-2.0, 2.0].map((x) => (
        <group key={`cheek-${x}`}>
          <mesh position={[x, 0.32, 6.8]}>
            <boxGeometry args={[0.34, 0.44, 8.8]} />
            <meshStandardMaterial color={CONCRETE_DARK} roughness={0.85} metalness={0.2} />
          </mesh>
          <mesh position={[x, 0.55, 6.8]}>
            <boxGeometry args={[0.36, 0.05, 8.8]} />
            <meshBasicMaterial color={GOLD} transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.3, 2.9]} rotation-x={-0.42}>
        <boxGeometry args={[3.4, 0.08, 3.2]} />
        <meshStandardMaterial color={STEEL} metalness={0.7} roughness={0.4} />
      </mesh>

      {/* launch mount + hold-down clamps */}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[2.7, 3.0, 0.34, 48]} />
        <meshStandardMaterial color="#131C33" metalness={0.55} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.4, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[2.02, 2.2, 64]} />
        <meshBasicMaterial ref={ringMat} color="#46C8FF" transparent opacity={0.6} side={DoubleSide} depthWrite={false} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={`clamp-${i}`} position={[Math.cos(a) * 1.05, 0.78, Math.sin(a) * 1.05]} rotation-y={-a}>
            <boxGeometry args={[0.26, 0.6, 0.34]} />
            <meshStandardMaterial color={STEEL_LIGHT} metalness={0.8} roughness={0.32} />
          </mesh>
        );
      })}

      {/* service tower: four legs, working platforms, elevator core, crew arm */}
      <group position={[-5.0, 0, -0.7]}>
        {[[-0.68, -0.68], [0.68, -0.68], [-0.68, 0.68], [0.68, 0.68]].map(([x, z], i) => (
          <mesh key={`leg-${i}`} position={[x, towerH / 2, z]}>
            <boxGeometry args={[0.15, towerH, 0.15]} />
            <meshStandardMaterial color={STEEL} metalness={0.72} roughness={0.38} />
          </mesh>
        ))}
        {Array.from({ length: levels }, (_, i) => {
          const y = 1.4 + i * ((towerH - 1.8) / (levels - 1));
          return (
            <group key={`lvl-${i}`}>
              <mesh position={[0, y, 0]}>
                <boxGeometry args={[1.62, 0.07, 1.62]} />
                <meshStandardMaterial color="#2a3a55" />
              </mesh>
              {!low && (
                <>
                  <mesh position={[0, y + 0.62, 0.69]} rotation-z={0.62}>
                    <boxGeometry args={[2.0, 0.05, 0.05]} />
                    <meshBasicMaterial color="#5b6f96" />
                  </mesh>
                  <mesh position={[0, y + 0.62, -0.69]} rotation-z={-0.62}>
                    <boxGeometry args={[2.0, 0.05, 0.05]} />
                    <meshBasicMaterial color="#5b6f96" />
                  </mesh>
                </>
              )}
            </group>
          );
        })}
        <mesh position={[0.26, towerH / 2, 0.26]}>
          <boxGeometry args={[0.48, towerH * 0.9, 0.48]} />
          <meshStandardMaterial color="#364a6e" metalness={0.55} roughness={0.45} />
        </mesh>
        {/* crew access arm reaching the vehicle */}
        <mesh position={[2.45, 5.4, 0]}>
          <boxGeometry args={[4.2, 0.16, 0.72]} />
          <meshStandardMaterial color={STEEL_LIGHT} metalness={0.65} roughness={0.4} />
        </mesh>
        <mesh position={[2.45, 4.92, 0.4]}>
          <boxGeometry args={[4.0, 0.05, 0.05]} />
          <meshBasicMaterial color={GOLD} />
        </mesh>
        {/* hammerhead crane + aircraft beacon */}
        <mesh position={[0.5, towerH + 0.15, 0]} rotation-z={-0.16}>
          <boxGeometry args={[2.6, 0.12, 0.12]} />
          <meshStandardMaterial color={STEEL_LIGHT} metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[1.75, towerH - 0.25, 0]}>
          <boxGeometry args={[0.06, 0.7, 0.06]} />
          <meshBasicMaterial color="#5b6f96" />
        </mesh>
        <mesh position={[0, towerH + 0.32, 0]}>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshBasicMaterial color="#ff4d6a" />
        </mesh>
        <pointLight position={[0, 7.2, 0]} color="#ffd9a0" intensity={5} distance={9} decay={2} />
      </group>

      {/* propellant farm: two spheres with legs and feed lines */}
      {[[-10.4, -3.0], [-8.8, -7.4]].map(([x, z], i) => (
        <group key={`tank-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 1.6, 0]}>
            <sphereGeometry args={[1.15, 20, 16]} />
            <meshStandardMaterial color={TANK} metalness={0.38} roughness={0.42} />
          </mesh>
          {[[-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72]].map(([lx, lz], j) => (
            <mesh key={j} position={[lx, 0.55, lz]}>
              <boxGeometry args={[0.09, 1.1, 0.09]} />
              <meshStandardMaterial color={STEEL} metalness={0.7} roughness={0.4} />
            </mesh>
          ))}
          <mesh position={[0, 2.78, 0]}>
            <sphereGeometry args={[0.11, 8, 8]} />
            <meshBasicMaterial color={GOLD} />
          </mesh>
        </group>
      ))}
      <mesh position={[-6.2, 0.2, -4.4]} rotation-y={0.58}>
        <boxGeometry args={[0.16, 0.16, 9.4]} />
        <meshStandardMaterial color={STEEL} metalness={0.7} roughness={0.4} />
      </mesh>

      {/* water tower for the sound-suppression deluge */}
      <group position={[-15.0, 0, -3.5]}>
        {[[-1.05, -1.05], [1.05, -1.05], [-1.05, 1.05], [1.05, 1.05]].map(([x, z], i) => (
          <mesh key={`wt-leg-${i}`} position={[x, 2.85, z]} rotation-z={x * 0.04} rotation-x={z * 0.04}>
            <boxGeometry args={[0.13, 5.7, 0.13]} />
            <meshStandardMaterial color={STEEL} metalness={0.7} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 6.4, 0]}>
          <cylinderGeometry args={[1.75, 1.75, 1.9, 24]} />
          <meshStandardMaterial color={TANK} metalness={0.3} roughness={0.5} />
        </mesh>
        <mesh position={[0, 7.35, 0]} scale={[1, 0.42, 1]}>
          <sphereGeometry args={[1.75, 24, 12]} />
          <meshStandardMaterial color={TANK} metalness={0.3} roughness={0.5} />
        </mesh>
        <mesh position={[0, 8.02, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color="#ff4d6a" />
        </mesh>
      </group>

      {/* assembly hangar at the edge of the apron */}
      <group position={[16.0, 0, -17.5]} rotation-y={-0.32}>
        <mesh position={[0, 1.95, 0]}>
          <boxGeometry args={[6.6, 3.9, 5.8]} />
          <meshStandardMaterial color="#2b3446" roughness={0.85} metalness={0.25} />
        </mesh>
        <mesh position={[0, 4.02, 0]}>
          <boxGeometry args={[7.0, 0.28, 6.2]} />
          <meshStandardMaterial color={STEEL} metalness={0.6} roughness={0.42} />
        </mesh>
        <mesh position={[0, 1.55, 2.92]}>
          <boxGeometry args={[4.7, 2.9, 0.12]} />
          <meshStandardMaterial color="#0d1421" metalness={0.3} roughness={0.7} />
        </mesh>
        <mesh position={[0, 3.18, 2.95]}>
          <boxGeometry args={[5.0, 0.14, 0.16]} />
          <meshBasicMaterial color={GOLD} />
        </mesh>
        <mesh position={[0, 3.1, -2.9]}>
          <boxGeometry args={[5.2, 0.9, 0.06]} />
          <meshBasicMaterial color="#1a2438" />
        </mesh>
      </group>

      {/* floodlight masts around the pad */}
      {[[-9.4, 4.6], [9.4, 4.2], [-11.0, -4.4], [10.6, -5.2]].map(([x, z], i) => {
        const yaw = Math.atan2(-z, -x);
        return (
          <group key={`flood-${i}`} position={[x, 0, z]}>
            <mesh position={[0, 3.7, 0]}>
              <boxGeometry args={[0.13, 7.4, 0.13]} />
              <meshStandardMaterial color={STEEL} metalness={0.7} roughness={0.4} />
            </mesh>
            <mesh position={[Math.cos(yaw) * 0.35, 7.5, Math.sin(yaw) * 0.35]} rotation-y={yaw}>
              <boxGeometry args={[1.15, 0.34, 0.26]} />
              <meshStandardMaterial color="#1b2434" emissive="#ffe9c4" emissiveIntensity={0.75} />
            </mesh>
          </group>
        );
      })}

      {/* perimeter fence posts + a faint safety ring */}
      {Array.from({ length: low ? 10 : 18 }, (_, i) => {
        const a = (i / (low ? 10 : 18)) * Math.PI * 2;
        return (
          <mesh key={`fence-${i}`} position={[Math.cos(a) * 21.5, 0.55, Math.sin(a) * 21.5]}>
            <boxGeometry args={[0.08, 1.1, 0.08]} />
            <meshBasicMaterial color="#3d4d6b" />
          </mesh>
        );
      })}
      <mesh rotation-x={-Math.PI / 2} position-y={0.62}>
        <ringGeometry args={[21.45, 21.55, 96]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.12} side={DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
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

    // ground fades as the camera clears the pad
    const g = 1 - smooth(0.28, 0.56, p);
    if (groundMat.current) groundMat.current.opacity = g;

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

      {/* world: the launch complex falls away after ignition */}
      <group ref={world}>
        <LaunchComplex groundMat={groundMat} ringMat={ringMat} low={q.tier === 'low'} />

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
