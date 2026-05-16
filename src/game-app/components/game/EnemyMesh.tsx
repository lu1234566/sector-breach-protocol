// @ts-nocheck
import React, { Suspense, useMemo, useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const URLS = {
  rusher: '/assets/enemies/enemy_trilobite.glb',
  rifleman: '/assets/enemies/enemy_quadshell.glb',
  sniper: '/assets/enemies/enemy_eyedrone.glb',
} as const;

useGLTF.preload(URLS.rusher);
useGLTF.preload(URLS.rifleman);
useGLTF.preload(URLS.sniper);

// Target size per type (in cell units) so models fill the slot nicely.
const TARGET: Record<string, number> = {
  rusher: 0.85,
  rifleman: 1.0,
  sniper: 0.7,
};

function Model({ url, cellSize, color, type, lastShot }: any) {
  const { scene } = useGLTF(url) as any;
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const ref = useRef<THREE.Group>(null);
  const emissiveMats = useRef<THREE.MeshStandardMaterial[]>([]);

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
    cloned.position.y -= box2.min.y; // feet at y=0
    // Drop slightly so they sit at floor level (parent positions them at cellSize/2)
    cloned.position.y -= cellSize * 0.5;

    // Tint with neon emissive accent
    const c3 = new THREE.Color(color);
    emissiveMats.current = [];
    cloned.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        const mat = o.material as THREE.MeshStandardMaterial;
        if (mat && 'emissive' in mat) {
          mat.emissive = c3;
          mat.emissiveIntensity = 0.4;
          emissiveMats.current.push(mat);
        }
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
      <pointLight color={color} intensity={0.45} distance={cellSize * 1.6} position={[0, cellSize * 0.3, 0]} />
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
