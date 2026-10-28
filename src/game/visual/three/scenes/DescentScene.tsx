/**
 * DescentScene — powered descent onto the chosen world.
 *
 * The screen owns the guidance physics (altitude, velocity, propellant); this
 * scene renders the vehicle, the target pad and the ground rushing up, with the
 * camera tracking the lander so the last 200 m read clearly.
 */
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  PlaneGeometry,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type PointLight,
  type Points,
  type PointsMaterial,
} from 'three';
import { useVisualQuality } from '../quality';
import type { SurfaceProfile } from '../../../surface/model';

/* --------------------------------------------------------------- sky dome */
/* The dome renders the same ACES + sRGB pipeline as the scene materials, so
   the fog colour (taken from uHorizon) meets the sky with no seam. */
const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDir = normalize(world.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
uniform vec3 uHorizon;
uniform vec3 uZenith;

void main() {
  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, smoothstep(0.5, 0.9, h));
  // haze band hugging the horizon; this is what the far ground fades into
  float haze = pow(max(0.0, 1.0 - abs(h - 0.5) * 5.0), 2.0);
  col = mix(col, uHorizon, haze * 0.6);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface DescentSceneProps {
  profile: SurfaceProfile;
  /** Metres above the pad. */
  altitude: number;
  /** Lateral offset in metres. */
  x: number;
  /** 0–1 throttle, already reduced-motion aware. */
  thrust: number;
  /** True once guidance has handed over (landed/crashed). */
  settled: boolean;
  crashed: boolean;
}

function craters(x: number, z: number): number {
  return (
    Math.sin(x * 0.07) * Math.cos(z * 0.055) * 1.6 +
    Math.sin(x * 0.19 + z * 0.13) * 0.55 +
    Math.cos(z * 0.3) * 0.22
  );
}

function Lander({ profile, thrust }: { profile: SurfaceProfile; thrust: number }) {
  const flame = useRef<Mesh>(null);
  const flameMat = useRef<MeshStandardMaterial>(null);
  const light = useRef<PointLight>(null);
  const q = useVisualQuality();

  useFrame((s) => {
    const flicker = q.reduced ? 1 : 0.85 + Math.random() * 0.3;
    if (flame.current) {
      flame.current.scale.set(1, 0.15 + thrust * 1.6, 1);
      flame.current.visible = thrust > 0.02;
    }
    if (flameMat.current) flameMat.current.opacity = Math.min(0.95, 0.2 + thrust * 0.9) * flicker;
    if (light.current) light.current.intensity = thrust * 90 * flicker + 6;
    void s;
  });

  return (
    <group>
      {/* descent stage */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[1.15, 1.3, 1.5, 18]} />
        <meshStandardMaterial color="#2b3345" metalness={0.62} roughness={0.45} />
      </mesh>
      <mesh position={[0, -0.95, 0]}>
        <cylinderGeometry args={[0.62, 0.82, 0.45, 16]} />
        <meshStandardMaterial color="#151b26" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* ascent cabin */}
      <mesh position={[0, 1.28, 0]}>
        <capsuleGeometry args={[0.85, 0.8, 8, 18]} />
        <meshStandardMaterial color="#e2e7f1" metalness={0.5} roughness={0.32} />
      </mesh>
      <mesh position={[0, 1.34, 0.8]} rotation-x={Math.PI / 2}>
        <circleGeometry args={[0.24, 16]} />
        <meshStandardMaterial color="#081020" emissive={profile.sun} emissiveIntensity={0.7} metalness={0.9} roughness={0.12} />
      </mesh>
      {/* legs */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <group key={i} rotation-y={a}>
            <mesh position={[1.0, -0.35, 0]} rotation-z={0.6}>
              <cylinderGeometry args={[0.055, 0.055, 1.5, 6]} />
              <meshStandardMaterial color="#94a0b4" metalness={0.75} roughness={0.3} />
            </mesh>
            <mesh position={[1.55, -1.12, 0]}>
              <cylinderGeometry args={[0.3, 0.36, 0.1, 12]} />
              <meshStandardMaterial color="#69758a" metalness={0.6} roughness={0.5} />
            </mesh>
          </group>
        );
      })}
      {/* engine plume */}
      <mesh ref={flame} position={[0, -1.35, 0]}>
        <coneGeometry args={[0.62, 2.6, 16, 1, true]} />
        <meshStandardMaterial
          ref={flameMat}
          color="#ffd9a0"
          emissive="#ff9a4d"
          emissiveIntensity={2.4}
          transparent
          opacity={0.2}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <pointLight ref={light} position={[0, -1.5, 0]} color="#ffb066" intensity={8} distance={30} decay={2} />
    </group>
  );
}

export function DescentScene({ profile, altitude, x, thrust, settled, crashed }: DescentSceneProps) {
  const { scene, camera } = useThree();
  const world = useRef<Group>(null);
  const dust = useRef<Points>(null);
  const dustMat = useRef<PointsMaterial>(null);
  const zenith = useMemo(() => new Color(), []);
  const horizon = useMemo(() => new Color(), []);
  const base = useMemo(() => new Color(profile.skyDay), [profile.skyDay]);
  const skyUniforms = useMemo(
    () => ({
      uHorizon: { value: new Color(profile.skyDay) },
      uZenith: { value: new Color('#05070f') },
    }),
    [profile.skyDay],
  );

  const geo = useMemo(() => {
    const g = new PlaneGeometry(1200, 1200, 80, 80);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // flat within the pad footprint, gentle relief beyond it
      const flat = Math.min(1, Math.max(0, (Math.hypot(x, z) - 11) / 28));
      pos.setY(i, craters(x, z) * flat);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  const dustGeo = useMemo(() => {
    const n = 160;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.6 + Math.pow(Math.random(), 0.6) * 7;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = Math.random() * 1.6;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(arr, 3));
    return g;
  }, []);

  useFrame((_, dt) => {
    // 1 at the pad, 0 high up: the sky deepens and thins with altitude.
    const blend = Math.min(1, Math.max(0, 1 - altitude / 700));
    zenith.copy(base).multiplyScalar(0.34 + 0.6 * blend);
    horizon.copy(base).multiplyScalar(0.88 + 0.14 * blend);
    skyUniforms.uZenith.value.copy(zenith);
    skyUniforms.uHorizon.value.copy(horizon);
    scene.background = zenith;
    if (scene.fog) scene.fog.color.copy(horizon);

    // Altitude is conveyed by the ground falling away: the pad is out of frame
    // at 800 m and rises into view over the last ~100 m.
    const groundY = -Math.min(40, Math.max(0, altitude) * 0.2);
    if (world.current) world.current.position.y = groundY;

    // ground haze and dust build as the pad gets close
    if (dust.current) {
      dust.current.position.y = groundY + 0.3;
      const near = 1 - Math.min(1, altitude / 70);
      dust.current.scale.setScalar(1 + near * 2.2);
      if (dustMat.current) dustMat.current.opacity = near * 0.28;
    }

    const camX = x * 0.2 + 7.4;
    const camY = 6.2;
    const camZ = 16.5;
    camera.position.x += (camX - camera.position.x) * Math.min(1, dt * 3);
    camera.position.y += (camY - camera.position.y) * Math.min(1, dt * 3);
    camera.position.z += (camZ - camera.position.z) * Math.min(1, dt * 3);
    camera.lookAt(x * 0.45, 1.7, 0);
  });

  return (
    <>
      <ambientLight intensity={0.42} color="#cfe0ff" />
      <directionalLight position={[-30, 60, 20]} intensity={1.55} color={profile.sun} />
      <directionalLight position={[20, -5, -15]} intensity={0.45} color="#7fb8ff" />

      <fog attach="fog" args={[profile.skyDay, 80, 560]} />

      {/* gradient sky dome: the ground's fog colour is its horizon colour */}
      <mesh renderOrder={-10}>
        <sphereGeometry args={[600, 32, 20]} />
        <shaderMaterial
          uniforms={skyUniforms}
          vertexShader={SKY_VERT}
          fragmentShader={SKY_FRAG}
          side={BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      <group ref={world}>
        {/* landing pad: a lit target ring on the regolith */}
        <mesh rotation-x={-Math.PI / 2} position-y={0.05}>
          <ringGeometry args={[5.2, 6.2, 64]} />
          <meshBasicMaterial color="#e9c37c" transparent opacity={0.8} side={DoubleSide} depthWrite={false} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={0.04}>
          <ringGeometry args={[1.4, 1.7, 48]} />
          <meshBasicMaterial color="#7fd8ff" transparent opacity={0.55} side={DoubleSide} depthWrite={false} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
          <circleGeometry args={[5.2, 48]} />
          <meshStandardMaterial color="#1a2233" roughness={0.9} metalness={0.1} />
        </mesh>

        {/* approach lights */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 7.2, 0.35, Math.sin(a) * 7.2]}>
              <boxGeometry args={[0.18, 0.7, 0.18]} />
              <meshStandardMaterial color="#1b2434" emissive={i % 2 ? '#ff4d6a' : '#7fd8ff'} emissiveIntensity={1.4} />
            </mesh>
          );
        })}

        {/* terrain */}
        <mesh position-y={0}>
          <primitive object={geo} attach="geometry" />
          <meshStandardMaterial color={profile.ground} roughness={0.97} metalness={0.03} flatShading />
        </mesh>

        {/* boulders, so scale reads during the last 100 m */}
        {[
          [26, -18, 2.2],
          [-30, 12, 1.8],
          [34, 26, 2.6],
          [-38, -22, 2.0],
          [16, 36, 1.5],
          [-14, -32, 1.4],
        ].map(([bx, bz, s], i) => (
          <mesh key={i} position={[bx, s * 0.35, bz]}>
            <icosahedronGeometry args={[s, 0]} />
            <meshStandardMaterial color={profile.groundAlt} roughness={0.95} flatShading />
          </mesh>
        ))}
      </group>

      <group position={[x * 0.45, 1.42, 0]} rotation={[0, 0, crashed && settled ? 0.5 : 0]}>
        <Lander profile={profile} thrust={settled ? 0 : thrust} />
      </group>

      {/* regolith kicked up by the plume */}
      <points ref={dust} position={[x * 0.45, 0.3, 0]} rotation-x={-Math.PI / 2}>
        <primitive object={dustGeo} attach="geometry" />
        <pointsMaterial
          ref={dustMat}
          size={0.55}
          color={profile.ground}
          transparent
          opacity={0}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </>
  );
}
