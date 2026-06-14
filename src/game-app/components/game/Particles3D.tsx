// @ts-nocheck
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  life: number;
  vx: number;
  vy: number;
}

const MAX_PARTICLES = 256;

/**
 * All particles render through a single InstancedMesh (one draw call) and
 * read the live particle list from a ref every frame — no per-particle React
 * elements, no geometry churn, and positions update at full frame rate
 * instead of the 30Hz game-state sync.
 */
export const Particles3D = React.memo(function Particles3D({
  particlesRef,
  cellSize,
  mapWidth,
  mapHeight,
}: {
  particlesRef: React.MutableRefObject<Particle[]>;
  cellSize: number;
  mapWidth: number;
  mapHeight: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  // Cache parsed colours so the hot loop never re-parses a CSS string (the
  // particle palette is just a handful of hex values).
  const colorCache = useMemo(() => new Map<string, THREE.Color>(), []);
  const colorFor = (hex: string) => {
    let c = colorCache.get(hex);
    if (!c) {
      c = new THREE.Color(hex);
      colorCache.set(hex, c);
    }
    return c;
  };

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const list = particlesRef.current ?? [];
    const n = Math.min(list.length, MAX_PARTICLES);
    for (let i = 0; i < n; i++) {
      const p = list[i];
      dummy.position.set(
        p.x - mapWidth / 2,
        cellSize / 3 + (1 - p.life) * cellSize * 0.2,
        p.y - mapHeight / 2,
      );
      // Shrink with remaining life (replaces per-particle opacity fade,
      // which is not available per-instance on a shared material).
      dummy.scale.setScalar((p.size / 5) * Math.max(0.1, p.life));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, colorFor(p.color));
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
});
