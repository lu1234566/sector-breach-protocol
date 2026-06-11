// @ts-nocheck
import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";

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

const TEX_BASE = "/assets/textures";
const TEX_URLS = {
  wall: `${TEX_BASE}/wall_blue.webp`,
  wallAlt: `${TEX_BASE}/wall_concrete.webp`,
  floor: `${TEX_BASE}/floor_concrete.webp`,
  crate: `${TEX_BASE}/floor_rubber.webp`,
};

function h(x: number, y: number, salt = 0) {
  const v = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

function prepTexture(texture: THREE.Texture, repeatX = 1, repeatY = 1) {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 1;
  texture.needsUpdate = true;
  return texture;
}

function InstancedBoxes({ items, color, map, opacity = 1 }: any) {
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
      <meshBasicMaterial
        color={color}
        map={map ?? null}
        toneMapped={false}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </instancedMesh>
  );
}

function InstancedStrips({ items, color, opacity = 0.85 }: any) {
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
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        toneMapped={false}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

/**
 * Chromebook-friendly arena renderer.
 * This keeps the huge performance win from instancing, but adds single-pass
 * lightweight texture maps and a few instanced trims so low quality no longer
 * looks like untextured debug geometry.
 */
export function WorldLite({ mapData, cellSize }: MapProps) {
  const mapWidth = mapData[0].length * cellSize;
  const mapHeight = mapData.length * cellSize;

  const rawTex = useTexture(TEX_URLS) as Record<string, THREE.Texture>;
  const tex = useMemo(() => {
    return {
      floor: prepTexture(rawTex.floor, mapWidth / 220, mapHeight / 220),
      wall: prepTexture(rawTex.wall, 1.1, 1.1),
      wallAlt: prepTexture(rawTex.wallAlt, 1.0, 1.0),
      crate: prepTexture(rawTex.crate, 1.0, 1.0),
    };
  }, [rawTex, mapWidth, mapHeight]);

  const { walls, wallCaps, crates, barrels, cyanStrips, amberStrips, magentaFloorMarks } =
    useMemo(() => {
      const walls: InstanceItem[] = [];
      const wallCaps: InstanceItem[] = [];
      const crates: InstanceItem[] = [];
      const barrels: InstanceItem[] = [];
      const cyanStrips: InstanceItem[] = [];
      const amberStrips: InstanceItem[] = [];
      const magentaFloorMarks: InstanceItem[] = [];

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
            wallCaps.push({
              x: px,
              y: cellSize * 1.02,
              z: pz,
              sx: cellSize,
              sy: cellSize * 0.045,
              sz: cellSize,
            });

            // Sparse sci-fi trims. Still cheap because all trims share instancing.
            const r = h(x, y, 4);
            if (r < 0.18) {
              cyanStrips.push({
                x: px,
                y: cellSize * 0.83,
                z: pz + cellSize * 0.502,
                sx: cellSize * 0.62,
                sy: cellSize * 0.018,
                sz: cellSize * 0.018,
              });
            } else if (r < 0.28) {
              amberStrips.push({
                x: px + cellSize * 0.502,
                y: cellSize * 0.5,
                z: pz,
                sx: cellSize * 0.018,
                sy: cellSize * 0.5,
                sz: cellSize * 0.018,
              });
            }
          } else if (cell === 2) {
            crates.push({
              x: px,
              y: cellSize * 0.31,
              z: pz,
              sx: cellSize * 0.72,
              sy: cellSize * 0.62,
              sz: cellSize * 0.72,
            });
            cyanStrips.push({
              x: px,
              y: cellSize * 0.64,
              z: pz + cellSize * 0.36,
              sx: cellSize * 0.42,
              sy: cellSize * 0.018,
              sz: cellSize * 0.018,
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
            amberStrips.push({
              x: px,
              y: cellSize * 0.66,
              z: pz,
              sx: cellSize * 0.3,
              sy: cellSize * 0.018,
              sz: cellSize * 0.3,
            });
          } else if (cell === 0 && h(x, y, 9) < 0.045) {
            magentaFloorMarks.push({
              x: px,
              y: 0.018,
              z: pz,
              sx: cellSize * 0.42,
              sy: 0.01,
              sz: cellSize * 0.42,
            });
          }
        }
      }

      return { walls, wallCaps, crates, barrels, cyanStrips, amberStrips, magentaFloorMarks };
    }, [mapData, cellSize]);

  return (
    <group position={[-mapWidth / 2, 0, -mapHeight / 2]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[mapWidth / 2, -0.01, mapHeight / 2]}>
        <planeGeometry args={[mapWidth, mapHeight]} />
        <meshBasicMaterial color="#9ca3af" map={tex.floor} toneMapped={false} />
      </mesh>

      <InstancedBoxes items={walls} color="#4d8db8" map={tex.wall} />
      <InstancedBoxes items={wallCaps} color="#2a5d86" map={tex.wallAlt} />
      <InstancedBoxes items={crates} color="#303846" map={tex.crate} />
      <InstancedBoxes items={barrels} color="#8b6c24" />

      <InstancedStrips items={cyanStrips} color="#22d3ee" opacity={0.8} />
      <InstancedStrips items={amberStrips} color="#fbbf24" opacity={0.75} />
      <InstancedBoxes items={magentaFloorMarks} color="#a855f7" opacity={0.18} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[mapWidth * 0.5, 0.025, mapHeight * 0.5]}>
        <ringGeometry args={[cellSize * 0.28, cellSize * 0.36, 24]} />
        <meshBasicMaterial
          color="#fbbf24"
          transparent
          opacity={0.75}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
