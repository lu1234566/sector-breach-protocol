// @ts-nocheck
import React from 'react';
import * as THREE from 'three';

interface Tracer {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
}

export function Tracers3D({
  tracers,
  cellSize,
  mapData,
}: {
  tracers: Tracer[];
  cellSize: number;
  mapData: number[][];
}) {
  const mapWidth = mapData[0].length * cellSize;
  const mapHeight = mapData.length * cellSize;

  return (
    <>
      {tracers.map((t) => {
        const p1 = new THREE.Vector3(t.x1 - mapWidth / 2, cellSize / 2.5, t.y1 - mapHeight / 2);
        const p2 = new THREE.Vector3(t.x2 - mapWidth / 2, cellSize / 2.5, t.y2 - mapHeight / 2);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        const distance = p1.distanceTo(p2);

        return (
          <group key={t.id} position={mid}>
            {/* Outer glow */}
            <mesh
              onUpdate={(self) => self.lookAt(p2)}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.06, 0.04, distance, 6]} />
              <meshBasicMaterial color="#22d3ee" transparent opacity={t.alpha * 0.35} />
            </mesh>
            {/* Bright core */}
            <mesh
              onUpdate={(self) => self.lookAt(p2)}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.018, 0.018, distance, 6]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={t.alpha * 0.9} />
            </mesh>
            {/* Impact spark sprite at endpoint */}
            <mesh position={p2.clone().sub(mid)}>
              <sphereGeometry args={[0.18, 8, 8]} />
              <meshBasicMaterial color="#fde68a" transparent opacity={t.alpha * 0.7} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
