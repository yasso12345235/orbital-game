/**
 * Shape 3 — Holographic wireframe sphere: icosphere edges, constellation
 * nodes joined by leader lines and a scanning band (fresnel band shader).
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Vector3,
  type Group,
  type LineBasicMaterial,
  type MeshBasicMaterial,
} from 'three';
import { uAccent } from '../../store-adapters/accent';
import { useVisualQuality } from '../quality';
import { mulberry32, syncAccent } from './util';
import fresnelVert from '../shaders/fresnel.vert.glsl?raw';
import fresnelFrag from '../shaders/fresnel.frag.glsl?raw';

export interface HoloSphereProps {
  radius?: number;
  /** Scan-band strength 0…1 (0 disables). */
  scan?: number;
  /** Constellation points joined by lines. */
  nodes?: number;
  spin?: number;
}

export function HoloSphere({ radius = 1.5, scan = 0.5, nodes = 8, spin = 0.12 }: HoloSphereProps) {
  const q = useVisualQuality();
  const group = useRef<Group>(null);
  const edgeMat = useRef<LineBasicMaterial>(null);
  const nodeMat = useRef<MeshBasicMaterial>(null);
  const linkMat = useRef<LineBasicMaterial>(null);

  const edges = useMemo(() => new EdgesGeometry(new IcosahedronGeometry(radius, 1)), [radius]);
  const constellation = useMemo(() => {
    const rnd = mulberry32(7);
    const pts: Vector3[] = [];
    for (let i = 0; i < nodes; i++) {
      const v = new Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
      if (v.lengthSq() < 0.001) v.set(1, 0, 0);
      pts.push(v.normalize().multiplyScalar(radius * 1.04));
    }
    const positions: number[] = [];
    for (let i = 0; i < nodes; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % nodes];
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return { pts, geo };
  }, [nodes, radius]);

  const bandUniforms = useMemo(
    () => ({
      uAccent,
      uPower: { value: 2.8 },
      uIntensity: { value: 0.45 },
      uTime: { value: 0 },
      uBand: { value: scan },
    }),
    [scan],
  );

  useFrame((_, dt) => {
    syncAccent(edgeMat.current, 0.85);
    syncAccent(nodeMat.current, 1);
    syncAccent(linkMat.current, 0.7);
    if (q.reduced) return;
    bandUniforms.uTime.value += dt * (0.5 + scan * 2);
    if (group.current) group.current.rotation.y += dt * spin;
  });

  return (
    <group ref={group}>
      <lineSegments geometry={edges}>
        <lineBasicMaterial ref={edgeMat} transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} color="#46C8FF" />
      </lineSegments>

      <lineSegments geometry={constellation.geo}>
        <lineBasicMaterial ref={linkMat} transparent opacity={0.5} blending={AdditiveBlending} depthWrite={false} color="#46C8FF" />
      </lineSegments>

      {constellation.pts.map((p, i) => (
        <mesh key={i} position={p} material={undefined}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshBasicMaterial ref={i === 0 ? nodeMat : undefined} color="#46C8FF" transparent opacity={0.95} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}

      {/* Scanning band — fresnel band shader on a slightly larger shell. */}
      <mesh scale={1.03}>
        <sphereGeometry args={[radius, 48, 48]} />
        <shaderMaterial
          uniforms={bandUniforms}
          vertexShader={fresnelVert}
          fragmentShader={fresnelFrag}
          transparent
          depthWrite={false}
          side={BackSide}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
