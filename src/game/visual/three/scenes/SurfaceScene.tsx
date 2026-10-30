/**
 * SurfaceScene — the planetary expedition in 3D.
 *
 * A low-poly terrain per planet, a lander turned base camp, buildable modules,
 * resource deposits and a fully articulated astronaut the player drives with
 * WASD / arrows / the on-screen pad. All simulation values come from the store;
 * this file only visualises them and reports position + nearby deposits.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  type DirectionalLight,
  type Group,
  type InstancedMesh,
  type Mesh,
  type PointsMaterial,
} from 'three';
import { useVisualQuality } from '../quality';
import {
  daylight,
  moduleSlotPosition,
  suitEffects,
  type SurfaceNode,
  type SurfaceState,
} from '../../../surface/engine';
import { BASE_RADIUS, MODULES, RESOURCES, ROVER_SPEED_BONUS, WALK_SPEED, type SurfaceProfile } from '../../../surface/model';

export interface SurfaceInput {
  forward: number;
  back: number;
  left: number;
  right: number;
  run: boolean;
}

export interface SurfaceSceneProps {
  surface: SurfaceState;
  profile: SurfaceProfile;
  nodes: SurfaceNode[];
  input: { current: SurfaceInput };
  onPose: (x: number, z: number) => void;
  onNear: (node: SurfaceNode | null) => void;
}

/** Deterministic rolling terrain; also used to plant feet and props. */
export function terrainHeight(x: number, z: number): number {
  const a = Math.sin(x * 0.055) * Math.cos(z * 0.061) * 2.1;
  const b = Math.sin(x * 0.14 + z * 0.1) * 0.85;
  const c = Math.cos(z * 0.21 - x * 0.05) * 0.45;
  return a + b + c;
}

function useTerrainGeometry(profile: SurfaceProfile) {
  return useMemo(() => {
    const geo = new PlaneGeometry(420, 420, 96, 96);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const base = new Color(profile.ground);
    const alt = new Color(profile.groundAlt);
    const col = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = terrainHeight(x, z);
      pos.setY(i, y);
      const t = Math.min(1, Math.max(0, (y + 3) / 6));
      col.copy(base).lerp(alt, t);
      // fine-grained patchiness so the low-poly ground is not a flat wash
      const patch = 0.92 + 0.08 * Math.sin(x * 1.7 + z * 2.3) * Math.cos(x * 0.6 - z * 1.1);
      colors[i * 3] = col.r * patch;
      colors[i * 3 + 1] = col.g * patch;
      colors[i * 3 + 2] = col.b * patch;
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [profile.ground, profile.groundAlt]);
}

function starField(radiusMin: number, radiusMax: number, count: number): BufferGeometry {
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radiusMin + Math.random() * (radiusMax - radiusMin);
    arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    arr[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 12;
    arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(arr, 3));
  return geo;
}

/* ------------------------------------------------------------------ astronaut */

/** Soft radial blob so the walker and the lander sit on the regolith. */
function useSoftShadow() {
  return useMemo(() => {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.6)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.32)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, []);
}

function SoftShadow({ size = 1.6, opacity = 0.8 }: { size?: number; opacity?: number }) {
  const tex = useSoftShadow();
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.04} renderOrder={1}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

interface AstronautProps extends SurfaceSceneProps {
  pose: { current: { x: number; z: number; heading: number } };
}

function Astronaut({ surface, input, onPose, onNear, nodes, pose }: AstronautProps) {
  const q = useVisualQuality();
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  const legL = useRef<Mesh>(null);
  const legR = useRef<Mesh>(null);
  const armL = useRef<Mesh>(null);
  const armR = useRef<Mesh>(null);
  const lamp = useRef<MeshStandardMaterial>(null);

  const speed = WALK_SPEED * suitEffects(surface).speed * (surface.roverUnlocked ? 1 + ROVER_SPEED_BONUS : 1);
  const phase = useRef(0);
  const moving = useRef(0);
  const lastSync = useRef(0);
  const lastNear = useRef<number | null>(null);

  useEffect(() => {
    pose.current.x = surface.x;
    pose.current.z = surface.z;
    if (group.current) group.current.position.set(surface.x, terrainHeight(surface.x, surface.z), surface.z);
    // Deliberately once per mount: the store position seeds the walker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, dt) => {
    const p = pose.current;
    const i = input.current;
    let dx = (i.right ? 1 : 0) - (i.left ? 1 : 0);
    let dz = (i.back ? 1 : 0) - (i.forward ? 1 : 0);
    const len = Math.hypot(dx, dz);
    const isMoving = len > 0 ? 1 : 0;
    const sprint = i.run ? 1.65 : 1;
    if (isMoving) {
      dx /= len;
      dz /= len;
      const step = speed * sprint * dt;
      p.x += dx * step;
      p.z += dz * step;
      const dist = Math.hypot(p.x, p.z);
      if (dist > 90) {
        p.x = (p.x / dist) * 90;
        p.z = (p.z / dist) * 90;
      }
      p.heading = Math.atan2(dx, dz);
    }
    moving.current += (isMoving - moving.current) * Math.min(1, dt * 8);

    const y = terrainHeight(p.x, p.z);
    if (group.current) {
      group.current.position.set(p.x, y, p.z);
      group.current.rotation.y = p.heading;
    }

    if (!q.reduced && isMoving) phase.current += dt * (sprint > 1.2 ? 11 : 7);
    const swing = q.reduced ? 0 : Math.sin(phase.current) * 0.55 * moving.current;
    const bob = q.reduced ? 0 : Math.abs(Math.sin(phase.current)) * 0.07 * moving.current;
    if (body.current) body.current.position.y = bob;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.8;
    if (armR.current) armR.current.rotation.x = swing * 0.8;
    if (lamp.current) lamp.current.emissiveIntensity = 1.2 + Math.sin(state.clock.elapsedTime * 2.2) * 0.2;

    const now = state.clock.elapsedTime;
    if (now - lastSync.current > 0.5) {
      lastSync.current = now;
      onPose(p.x, p.z);
    }

    let best: SurfaceNode | null = null;
    let bestD = 3.2;
    for (const n of nodes) {
      if (surface.taken.includes(n.id)) continue;
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    const id = best?.id ?? null;
    if (id !== lastNear.current) {
      lastNear.current = id;
      onNear(best);
    }
  });

  return (
    <group ref={group}>
      <SoftShadow size={1.55} opacity={0.6} />
      <group ref={body}>
        <mesh ref={legL} position={[0.22, 0.42, 0]}>
          <capsuleGeometry args={[0.11, 0.42, 4, 8]} />
          <meshStandardMaterial color="#2b3446" roughness={0.7} metalness={0.3} />
        </mesh>
        <mesh ref={legR} position={[-0.22, 0.42, 0]}>
          <capsuleGeometry args={[0.11, 0.42, 4, 8]} />
          <meshStandardMaterial color="#2b3446" roughness={0.7} metalness={0.3} />
        </mesh>

        <mesh position={[0, 1.08, 0]}>
          <capsuleGeometry args={[0.34, 0.7, 6, 12]} />
          <meshStandardMaterial color={surface.suitColor} roughness={0.45} metalness={0.25} />
        </mesh>
        <mesh position={[0, 1.12, 0.31]}>
          <boxGeometry args={[0.34, 0.26, 0.08]} />
          <meshStandardMaterial color="#0b1020" emissive="#7fd8ff" emissiveIntensity={0.55} roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.16, -0.32]}>
          <boxGeometry args={[0.52, 0.6, 0.24]} />
          <meshStandardMaterial color="#cfd6e4" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0.14, 1.16, -0.46]}>
          <boxGeometry args={[0.16, 0.16, 0.05]} />
          <meshStandardMaterial ref={lamp} color="#1a2436" emissive="#7fd8ff" emissiveIntensity={1.2} />
        </mesh>

        <mesh ref={armL} position={[0.42, 1.16, 0]}>
          <capsuleGeometry args={[0.1, 0.5, 4, 8]} />
          <meshStandardMaterial color={surface.suitColor} roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh ref={armR} position={[-0.42, 1.16, 0]}>
          <capsuleGeometry args={[0.1, 0.5, 4, 8]} />
          <meshStandardMaterial color={surface.suitColor} roughness={0.5} metalness={0.2} />
        </mesh>

        <mesh position={[0, 1.66, 0]}>
          <sphereGeometry args={[0.29, 20, 16]} />
          <meshStandardMaterial color="#f2f5fb" roughness={0.22} metalness={0.55} />
        </mesh>
        <mesh position={[0, 1.64, 0.21]} rotation={[0.1, 0, 0]}>
          <sphereGeometry args={[0.2, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshStandardMaterial
            color="#120e06"
            emissive="#e9c37c"
            emissiveIntensity={0.65}
            metalness={0.9}
            roughness={0.12}
            side={DoubleSide}
          />
        </mesh>
        <mesh position={[0, 1.86, 0.16]}>
          <boxGeometry args={[0.16, 0.06, 0.06]} />
          <meshStandardMaterial color="#1b2230" emissive="#ffe9c4" emissiveIntensity={1.4} />
        </mesh>
      </group>

      <mesh rotation-x={-Math.PI / 2} position-y={0.05}>
        <ringGeometry args={[0.55, 0.72, 32]} />
        <meshBasicMaterial color={surface.suitColor} transparent opacity={0.28} side={DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* --------------------------------------------------------------------- base */

function Lander({ profile }: { profile: SurfaceProfile }) {
  const beacon = useRef<MeshStandardMaterial>(null);
  useFrame((s) => {
    if (beacon.current) beacon.current.emissiveIntensity = 1.4 + Math.sin(s.clock.elapsedTime * 2.4) * 1.1;
  });
  return (
    <group position={[0, terrainHeight(0, 0), 0]}>
      <SoftShadow size={4.2} opacity={0.55} />
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[1.5, 1.7, 1.1, 20]} />
        <meshStandardMaterial color="#2a3244" roughness={0.6} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.55, 0.85, 0.5, 18]} />
        <meshStandardMaterial color="#151b27" roughness={0.5} metalness={0.6} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <group key={i} rotation-y={a}>
            <mesh position={[1.15, 0.55, 0]} rotation-z={0.55}>
              <cylinderGeometry args={[0.06, 0.06, 1.6, 6]} />
              <meshStandardMaterial color="#8d99ad" metalness={0.7} roughness={0.35} />
            </mesh>
            <mesh position={[1.85, 0.08, 0]}>
              <cylinderGeometry args={[0.34, 0.42, 0.12, 12]} />
              <meshStandardMaterial color="#6d7688" metalness={0.6} roughness={0.5} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, 1.62, 0]}>
        <capsuleGeometry args={[0.95, 0.9, 8, 20]} />
        <meshStandardMaterial color="#d8dde8" roughness={0.35} metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.66, 0.86]} rotation-x={Math.PI / 2}>
        <circleGeometry args={[0.26, 18]} />
        <meshStandardMaterial color="#0a1220" emissive={profile.sun} emissiveIntensity={0.5} metalness={0.9} roughness={0.15} />
      </mesh>
      <mesh position={[0.7, 2.5, -0.2]} rotation-z={0.3}>
        <cylinderGeometry args={[0.03, 0.03, 1.1, 5]} />
        <meshStandardMaterial color="#b9c2d2" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0.78, 3.02, -0.2]} rotation={[0.5, 0, 0.3]}>
        <sphereGeometry args={[0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
        <meshStandardMaterial color="#e9edf5" metalness={0.5} roughness={0.4} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 2.32, 0]}>
        <sphereGeometry args={[0.11, 10, 8]} />
        <meshStandardMaterial ref={beacon} color="#2a0c0c" emissive="#ff4d6a" emissiveIntensity={1.4} />
      </mesh>
      <pointLight position={[0, 2.6, 0]} color="#ffd9a0" intensity={22} distance={24} decay={2} />
      <pointLight position={[0, 0.9, 1.8]} color="#7fd8ff" intensity={8} distance={12} decay={2} />
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <ringGeometry args={[BASE_RADIUS - 0.14, BASE_RADIUS, 96]} />
        <meshBasicMaterial color="#e9c37c" transparent opacity={0.22} side={DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function BuiltModule({ kind, slot }: { kind: string; slot: number }) {
  const p = moduleSlotPosition(slot);
  const def = MODULES.find((m) => m.id === kind);
  const color = def?.color ?? '#7fd8ff';
  const y = terrainHeight(p.x, p.z);
  return (
    <group position={[p.x, y, p.z]}>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[1.9, 1.1, 1.5]} />
        <meshStandardMaterial color="#222b3c" roughness={0.55} metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.18, 0]}>
        <boxGeometry args={[1.7, 0.12, 1.3]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0.6, 1.65, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.9, 6]} />
        <meshStandardMaterial color="#9aa6b8" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0.6, 2.14, 0]}>
        <sphereGeometry args={[0.13, 10, 8]} />
        <meshStandardMaterial color="#101724" emissive={color} emissiveIntensity={1.3} />
      </mesh>
      <pointLight position={[0, 1.2, 0]} color={color} intensity={5} distance={8} decay={2} />
    </group>
  );
}

function ResourceDeposit({ node, taken, scout }: { node: SurfaceNode; taken: boolean; scout?: boolean }) {
  const q = useVisualQuality();
  const group = useRef<Group>(null);
  const color = RESOURCES.find((r) => r.id === node.kind)?.color ?? '#7fd8ff';
  const y = terrainHeight(node.x, node.z);
  const phase = useMemo(() => (node.id * 1.37) % (Math.PI * 2), [node.id]);

  useFrame((s) => {
    if (q.reduced || !group.current) return;
    group.current.rotation.y = s.clock.elapsedTime * 0.5 + phase;
    const pulse = 1 + Math.sin(s.clock.elapsedTime * 1.8 + phase) * 0.05;
    group.current.scale.setScalar(node.scale * pulse);
  });

  if (taken) return null;
  return (
    <group ref={group} position={[node.x, y + 0.66 * node.scale, node.z]} scale={node.scale}>
      <mesh>
        <octahedronGeometry args={[0.66, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.42}
          metalness={0.35}
          roughness={0.28}
          flatShading
        />
      </mesh>
      {/* vertical survey beam so a deposit reads from across the basin */}
      <mesh position-y={2.3}>
        <cylinderGeometry args={[0.045, 0.08, 4.6, 8, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.6}>
        <ringGeometry args={[0.85, 1.15, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} side={DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight color={color} intensity={2.2} distance={7} decay={2} />
      {scout && (
        <group>
          {/* scout drone marker: tall gold beacon visible across the basin */}
          <mesh position-y={9}>
            <cylinderGeometry args={[0.075, 0.13, 18, 10, 1, true]} />
            <meshBasicMaterial
              color="#f5c451"
              transparent
              opacity={0.55}
              side={DoubleSide}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position-y={-0.58}>
            <ringGeometry args={[1.6, 2.0, 42]} />
            <meshBasicMaterial color="#f5c451" transparent opacity={0.6} side={DoubleSide} depthWrite={false} />
          </mesh>
          <mesh position-y={17.5}>
            <octahedronGeometry args={[0.42, 0]} />
            <meshBasicMaterial color="#f5c451" transparent opacity={0.85} />
          </mesh>
        </group>
      )}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[Math.cos(i * 2.1) * 0.95, -0.32, Math.sin(i * 2.1) * 0.95]} rotation-y={i}>
          <tetrahedronGeometry args={[0.24, 0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------------- sky */

function SkyAndLight({ profile, hours }: { profile: SurfaceProfile; hours: number }) {
  const { scene } = useThree();
  const sun = useRef<DirectionalLight>(null);
  const stars = useRef<PointsMaterial>(null);
  const day = daylight(profile, hours);
  const sky = useMemo(() => new Color(), []);
  const starsGeo = useMemo(() => starField(190, 230, 900), []);
  const dayColor = useMemo(() => new Color(profile.skyDay), [profile.skyDay]);
  const nightColor = useMemo(() => new Color(profile.skyNight), [profile.skyNight]);

  useEffect(() => {
    scene.fog = new Fog(profile.skyNight, 60, 210);
    return () => {
      scene.fog = null;
    };
  }, [scene, profile.skyNight]);

  useFrame(() => {
    sky.copy(nightColor).lerp(dayColor, day);
    scene.background = sky;
    if (scene.fog) scene.fog.color.copy(sky);
    if (sun.current) {
      const ang = ((profile.startHour + hours) / 24) * Math.PI * 2;
      sun.current.position.set(Math.cos(ang) * 90, Math.max(4, Math.sin(ang) * 80), Math.sin(ang) * 60);
      sun.current.intensity = 0.25 + day * 1.9;
    }
    if (stars.current) stars.current.opacity = (1 - day) * 0.9;
  });

  return (
    <>
      <ambientLight intensity={0.26 + day * 0.3} color="#cfe0ff" />
      <hemisphereLight args={[profile.sun, profile.groundAlt, 0.22 + day * 0.28]} />
      <directionalLight ref={sun} color={profile.sun} intensity={1.25 + day * 0.6} />
      <points>
        <primitive object={starsGeo} attach="geometry" />
        <pointsMaterial ref={stars} size={1.1} sizeAttenuation color="#dbe9ff" transparent opacity={0.6} depthWrite={false} />
      </points>
    </>
  );
}

/* ------------------------------------------------------------------ horizon */

/** Two rings of ridges: a near silhouette and a distant, hazier one. */
const RIDGES = Array.from({ length: 34 }, (_, i) => {
  const a = (i / 34) * Math.PI * 2 + 0.08;
  return {
    a,
    r: 118 + ((i * 5) % 11),
    h: 6 + ((i * 7) % 12) * 0.75,
    w: 13 + ((i * 3) % 6) * 2.0,
  };
});

const FAR_RIDGES = Array.from({ length: 24 }, (_, i) => {
  const a = (i / 24) * Math.PI * 2 + 0.31;
  return {
    a,
    r: 168 + ((i * 7) % 15),
    h: 15 + ((i * 5) % 9) * 1.6,
    w: 26 + ((i * 5) % 7) * 3.6,
  };
});

function Horizon({ profile, hours }: { profile: SurfaceProfile; hours: number }) {
  const day = daylight(profile, hours);
  const nearColor = useMemo(() => new Color(profile.groundAlt).multiplyScalar(0.78), [profile.groundAlt]);
  const farColor = useMemo(() => new Color(profile.groundAlt).multiplyScalar(0.6), [profile.groundAlt]);
  // The disc tracks the directional light so the shadows always agree with it.
  const ang = ((profile.startHour + hours) / 24) * Math.PI * 2;
  const sunY = Math.max(10, Math.sin(ang) * 170);

  return (
    <group>
      {RIDGES.map((r, i) => {
        const x = Math.cos(r.a) * r.r;
        const z = Math.sin(r.a) * r.r;
        return (
          <mesh
            key={`ridge-${i}`}
            position={[x, terrainHeight(x, z) + r.h * 0.42 - 2.4, z]}
            rotation-y={-r.a}
          >
            <coneGeometry args={[r.w, r.h, 5]} />
            <meshStandardMaterial color={nearColor} roughness={1} metalness={0} flatShading />
          </mesh>
        );
      })}
      {FAR_RIDGES.map((r, i) => (
        <mesh
          key={`far-ridge-${i}`}
          position={[Math.cos(r.a) * r.r, r.h * 0.42 - 3, Math.sin(r.a) * r.r]}
          rotation-y={-r.a}
        >
          <coneGeometry args={[r.w, r.h, 5]} />
          <meshStandardMaterial color={farColor} roughness={1} metalness={0} flatShading />
        </mesh>
      ))}

      {/* sun / moon disc, unaffected by fog so it stays a clean point of scale */}
      <group position={[Math.cos(ang) * 200, sunY, Math.sin(ang) * 135]}>
        <mesh>
          <sphereGeometry args={[9, 20, 16]} />
          <meshBasicMaterial
            color={profile.sun}
            transparent
            opacity={0.25 + day * 0.75}
            fog={false}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[23, 18, 14]} />
          <meshBasicMaterial
            color={profile.sun}
            transparent
            opacity={0.05 + day * 0.12}
            blending={AdditiveBlending}
            depthWrite={false}
            fog={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

function Rocks({ profile, seed }: { profile: SurfaceProfile; seed: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new IcosahedronGeometry(0.55, 0), []);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: profile.groundAlt,
        roughness: 0.95,
        metalness: 0.05,
        flatShading: true,
      }),
    [profile.groundAlt],
  );
  const rocks = useMemo(() => {
    let a = seed >>> 0;
    const rand = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const out: { x: number; z: number; s: number; r: number }[] = [];
    for (let i = 0; i < 140; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = 6 + Math.pow(rand(), 0.6) * 120;
      out.push({ x: Math.cos(ang) * rad, z: Math.sin(ang) * rad, s: 0.2 + rand() * 1.35, r: rand() * Math.PI });
    }
    return out;
  }, [seed]);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const dummy = new Object3D();
    rocks.forEach((r, i) => {
      dummy.position.set(r.x, terrainHeight(r.x, r.z) + r.s * 0.25, r.z);
      dummy.rotation.set(0, r.r, 0);
      dummy.scale.set(r.s, r.s * 0.75, r.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.count = rocks.length;
  }, [rocks]);

  return <instancedMesh ref={mesh} args={[geometry, material, rocks.length]} />;
}

/* ------------------------------------------------------------------- camera */

function CameraFollow({ pose }: { pose: { current: { x: number; z: number } } }) {
  const { camera } = useThree();
  const target = useRef({ x: pose.current.x, z: pose.current.z });

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 2.6);
    target.current.x += (pose.current.x - target.current.x) * k;
    target.current.z += (pose.current.z - target.current.z) * k;
    const y = terrainHeight(target.current.x, target.current.z);
    camera.position.x += (target.current.x - camera.position.x) * Math.min(1, dt * 2.2);
    camera.position.y += (y + 3.7 - camera.position.y) * Math.min(1, dt * 2.2);
    camera.position.z += (target.current.z + 7.6 - camera.position.z) * Math.min(1, dt * 2.2);
    camera.lookAt(target.current.x, y + 1.2, target.current.z);
  });

  return null;
}

/* -------------------------------------------------------------------- scene */

export function SurfaceScene(props: SurfaceSceneProps) {
  const { surface, profile, nodes } = props;
  const geo = useTerrainGeometry(profile);
  const pose = useRef({ x: surface.x, z: surface.z, heading: 0 });

  return (
    <>
      <SkyAndLight profile={profile} hours={surface.hours} />
      <Astronaut {...props} pose={pose} />
      <Lander profile={profile} />
      {surface.modules.map((m) => (
        <BuiltModule key={m.kind} kind={m.kind} slot={m.slot} />
      ))}
      {nodes.map((n) => (
        <ResourceDeposit
          key={n.id}
          node={n}
          taken={surface.taken.includes(n.id)}
          scout={surface.scoutDroneTarget?.id === n.id}
        />
      ))}
      <Rocks profile={profile} seed={surface.seed} />
      <Horizon profile={profile} hours={surface.hours} />
      <CameraFollow pose={pose} />
      <mesh position-y={-0.02}>
        <primitive object={geo} attach="geometry" />
        <meshStandardMaterial vertexColors roughness={0.96} metalness={0.04} flatShading />
      </mesh>
    </>
  );
}
