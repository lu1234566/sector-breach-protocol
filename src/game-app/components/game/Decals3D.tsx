// @ts-nocheck
import React from "react";
import * as THREE from "three";
import { WallDecal } from "../../game/types";

const DECAL_LIFETIME = 6000;

export function Decals3D({
  decals,
  cellSize,
  mapData,
  now,
}: {
  decals: WallDecal[];
  cellSize: number;
  mapData: number[][];
  now: number;
}) {
  const mapWidth = mapData[0].length * cellSize;
  const mapHeight = mapData.length * cellSize;

  return (
    <>
      {decals.map((d) => {
        const age = now - d.born;
        if (age > DECAL_LIFETIME) return null;
        const t = 1 - age / DECAL_LIFETIME;
        const alpha = Math.min(1, t * 1.5);

        // Position decal slightly off the wall along its normal
        const offset = 0.6;
        const px = d.x + d.nx * offset;
        const py = d.y + d.ny * offset;

        // Plane faces along normal: rotate around Y so plane normal aligns with (nx, ny)
        // Default plane normal is +Z. We want plane normal = (nx, 0, ny).
        const yaw = Math.atan2(d.nx, d.ny);

        const baseY = cellSize / 2.5;
        const jitterY = ((d.id * 37) % 100) / 100 - 0.5; // deterministic per-decal vertical scatter
        return (
          <group
            key={d.id}
            position={[px - mapWidth / 2, baseY + jitterY * cellSize * 0.4, py - mapHeight / 2]}
            rotation={[0, yaw, 0]}
          >
            {/* Outer scorch */}
            <mesh>
              <circleGeometry args={[d.size * 0.55, 12]} />
              <meshBasicMaterial
                color="#0a0f1a"
                transparent
                opacity={alpha * 0.7}
                depthWrite={false}
              />
            </mesh>
            {/* Neon ring */}
            <mesh position={[0, 0, 0.01]}>
              <ringGeometry args={[d.size * 0.28, d.size * 0.4, 16]} />
              <meshBasicMaterial
                color="#22d3ee"
                transparent
                opacity={alpha * 0.85}
                depthWrite={false}
              />
            </mesh>
            {/* Hot core */}
            <mesh position={[0, 0, 0.02]}>
              <circleGeometry args={[d.size * 0.18, 10]} />
              <meshBasicMaterial color="#f0abfc" transparent opacity={alpha} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
