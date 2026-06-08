// @ts-nocheck
import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { EnemyModel } from './EnemyModel';
import { ENEMY_MODELS } from '../../game/modelAssets';

interface EnemyProps {
  x: number;
  y: number;
  type: 'rusher' | 'rifleman' | 'sniper' | 'titan';
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
  titan: '#38bdf8',
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
  debug,
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
  const yawRef = useRef(0);
  const yawInitRef = useRef(false);
  const facingOffset = (ENEMY_MODELS[modelKey]?.facingOffset ?? 0) as number;
  const debugRef = useRef({ clip: '-', usingFallback: false, hasAnimations: false, animationStatus: 'procedural', glbLoaded: false, sourceUrl: '' });
  const debugAccum = useRef(0);
  const [debugInfo, setDebugInfo] = useState({ clip: '-', usingFallback: false, hasAnimations: false, animationStatus: 'procedural', glbLoaded: false, sourceUrl: '' });

  useFrame((_, delta) => {
    if (!root.current) return;

    const last = prevPos.current;
    const dx = x - last.x;
    const dz = y - last.y;
    const dist = Math.hypot(dx, dz);
    const instantSpeed = delta > 0 ? dist / delta : 0;
    speedRef.current = THREE.MathUtils.lerp(speedRef.current, instantSpeed, 0.25);
    last.set(x, y);

    // Face movement direction (yaw around Y). Threshold prevents jitter when
    // standing still; lerp via shortest-angle path keeps rotation smooth.
    if (hp > 0 && dist > cellSize * 0.0015) {
      const targetYaw = Math.atan2(dx, dz) + facingOffset;
      if (!yawInitRef.current) {
        yawRef.current = targetYaw;
        yawInitRef.current = true;
      } else {
        let diff = targetYaw - yawRef.current;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        const k = Math.min(1, delta * 10);
        yawRef.current += diff * k;
      }
      root.current.rotation.y = yawRef.current;
    }


    const sinceSpawn = (Date.now() - spawnTime) / 1000;
    const spawnK = Math.max(0, Math.min(1, sinceSpawn / 0.55));
    root.current.scale.setScalar(spawnK);

    if (hp <= 0) {
      dyingProgress.current = Math.min(1, dyingProgress.current + delta * 2.5);
      root.current.position.y = -dyingProgress.current * cellSize * 0.5;
      root.current.scale.setScalar(spawnK * (1 - dyingProgress.current * 0.35));
    }

    if (debug) {
      debugAccum.current += delta;
      if (debugAccum.current > 0.2) {
        debugAccum.current = 0;
        const d = debugRef.current;
        if (
          d.clip !== debugInfo.clip ||
          d.usingFallback !== debugInfo.usingFallback ||
          d.hasAnimations !== debugInfo.hasAnimations ||
          d.animationStatus !== debugInfo.animationStatus
        ) {
          setDebugInfo({ ...d });
        }
      }
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
          debugRef={debug ? debugRef : undefined}
        />
        <HealthBar cellSize={cellSize} healthPct={healthPct} isBoss={!!isBoss} color={tColor} />
        {debug && (
          <DebugLabel
            cellSize={cellSize}
            isBoss={!!isBoss}
            modelKey={modelKey}
            animState={animState}
            clip={debugInfo.clip}
            usingFallback={debugInfo.usingFallback}
            hasAnimations={debugInfo.hasAnimations}
            animationStatus={debugInfo.animationStatus}
            glbLoaded={debugInfo.glbLoaded}
          />
        )}
      </group>
    </group>
  );
}

function DebugLabel({ cellSize, isBoss, modelKey, animState, clip, usingFallback, hasAnimations, animationStatus, glbLoaded }: any) {
  const y = isBoss ? cellSize * 2.7 : cellSize * 1.65;
  const status = animationStatus ?? 'procedural';
  const color = status === 'valid' ? '#22d3ee' : status === 'broken' ? '#f43f5e' : status === 'missing' ? '#fbbf24' : '#a78bfa';
  const text = [
    `model: ${modelKey}`,
    `anim: ${status}`,
    `clip: ${clip}`,
    `glb: ${glbLoaded ? 'loaded' : 'failed'} | anims: ${hasAnimations ? 'yes' : 'no'}`,
    `state: ${animState}${usingFallback ? ' [FB]' : ''}`,
  ].join('\n');
  return (
    <Billboard position={[0, y, 0]}>
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[cellSize * 1.4, cellSize * 0.7]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <Text
        fontSize={cellSize * 0.1}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.004}
        outlineColor="#000000"
      >
        {text}
      </Text>
    </Billboard>
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
