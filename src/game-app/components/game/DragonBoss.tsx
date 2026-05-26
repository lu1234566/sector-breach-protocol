// @ts-nocheck
import React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { EnemyModel } from './EnemyModel';
import { ENEMY_MODELS } from '../../game/modelAssets';

interface Props {
  cellSize: number;
  color: string;
  healthPct: number;
  lastShot: number;
}

/**
 * Boss renderer — now loads enemy_titan.glb ("Sapphire Dragonoid").
 * Falls back to old_titan and finally to a procedural silhouette.
 */
export function DragonBoss({ cellSize, color, healthPct, lastShot }: Props) {
  const eyeLight = React.useRef<THREE.PointLight>(null);
  useFrame((state) => {
    if (!eyeLight.current) return;
    const t = state.clock.getElapsedTime();
    eyeLight.current.intensity = 1.4 + Math.sin(t * 2.4) * 0.5 + (1 - healthPct) * 0.7;
  });

  return (
    <group>
      <EnemyModel
        modelKey="titan"
        cellSize={cellSize}
        lastShot={lastShot}
        hp={healthPct > 0 ? 1 : 0}
        Fallback={(p) => <OldTitanFallback {...p} />}
      />
      {/* Emerald eye glow */}
      <pointLight
        ref={eyeLight}
        color={ENEMY_MODELS.titan.eyeColor ?? '#22c55e'}
        intensity={1.4}
        distance={cellSize * 5}
        position={[0, cellSize * 0.7, 0]}
      />
      {/* Sapphire core pulse */}
      <pointLight
        color={color}
        intensity={1.8}
        distance={cellSize * 7}
        position={[0, cellSize * 0.4, 0]}
      />
    </group>
  );
}

/** First fallback: try the old_titan asset before the box silhouette. */
function OldTitanFallback({ cellSize, color }: { cellSize: number; color: string }) {
  return (
    <EnemyModel
      modelKey="oldTitan"
      cellSize={cellSize}
      lastShot={0}
      hp={1}
      Fallback={(p) => <BoxFallback {...p} />}
    />
  );
}

function BoxFallback({ cellSize, color }: { cellSize: number; color: string }) {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[cellSize * 0.9, cellSize * 1.4, cellSize * 0.7]} />
        <meshStandardMaterial color="#1a1f33" emissive={color} emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
    </group>
  );
}
