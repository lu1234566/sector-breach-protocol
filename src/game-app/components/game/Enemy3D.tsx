// @ts-nocheck
import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { EnemyModel } from './EnemyModel';

interface EnemyProps {
  x: number;
  y: number;
  type: 'rusher' | 'rifleman' | 'sniper';
  hp: number;
  maxHp: number;
  color: string;
  cellSize: number;
  isBoss?: boolean;
  debug?: boolean;
  lastShot?: number;
  spawnTime?: number;
}

const TYPE_COLOR: Record<string, string> = {
  rusher: '#e879f9',
  rifleman: '#22d3ee',
  sniper: '#fbbf24',
  boss: '#38bdf8',
};

export function Enemy3D({
  x,
  y,
  type,
  cellSize,
  isBoss,
  hp,
  maxHp,
  lastShot = 0,
  spawnTime = 0,
}: EnemyProps) {
  const root = useRef<THREE.Group>(null);
  const prevPos = useRef(new THREE.Vector2(x, y));
  const speedRef = useRef(0);
  const modelKey = isBoss ? 'titan' : type;
  const tColor = isBoss ? TYPE_COLOR.boss : TYPE_COLOR[type];
  const healthPct = Math.max(0, Math.min(1, hp / maxHp));
  const dyingProgress = useRef(0);

  useFrame((_, delta) => {
    if (!root.current) return;

    const last = prevPos.current;
    const dist = Math.hypot(x - last.x, y - last.y);
    const instantSpeed = delta > 0 ? dist / delta : 0;
    speedRef.current = THREE.MathUtils.lerp(speedRef.current, instantSpeed, 0.25);
    last.set(x, y);

    const sinceSpawn = (Date.now() - spawnTime) / 1000;
    const spawnK = Math.max(0, Math.min(1, sinceSpawn / 0.55));
    root.current.scale.setScalar(spawnK);

    if (hp <= 0) {
      dyingProgress.current = Math.min(1, dyingProgress.current + delta * 2.5);
      root.current.position.y = -dyingProgress.current * cellSize * 0.5;
      root.current.scale.setScalar(spawnK * (1 - dyingProgress.current * 0.35));
    }
  });

  const sinceShot = (Date.now() - (lastShot ?? 0)) / 1000;
  const animState = hp <= 0 ? 'death' : sinceShot < 0.22 ? 'attack' : speedRef.current > cellSize * 0.04 ? 'move' : 'idle';

  return (
    <group position={[x, 0, y]}>
      <group ref={root}>
        <EnemyModel
          modelKey={modelKey}
          cellSize={cellSize}
          hp={hp}
          lastShot={lastShot}
          animState={animState}
          Fallback={isBoss ? TitanFallback : getFallback(type)}
        />
        <HealthBar cellSize={cellSize} healthPct={healthPct} isBoss={!!isBoss} color={tColor} />
      </group>
    </group>
  );
}

function getFallback(type: string) {
  if (type === 'rusher') return RusherFallback;
  if (type === 'sniper') return SniperFallback;
  return RiflemanFallback;
}

function HealthBar({ cellSize, healthPct, isBoss, color }: any) {
  const w = isBoss ? cellSize * 1.1 : cellSize * 0.7;
  const h = isBoss ? cellSize * 0.06 : cellSize * 0.075;
  const y = isBoss ? cellSize * 2.05 : cellSize * 1.05;
  const barColor = healthPct > 0.6 ? '#22d3ee' : healthPct > 0.3 ? '#fbbf24' : '#f43f5e';

  return (
    <Billboard position={[0, y, 0]}>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[w + 0.06, h + 0.06]} />
        <meshBasicMaterial color="#0b1220" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color="#0a0f1a" depthWrite={false} />
      </mesh>
      <mesh position={[(-w * (1 - healthPct)) / 2, 0, 0.01]}>
        <planeGeometry args={[w * healthPct, h * 0.7]} />
        <meshBasicMaterial color={barColor} depthWrite={false} />
      </mesh>
      {isBoss && (
        <mesh position={[0, -h * 1.4, 0.01]}>
          <planeGeometry args={[w * 0.72, h * 0.35]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
    </Billboard>
  );
}

function useFallbackMats(color: string) {
  return React.useMemo(() => ({
    shell: new THREE.MeshStandardMaterial({ color: '#121826', roughness: 0.62, metalness: 0.35 }),
    shell2: new THREE.MeshStandardMaterial({ color: '#273247', roughness: 0.58, metalness: 0.3 }),
    glow: new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.05, toneMapped: false }),
  }), [color]);
}

function GroundRing({ cellSize, color, boss = false }: any) {
  return (
    <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[cellSize * (boss ? 0.45 : 0.22), cellSize * (boss ? 0.55 : 0.28), 24]} />
      <meshBasicMaterial color={color} transparent opacity={0.38} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function RusherFallback({ cellSize, color }: any) {
  const m = useFallbackMats(color);
  const s = cellSize;
  return (
    <group position={[0, s * 0.28, 0]}>
      <mesh material={m.shell} scale={[s * 0.45, s * 0.26, s * 0.58]}><boxGeometry args={[1, 1, 1]} /></mesh>
      <mesh position={[0, s * 0.16, 0]} material={m.glow} scale={[s * 0.08, s * 0.05, s * 0.52]}><boxGeometry args={[1, 1, 1]} /></mesh>
      <mesh position={[0, s * 0.05, -s * 0.36]} material={m.glow} scale={[s * 0.18, s * 0.06, s * 0.025]}><boxGeometry args={[1, 1, 1]} /></mesh>
      {[-1, 1].map((dx) => (
        <mesh key={dx} position={[dx * s * 0.32, 0, -s * 0.08]} rotation={[0, 0, dx * 0.25]} material={m.glow} scale={[s * 0.04, s * 0.13, s * 0.48]}>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      ))}
      <GroundRing cellSize={s} color={color} />
    </group>
  );
}

function RiflemanFallback({ cellSize, color }: any) {
  const m = useFallbackMats(color);
  const s = cellSize;
  return (
    <group position={[0, s * 0.48, 0]}>
      <mesh material={m.shell} scale={[s * 0.42, s * 0.55, s * 0.3]}><boxGeometry args={[1, 1, 1]} /></mesh>
      <mesh position={[0, s * 0.38, 0]} material={m.shell2} scale={[s * 0.28, s * 0.2, s * 0.24]}><boxGeometry args={[1, 1, 1]} /></mesh>
      <mesh position={[0, s * 0.38, s * 0.13]} material={m.glow} scale={[s * 0.2, s * 0.045, s * 0.025]}><boxGeometry args={[1, 1, 1]} /></mesh>
      <mesh position={[s * 0.2, 0, -s * 0.18]} material={m.shell2} scale={[s * 0.06, s * 0.07, s * 0.62]}><boxGeometry args={[1, 1, 1]} /></mesh>
      <GroundRing cellSize={s} color={color} />
    </group>
  );
}

function SniperFallback({ cellSize, color }: any) {
  const m = useFallbackMats(color);
  const s = cellSize;
  return (
    <group position={[0, s * 0.52, 0]}>
      <mesh position={[0, s * 0.18, 0]} material={m.shell} scale={[s * 0.2, s * 0.72, s * 0.18]}><boxGeometry args={[1, 1, 1]} /></mesh>
      <mesh position={[0, s * 0.58, 0]} material={m.glow}><sphereGeometry args={[s * 0.1, 8, 8]} /></mesh>
      <mesh position={[s * 0.14, s * 0.2, -s * 0.22]} material={m.shell2} scale={[s * 0.045, s * 0.06, s * 0.8]}><boxGeometry args={[1, 1, 1]} /></mesh>
      <GroundRing cellSize={s} color={color} />
    </group>
  );
}

function TitanFallback({ cellSize, color }: any) {
  const m = useFallbackMats(color);
  const s = cellSize;
  return (
    <group position={[0, s * 0.9, 0]}>
      <mesh material={m.shell} scale={[s * 1.1, s * 1.5, s * 0.9]}><boxGeometry args={[1, 1, 1]} /></mesh>
      <mesh position={[0, 0, s * 0.48]} material={m.glow}><sphereGeometry args={[s * 0.18, 16, 16]} /></mesh>
      {[-1, 1].map((dx) => (
        <mesh key={dx} position={[dx * s * 0.68, s * 0.3, 0]} material={m.shell2} scale={[s * 0.32, s * 0.55, s * 0.65]}><boxGeometry args={[1, 1, 1]} /></mesh>
      ))}
      <GroundRing cellSize={s} color={color} boss />
    </group>
  );
}
