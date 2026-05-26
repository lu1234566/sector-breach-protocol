// @ts-nocheck
import React from 'react';
import * as THREE from 'three';
import { EnemyModel } from './EnemyModel';
import { ENEMY_MODELS } from '../../game/modelAssets';

const TYPE_TO_MODEL: Record<string, keyof typeof ENEMY_MODELS> = {
  rusher: 'rusher',
  rifleman: 'rifleman',
  sniper: 'sniper',
};

const BODY_TINT: Record<string, string> = {
  rusher: '#f6c2ff',
  rifleman: '#bff8ff',
  sniper: '#ffe9a6',
};

function Fallback({ cellSize, color, type }: any) {
  const accent = BODY_TINT[type] ?? color;
  const height = type === 'sniper' ? cellSize * 0.5 : type === 'rusher' ? cellSize * 0.32 : cellSize * 0.48;
  const width = type === 'sniper' ? cellSize * 0.2 : type === 'rusher' ? cellSize * 0.42 : cellSize * 0.36;
  return (
    <group>
      <mesh position={[0, height * 0.5 - cellSize * 0.48, 0]}>
        <boxGeometry args={[width, height, width]} />
        <meshStandardMaterial
          color={accent}
          emissive={color}
          emissiveIntensity={0.55}
          roughness={0.5}
          metalness={0.2}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <pointLight color={color} intensity={0.5} distance={cellSize * 1.6} position={[0, cellSize * 0.35, 0]} />
      <mesh position={[0, -cellSize * 0.49, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[cellSize * 0.18, cellSize * 0.21, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function EnemyMesh({ type, cellSize, color, lastShot, hp }: any) {
  const modelKey = TYPE_TO_MODEL[type] ?? 'rifleman';
  const FallbackFor = (p: any) => <Fallback {...p} type={type} />;
  return (
    <EnemyModel
      modelKey={modelKey}
      cellSize={cellSize}
      lastShot={lastShot}
      hp={hp}
      Fallback={FallbackFor}
    />
  );
}
