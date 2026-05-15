// @ts-nocheck
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  life: number;
  vx: number;
  vy: number;
}

export function Particles3D({ particles, cellSize, mapData }: { particles: Particle[], cellSize: number, mapData: number[][] }) {
  const mapWidth = mapData[0].length * cellSize;
  const mapHeight = mapData.length * cellSize;

  return (
    <>
      {particles.map((p, i) => (
        <mesh 
          key={i} 
          position={[p.x - mapWidth / 2, cellSize / 3, p.y - mapHeight / 2]}
        >
          {p.color === '#fef08a' ? (
            <sphereGeometry args={[p.size / 8, 4, 4]} />
          ) : (
            <boxGeometry args={[p.size / 6, p.size / 6, p.size / 6]} />
          )}
          <meshBasicMaterial 
            color={p.color} 
            transparent 
            opacity={p.life * 0.7} 
          />
        </mesh>
      ))}
    </>
  );
}