/**
 * FlightScene — interactive 3D rocket flight visualization.
 *
 * Renders Earth, atmosphere, stars, the rocket (driven by the physics
 * engine), and three trajectory views (planned / actual / predicted).
 * Supports six switchable camera modes that stay synchronized with the
 * simulation physics.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Line, LineBasicMaterial, type Camera, type Mesh } from 'three';
import { useFlightStore } from '@/flight/FlightStore';
import { useFlightInput } from '@/flight/InputManager';
import { Rocket } from '../shapes';
import { useVisualQuality } from '../quality';

const KM = 1000; // physics metres -> three.js units (1 unit = 1 km)
const EARTH_RADIUS_KM = 6371;

export type CameraMode = 'follow' | 'chase' | 'side' | 'cockpit' | 'wide' | 'target';

export interface FlightSceneProps {
  mode: CameraMode;
  setMode: (m: CameraMode) => void;
}

const STAR_COUNT = 3000;

function makeStars() {
  const n = STAR_COUNT;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const theta = Math.random() * Math.PI * 2;
    const y = Math.random() * 2 - 1;
    const r = 20000 + Math.random() * 40000;
    const horiz = Math.sqrt(Math.max(0, 1 - y * y)) * r;
    pos[i * 3] = Math.cos(theta) * horiz;
    pos[i * 3 + 1] = y * r;
    pos[i * 3 + 2] = Math.sin(theta) * horiz;
  }
  return pos;
}

export function FlightScene({ mode, setMode }: FlightSceneProps) {
  const q = useVisualQuality();
  const { state, trajectory, isPaused, isRunning, step, config } = useFlightStore((s) => ({
    state: s.state,
    trajectory: s.trajectory,
    isPaused: s.isPaused,
    isRunning: s.isRunning,
    step: s.step,
    config: s.config,
  }));
  const input = useFlightInput();

  const cameraRef = useRef<Camera | null>(null);
  const rocketRef = useRef<Group | null>(null);
  const trajGroupRef = useRef<Group | null>(null);
  const plannedLineRef = useRef<Line | null>(null);
  const actualLineRef = useRef<Line | null>(null);
  const predictedLineRef = useRef<Line | null>(null);
  const targetMarkerRef = useRef<Group | null>(null);
  const lastTimeRef = useRef(performance.now());

  // Create trajectory lines once (stable objects) and attach to the R3F group.
  useEffect(() => {
    const group = trajGroupRef.current;
    if (!group) return;
    const make = (color: string, opacity: number) => {
      const line = new Line(new BufferGeometry(), new LineBasicMaterial({ color: new Color(color), transparent: true, opacity }));
      group.add(line);
      return line;
    };
    plannedLineRef.current = make('#3DE0FF', 0.35);
    actualLineRef.current = make('#2FE05A', 0.8);
    predictedLineRef.current = make('#E8A03D', 0.6);
  }, []);

  useEffect(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    cam.position.set(0, EARTH_RADIUS_KM + 60, -220);
    cam.lookAt(0, EARTH_RADIUS_KM, 0);
  }, []);

  useFrame((st, dt) => {
    const cam = st.camera;
    if (!cam) return;
    const now = performance.now();
    let frameDt = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;
    if (frameDt > 0.1) frameDt = 0.1;
    if (!isRunning || isPaused) frameDt = 0;

    // Advance the physics simulation each frame using continuous input.
    if (state && config && isRunning && !isPaused && step) {
      step(frameDt, input);
    }

    // Read latest state after the step for rendering.
    const cur = useFlightStore.getState().state;
    if (!cur) return;

    // Rocket transform from physics state.
    const rocket = rocketRef.current;
    if (rocket) {
      rocket.position.set(cur.position[0] / KM, cur.position[1] / KM, cur.position[2] / KM);
      const [qx, qy, qz, qw] = cur.orientation;
      rocket.quaternion.set(qx, qy, qz, qw);
      rocket.rotateX(Math.PI / 2);
    }

    // Camera modes.
    const rx = cur.position[0] / KM;
    const ry = cur.position[1] / KM;
    const rz = cur.position[2] / KM;
    const vx = cur.velocity[0];
    const vy = cur.velocity[1];
    const vz = cur.velocity[2];
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    const dirX = speed > 0 ? vx / speed : 0;
    const dirY = speed > 0 ? vy / speed : 0;
    const dirZ = speed > 0 ? vz / speed : 0;

    let cx = 0, cy = 0, cz = 0, lx = 0, ly = 0, lz = 0;

    if (mode === 'follow') {
      cx = rx - dirX * 40;
      cy = ry + 30 - dirY * 10;
      cz = rz - dirZ * 40;
      lx = rx; ly = ry; lz = rz;
    } else if (mode === 'chase') {
      cx = rx - dirX * 60;
      cy = ry - dirY * 20 + 15;
      cz = rz - dirZ * 60;
      lx = rx + dirX * 200; ly = ry + dirY * 200; lz = rz + dirZ * 200;
    } else if (mode === 'side') {
      cx = rx - 80;
      cy = ry + 20;
      cz = rz;
      lx = rx; ly = ry; lz = rz;
    } else if (mode === 'cockpit') {
      cx = rx + dirX * 5;
      cy = ry + dirY * 5 + 2;
      cz = rz + dirZ * 5;
      lx = rx + dirX * 500; ly = ry + dirY * 500; lz = rz + dirZ * 500;
    } else if (mode === 'wide') {
      cx = 0; cy = EARTH_RADIUS_KM + 400; cz = -1200;
      lx = 0; ly = EARTH_RADIUS_KM; lz = 0;
    } else if (mode === 'target') {
      const tx = cur.targetPosition[0] / KM;
      const ty = cur.targetPosition[1] / KM;
      const tz = cur.targetPosition[2] / KM;
      cx = rx; cy = ry; cz = rz;
      lx = tx; ly = ty; lz = tz;
    }

    const ease = 1 - Math.exp(-dt * 2.5);
    cam.position.x += (cx - cam.position.x) * ease;
    cam.position.y += (cy - cam.position.y) * ease;
    cam.position.z += (cz - cam.position.z) * ease;
    cam.lookAt(lx, ly, lz);

    // Update trajectory lines.
    const traj = useFlightStore.getState().trajectory;
    if (traj) {
      const updateLine = (ref: RefObject<Line | null>, points: Array<{ position: [number, number, number] }>) => {
        const line = ref.current;
        if (!line) return;
        const pos = new Float32Array(points.length * 3);
        points.forEach((p, i) => {
          pos[i * 3] = p.position[0] / KM;
          pos[i * 3 + 1] = p.position[1] / KM;
          pos[i * 3 + 2] = p.position[2] / KM;
        });
        (line.geometry as BufferGeometry).setAttribute('position', new BufferAttribute(pos, 3));
        (line.geometry as BufferGeometry).attributes.position.needsUpdate = true;
      };
      updateLine(plannedLineRef, traj.planned);
      updateLine(actualLineRef, traj.actual);
      updateLine(predictedLineRef, traj.predicted);

      // Target marker position.
      const marker = targetMarkerRef.current;
      if (marker) {
        marker.position.set(cur.targetPosition[0] / KM, cur.targetPosition[1] / KM, cur.targetPosition[2] / KM);
      }
    }
  });

  const seg = q.tier === 'low' ? 40 : 80;

  return (
    <group>
      {/* Stars */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[makeStars(), 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={q.reduced ? 4 : 2}
          sizeAttenuation={false}
          transparent
          opacity={0.8}
          color="#FFFFFF"
          depthWrite={false}
        />
      </points>

      {/* Earth */}
      <group>
        <mesh position={[0, EARTH_RADIUS_KM, 0]}>
          <sphereGeometry args={[EARTH_RADIUS_KM, seg, seg]} />
          <meshStandardMaterial
            color="#1B3A5C"
            roughness={0.9}
            metalness={0.1}
            emissive="#05101C"
            emissiveIntensity={0.5}
          />
        </mesh>
        {/* Atmosphere shell */}
        <mesh position={[0, EARTH_RADIUS_KM, 0]} scale={1.08}>
          <sphereGeometry args={[EARTH_RADIUS_KM, 64, 32]} />
          <meshBasicMaterial
            color="#3DE0FF"
            transparent
            opacity={0.12}
            side={BackSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Trajectory lines (created imperatively, attached below) */}
      {trajectory && (
        <>
          <group ref={trajGroupRef} />
          {/* Target marker */}
          <group ref={targetMarkerRef}>
            <mesh>
              <sphereGeometry args={[8, 16, 16]} />
              <meshBasicMaterial color="#FFB81F" />
            </mesh>
            <mesh>
              <ringGeometry args={[10, 16, 32]} />
              <meshBasicMaterial color="#FFB81F" transparent opacity={0.6} side={DoubleSide} depthWrite={false} />
            </mesh>
          </group>
        </>
      )}

      {/* The rocket */}
      <group ref={rocketRef}>
        <Rocket
          sep={0}
          thrust={state ? state.thrust : 0}
          radius={3}
          height={45}
          fins={4}
        />
      </group>

      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[10000, 20000, -10000]} intensity={1.2} color="#FFFFFF" />
    </group>
  );
}
