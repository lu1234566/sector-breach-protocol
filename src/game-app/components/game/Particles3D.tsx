// @ts-nocheck
import React from "react";
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

export function Particles3D({
  particles,
  cellSize,
  mapData,
}: {
  particles: Particle[];
  cellSize: number;
  mapData: number[][];
}) {
  const mapWidth = mapData[0].length * cellSize;
  const mapHeight = mapData.length * cellSize;

  return (
    <>
      {particles.map((p) => {
        const isShell = p.color === "#fef08a" || p.color === "#fbbf24";
        return (
          <mesh
            key={p.id}
            position={[
              p.x - mapWidth / 2,
              cellSize / 3 + (1 - p.life) * cellSize * 0.2,
              p.y - mapHeight / 2,
            ]}
          >
            {isShell ? (
              <sphereGeometry args={[p.size / 7, 6, 6]} />
            ) : (
              <boxGeometry args={[p.size / 5, p.size / 5, p.size / 5]} />
            )}
            <meshBasicMaterial color={p.color} transparent opacity={p.life * 0.85} />
          </mesh>
        );
      })}
    </>
  );
}
