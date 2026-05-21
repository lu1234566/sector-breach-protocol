// @ts-nocheck
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

interface MapProps {
  mapData: number[][];
  cellSize: number;
}

type InstanceItem = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
};

function InstancedBoxes({ items, color, emissive = '#000000' }: any) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    if (!ref.current) return;
    items.forEach((it: InstanceItem, index: number) => {
      dummy.position.set(it.x, it.y, it.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(it.sx, it.sy, it.sz);
      dummy.updateMatrix();
      ref.current.setMatrixAt(index, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [items, dummy]);

  if (!items.length) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </instancedMesh>
  );
}

/**
 * Ultra-cheap arena renderer for Chromebooks / low quality mode.
 * It intentionally avoids textures, per-cell decorations, many lights and
 * hundreds of individual React meshes. Collision/gameplay still uses the same
 * mapData; this is only a visual replacement for World.tsx.
 */
export function WorldLite({ mapData, cellSize }: MapProps) {
  const mapWidth = mapData[0].length * cellSize;
  const mapHeight = mapData.length * cellSize;

  const { walls, crates, barrels } = useMemo(() => {
    const walls: InstanceItem[] = [];
    const crates: InstanceItem[] = [];
    const barrels: InstanceItem[] = [];

    for (let y = 0; y < mapData.length; y++) {
      for (let x = 0; x < mapData[0].length; x++) {
        const cell = mapData[y][x];
        const px = x * cellSize + cellSize / 2;
        const pz = y * cellSize + cellSize / 2;

        if (cell === 1) {
          walls.push({
            x: px,
            y: cellSize / 2,
            z: pz,
            sx: cellSize * 0.98,
            sy: cellSize,
            sz: cellSize * 0.98,
          });
        } else if (cell === 2) {
          crates.push({
            x: px,
            y: cellSize * 0.31,
            z: pz,
            sx: cellSize * 0.72,
            sy: cellSize * 0.62,
            sz: cellSize * 0.72,
          });
        } else if (cell === 3) {
          barrels.push({
            x: px,
            y: cellSize * 0.32,
            z: pz,
            sx: cellSize * 0.42,
            sy: cellSize * 0.64,
            sz: cellSize * 0.42,
          });
        }
      }
    }

    return { walls, crates, barrels };
  }, [mapData, cellSize]);

  return (
    <group position={[-mapWidth / 2, 0, -mapHeight / 2]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[mapWidth / 2, -0.01, mapHeight / 2]}>
        <planeGeometry args={[mapWidth, mapHeight]} />
        <meshBasicMaterial color="#59636f" toneMapped={false} />
      </mesh>

      <InstancedBoxes items={walls} color="#1f4f79" />
      <InstancedBoxes items={crates} color="#1a2030" />
      <InstancedBoxes items={barrels} color="#725a1d" />

      {/* A few cheap gameplay-readable floor marks, not per-cell decoration. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[mapWidth * 0.5, 0.02, mapHeight * 0.5]}>
        <ringGeometry args={[cellSize * 0.28, cellSize * 0.36, 24]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.75} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}
