// @ts-nocheck
import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const DRAGON_URL = '/assets/boss/dragon.glb';

// Preload so it's ready when boss wave hits
useGLTF.preload(DRAGON_URL);

interface Props {
  cellSize: number;
  color: string;
  healthPct: number;
  lastShot: number;
}

/**
 * Procedural-animated dragon boss. No rig — we drive transform + emissive only.
 * Phases follow healthPct (1=full -> 3=critical).
 */
export function DragonBoss({ cellSize, color, healthPct, lastShot }: Props) {
  return (
    <Suspense fallback={<FallbackTitan cellSize={cellSize} color={color} />}>
      <DragonInner cellSize={cellSize} color={color} healthPct={healthPct} lastShot={lastShot} />
    </Suspense>
  );
}

function DragonInner({ cellSize, color, healthPct, lastShot }: Props) {
  const { scene } = useGLTF(DRAGON_URL) as any;
  const root = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Clone once so multiple instances don't share transforms
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    // Normalize to ~1 cell (parent applies scale=2.6 already)
    const box = new THREE.Box3().setFromObject(c);
    const size = new THREE.Vector3();
    box.getSize(size);
    const target = cellSize * 1.0;
    const k = target / Math.max(size.x, size.y, size.z);
    c.scale.setScalar(k);
    // Recenter on origin (parent positions the group)
    const center = new THREE.Vector3();
    box.getCenter(center);
    c.position.sub(center.multiplyScalar(k));

    c.traverse((o: any) => {
      if (o.isMesh) {
        meshRef.current = o;
        o.castShadow = false;
        o.receiveShadow = false;
        const oldMat = o.material as THREE.MeshStandardMaterial;
        const mat = new THREE.MeshStandardMaterial({
          map: oldMat.map ?? null,
          color: new THREE.Color('#5a82c8'),
          emissive: new THREE.Color(color),
          emissiveIntensity: 0.6,
          metalness: 0.4,
          roughness: 0.55,
        });
        o.material = mat;
      }
    });
    return c;
  }, [scene, cellSize, color]);

  const phase = healthPct > 0.66 ? 1 : healthPct > 0.33 ? 2 : 3;

  useFrame((state) => {
    if (!root.current) return;
    const t = state.clock.getElapsedTime();
    const since = (Date.now() - lastShot) / 1000;

    // Idle breathing — scale tiny
    const breath = 1 + Math.sin(t * 1.2) * 0.012;
    root.current.scale.setScalar(breath);

    // Subtle hover bob
    root.current.position.y = Math.sin(t * 0.9) * cellSize * 0.06;

    // Slow heading rotation (looks alive, no head tracking needed yet)
    root.current.rotation.y = Math.sin(t * 0.35) * 0.18;

    // Emissive flare on attack windup
    const baseE = 0.5 + (phase - 1) * 0.4;
    const attackFlare = since > 0.6 && since < 1.3 ? 1.8 : 0;
    const pulse = Math.sin(t * (2 + phase)) * 0.25;
    const eI = baseE + attackFlare + pulse;
    if (meshRef.current) {
      (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = eI;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 1.2 + attackFlare * 0.8 + pulse * 0.4;
    }
  });

  return (
    <group ref={root}>
      <primitive object={cloned} />
      <pointLight ref={lightRef} color={color} intensity={1.2} distance={cellSize * 6} position={[0, cellSize * 0.5, 0]} />
      {phase >= 2 && (
        <pointLight color="#e879f9" intensity={0.8} distance={cellSize * 5} position={[0, cellSize * 1.2, cellSize * 0.4]} />
      )}
    </group>
  );
}

/** Cheap fallback while GLB loads — single emissive box silhouette */
function FallbackTitan({ cellSize, color }: { cellSize: number; color: string }) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[cellSize * 0.9, cellSize * 1.4, cellSize * 0.7]} />
        <meshStandardMaterial color="#1a1f33" emissive={color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}
