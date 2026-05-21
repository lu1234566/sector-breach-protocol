// @ts-nocheck
import React, { Suspense, useMemo, useRef, useEffect, Component } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const URLS = {
  rusher: '/assets/enemies/enemy_trilobite.glb',
  rifleman: '/assets/enemies/enemy_quadshell.glb',
  sniper: '/assets/enemies/enemy_eyedrone.glb',
} as const;

class EnemyErrorBoundary extends Component<any, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e: any) { console.error('[EnemyMesh] failed', this.props.type, e); }
  render() { return this.state.err ? <Fallback cellSize={this.props.cellSize} color={this.props.color} /> : this.props.children; }
}

useGLTF.preload(URLS.rusher);
useGLTF.preload(URLS.rifleman);
useGLTF.preload(URLS.sniper);

// Target size per type (in cell units) so models fill the slot nicely.
const TARGET: Record<string, number> = {
  rusher: 0.85,
  rifleman: 1.0,
  sniper: 0.7,
};

const BODY_TINT: Record<string, string> = {
  rusher: '#f6c2ff',
  rifleman: '#bff8ff',
  sniper: '#ffe9a6',
};

function boostEnemyMaterial(mm: any, color: string) {
  if (!mm) return;
  if (mm.color?.isColor) {
    const hsl = { h: 0, s: 0, l: 0 };
    mm.color.getHSL(hsl);
    if (hsl.l < 0.25) mm.color.setHSL(hsl.h, hsl.s, 0.45);
  }
  if (mm.emissive) {
    mm.emissive.set(color);
    mm.emissiveIntensity = Math.max(mm.emissiveIntensity ?? 0, 0.6);
  }
  if ('metalness' in mm) mm.metalness = Math.min(mm.metalness ?? 0.3, 0.4);
  if ('roughness' in mm) mm.roughness = Math.max(mm.roughness ?? 0.5, 0.55);
  if (mm.map) mm.map.colorSpace = THREE.SRGBColorSpace;
  mm.side = THREE.DoubleSide;
  mm.toneMapped = false;
  mm.needsUpdate = true;
}

function Model({ url, cellSize, color, type, lastShot }: any) {
  const { scene } = useGLTF(url) as any;
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const ref = useRef<THREE.Group>(null);
  const emissiveMats = useRef<any[]>([]);

  useEffect(() => {
    // Normalize to TARGET * cellSize
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const target = cellSize * (TARGET[type] ?? 0.9);
    const k = target / maxDim;
    cloned.scale.setScalar(k);
    // Recenter horizontally + sit on ground
    const box2 = new THREE.Box3().setFromObject(cloned);
    const c = new THREE.Vector3();
    box2.getCenter(c);
    cloned.position.x -= c.x;
    cloned.position.z -= c.z;
    cloned.position.y -= box2.min.y;
    cloned.position.y -= cellSize * 0.5;

    // Preserve original materials (with their maps) and only boost them.
    emissiveMats.current = [];
    cloned.traverse((o: any) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      o.receiveShadow = false;
      o.frustumCulled = false;
      // Clone material so per-instance tweaks don't bleed across enemies.
      if (Array.isArray(o.material)) {
        o.material = o.material.map((m: any) => {
          const cl = m.clone();
          boostEnemyMaterial(cl, color);
          emissiveMats.current.push(cl);
          return cl;
        });
      } else if (o.material) {
        o.material = o.material.clone();
        boostEnemyMaterial(o.material, color);
        emissiveMats.current.push(o.material);
      }
    });
  }, [cloned, cellSize, color, type]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const since = (Date.now() - (lastShot ?? 0)) / 1000;
    let glow = 0.4 + Math.sin(t * 4) * 0.1;
    // Attack telegraph
    if (since > 0.4 && since < 1.0) glow = 1.6;
    if (since < 0.1) glow = 2.4; // muzzle flash
    for (const m of emissiveMats.current) m.emissiveIntensity = glow;

    if (ref.current) {
      // Subtle bob for sniper (drone)
      if (type === 'sniper') {
        ref.current.position.y = Math.sin(t * 2) * cellSize * 0.08 + cellSize * 0.25;
        ref.current.rotation.y = t * 0.4;
      } else if (type === 'rusher') {
        // Wobble forward as it scuttles
        ref.current.rotation.x = -0.15 + Math.sin(t * 9) * 0.08;
      }
    }
  });

  return (
    <group ref={ref}>
      <primitive object={cloned} />
      <pointLight color={color} intensity={0.9} distance={cellSize * 2.4} position={[0, cellSize * 0.45, 0]} />
      <mesh position={[0, -cellSize * 0.49, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[cellSize * 0.34, cellSize * 0.42, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.65} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Fallback({ cellSize, color }: any) {
  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[cellSize * 0.4, cellSize * 0.6, cellSize * 0.4]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
    </mesh>
  );
}

export function EnemyMesh({ type, cellSize, color, lastShot }: any) {
  return (
    <Suspense fallback={<Fallback cellSize={cellSize} color={color} />}>
      <Model url={URLS[type]} type={type} cellSize={cellSize} color={color} lastShot={lastShot} />
    </Suspense>
  );
}
