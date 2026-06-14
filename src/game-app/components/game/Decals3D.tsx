// @ts-nocheck
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WallDecal } from "../../game/types";

const DECAL_LIFETIME = 6000;

/**
 * One bullet-mark. Self-fades every frame from its own `born` timestamp, so
 * the fade is smooth regardless of how often the parent React-renders (the
 * app is event-driven, not per-tick). Membership (add/remove) is still driven
 * by the parent's decal list.
 */
function Decal({ d, cellSize, mapWidth, mapHeight }: any) {
  const scorchRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringRef = useRef<THREE.MeshBasicMaterial>(null);
  const coreRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const age = Date.now() - d.born;
    const t = Math.max(0, 1 - age / DECAL_LIFETIME);
    const alpha = Math.min(1, t * 1.5);
    if (scorchRef.current) scorchRef.current.opacity = alpha * 0.7;
    if (ringRef.current) ringRef.current.opacity = alpha * 0.85;
    if (coreRef.current) coreRef.current.opacity = alpha;
  });

  // Position the decal on the wall face along its normal. Small vertical
  // scatter keeps marks from stacking but stays close to the impact point.
  const offset = 0.6;
  const px = d.x + d.nx * offset;
  const py = d.y + d.ny * offset;
  const yaw = Math.atan2(d.nx, d.ny);
  const baseY = cellSize / 2.5;
  const jitterY = (((d.id * 37) % 100) / 100 - 0.5) * cellSize * 0.15;

  return (
    <group
      position={[px - mapWidth / 2, baseY + jitterY, py - mapHeight / 2]}
      rotation={[0, yaw, 0]}
    >
      <mesh>
        <circleGeometry args={[d.size * 0.55, 12]} />
        <meshBasicMaterial
          ref={scorchRef}
          color="#0a0f1a"
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <ringGeometry args={[d.size * 0.28, d.size * 0.4, 16]} />
        <meshBasicMaterial
          ref={ringRef}
          color="#22d3ee"
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <circleGeometry args={[d.size * 0.18, 10]} />
        <meshBasicMaterial
          ref={coreRef}
          color="#f0abfc"
          transparent
          opacity={1}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function Decals3D({
  decals,
  cellSize,
  mapData,
}: {
  decals: WallDecal[];
  cellSize: number;
  mapData: number[][];
}) {
  const mapWidth = mapData[0].length * cellSize;
  const mapHeight = mapData.length * cellSize;
  return (
    <>
      {decals.map((d) => (
        <Decal key={d.id} d={d} cellSize={cellSize} mapWidth={mapWidth} mapHeight={mapHeight} />
      ))}
    </>
  );
}
