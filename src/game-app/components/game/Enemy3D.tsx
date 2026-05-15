// @ts-nocheck
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Billboard } from '@react-three/drei';
import { ASSETS } from '../../game/assets';
import { useEdgeTransparentTexture } from '../../game/useEdgeTransparentTexture';

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
}

const getEnemyEmblemPath = (type: 'rusher' | 'rifleman' | 'sniper', isBoss?: boolean) => {
  if (isBoss) return ASSETS.ui.enemyTitan;
  if (type === 'rusher') return ASSETS.ui.enemyRusher;
  if (type === 'sniper') return ASSETS.ui.enemySniper;
  return ASSETS.ui.enemyRifleman;
};

export function Enemy3D({ x, y, type, color, cellSize, isBoss, hp, maxHp, debug }: EnemyProps) {
  const meshRef = useRef<THREE.Group>(null);
  const scale = isBoss ? 3 : (type === 'rusher' ? 1.05 : type === 'rifleman' ? 0.95 : 0.9);

  const healthPercent = Math.max(0, Math.min(1, hp / maxHp));
  
  const getHealthColor = () => {
    if (healthPercent > 0.6) return "#22c55e";
    if (healthPercent > 0.3) return "#eab308";
    return "#ef4444";
  };

  const healthColor = getHealthColor();

  const baseMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#475569',
    metalness: 0.6,
    roughness: 0.5,
  }), []);

  const plateMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#64748b',
    metalness: 0.4,
    roughness: 0.7,
  }), []);

  const tacticalColor = useMemo(() => {
    if (isBoss) return '#f43f5e'; 
    if (type === 'rusher') return '#ff3434'; 
    if (type === 'sniper') return '#06b6d4'; 
    return '#eab308'; 
  }, [type, isBoss]);

  const emissiveMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: tacticalColor,
    emissive: tacticalColor,
    emissiveIntensity: isBoss ? 2.2 : 1.25,
  }), [tacticalColor, isBoss]);

  const frameMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0f172a',
    metalness: 0.9,
    roughness: 0.1,
  }), []);

  const configuredEmblemTexture = useEdgeTransparentTexture(getEnemyEmblemPath(type, isBoss));

  const emblemMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    map: configuredEmblemTexture,
    transparent: true,
    alphaTest: 0.12,
    side: THREE.DoubleSide,
  }), [configuredEmblemTexture]);

  const barWidth = isBoss ? (cellSize * 0.5) : (cellSize * 0.7);
  const barHeight = isBoss ? (cellSize * 0.04) : (cellSize * 0.08);

  return (
    <group position={[x, (cellSize / 2) * scale, y]} scale={scale}>
        <group ref={meshRef}>
          {type === 'rusher' && (
            <group rotation={[0.5, 0, 0]} position={[0, -cellSize * 0.1, 0.1]}>
              <mesh castShadow material={baseMaterial}>
                <boxGeometry args={[cellSize * 0.35, cellSize * 0.25, cellSize * 0.5]} />
              </mesh>
              <mesh position={[0, cellSize * 0.08, cellSize * 0.22]} material={emissiveMaterial}>
                <boxGeometry args={[cellSize * 0.2, 0.06, 0.05]} />
              </mesh>
              <mesh position={[0, 0, -cellSize * 0.3]} material={emissiveMaterial}>
                 <sphereGeometry args={[cellSize * 0.1, 8, 8]} />
              </mesh>
            </group>
          )}

          {type === 'rifleman' && (
            <group>
              <mesh castShadow material={baseMaterial}>
                <boxGeometry args={[cellSize * 0.5, cellSize * 0.5, cellSize * 0.35]} />
              </mesh>
              <mesh position={[0, cellSize * 0.35, 0]} material={plateMaterial}>
                <boxGeometry args={[cellSize * 0.25, cellSize * 0.2, cellSize * 0.25]} />
              </mesh>
              <mesh position={[0, cellSize * 0.38, cellSize * 0.12]} material={emissiveMaterial}>
                <boxGeometry args={[cellSize * 0.18, 0.04, 0.02]} />
              </mesh>
              <mesh position={[0, 0.05, -cellSize * 0.22]} material={frameMaterial}>
                <boxGeometry args={[cellSize * 0.3, cellSize * 0.4, cellSize * 0.1]} />
              </mesh>
            </group>
          )}

          {type === 'sniper' && (
            <group position={[0, cellSize * 0.1, 0]}>
              <mesh castShadow material={baseMaterial}>
                <cylinderGeometry args={[0.04, 0.06, cellSize * 1.4, 4]} />
              </mesh>
              <group position={[0, cellSize * 0.65, 0]}>
                <mesh material={plateMaterial}>
                  <boxGeometry args={[cellSize * 0.15, cellSize * 0.12, cellSize * 0.35]} />
                </mesh>
                <mesh position={[0, 0.02, cellSize * 0.18]} material={emissiveMaterial}>
                  <sphereGeometry args={[0.03, 12, 12]} />
                </mesh>
              </group>
            </group>
          )}

          {isBoss && (
            <group>
              <mesh castShadow material={baseMaterial}>
                <boxGeometry args={[cellSize * 0.8, cellSize * 1.2, cellSize * 0.8]} />
              </mesh>
              {[-1, 1].map(x => (
                <group key={x} position={[x * cellSize * 0.5, cellSize * 0.3, 0]}>
                  <mesh material={plateMaterial}>
                    <boxGeometry args={[cellSize * 0.3, cellSize * 0.4, cellSize * 0.8]} />
                  </mesh>
                  <mesh position={[x * 0.16, 0, 0]} material={emissiveMaterial}>
                    <boxGeometry args={[0.02, cellSize * 0.3, cellSize * 0.6]} />
                  </mesh>
                </group>
              ))}
              <mesh position={[0, 0.2, cellSize * 0.4]} rotation={[Math.PI / 2, 0, 0]} material={emissiveMaterial}>
                 <cylinderGeometry args={[cellSize * 0.25, cellSize * 0.25, 0.1, 16]} />
              </mesh>
            </group>
          )}

          <Billboard position={[0, cellSize * 0.16, cellSize * 0.36]}>
            <mesh material={emblemMaterial}>
              <planeGeometry args={[cellSize * 0.22, cellSize * 0.22]} />
            </mesh>
          </Billboard>

          <group position={[cellSize * 0.3, 0, cellSize * 0.2]}>
             <mesh rotation={[Math.PI / 2, 0, 0]} material={frameMaterial}>
                <cylinderGeometry 
                  args={[
                    type === 'sniper' ? 0.015 : 0.04, 
                    type === 'sniper' ? 0.015 : 0.05, 
                    type === 'sniper' ? cellSize * 1.6 : cellSize * 0.9, 
                    8
                  ]} 
                />
             </mesh>
             <mesh position={[0, 0, type === 'sniper' ? cellSize * 0.8 : cellSize * 0.45]} rotation={[Math.PI / 2, 0, 0]} material={emissiveMaterial}>
                <cylinderGeometry args={[type === 'sniper' ? 0.02 : 0.05, type === 'sniper' ? 0.02 : 0.05, 0.02, 16]} />
             </mesh>
          </group>
        </group>

      <Billboard
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
        position={[0, cellSize * 1.2, 0]}
      >
        <group>
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[barWidth + 0.04, barHeight + 0.04]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
          </mesh>
          <mesh>
            <planeGeometry args={[barWidth, barHeight]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.8} />
          </mesh>
          <mesh position={[(-barWidth * (1 - healthPercent)) / 2, 0, 0.01]}>
            <planeGeometry args={[barWidth * healthPercent, barHeight * 0.7]} />
            <meshBasicMaterial color={healthColor} />
          </mesh>
        </group>
      </Billboard>

      {debug && (
        <Billboard position={[0, cellSize * 1.5, 0]}>
           <mesh>
             <boxGeometry args={[cellSize/4, cellSize/4, cellSize/4]} />
             <meshBasicMaterial color="#fbbf24" wireframe />
           </mesh>
           <mesh position={[0, 0, 0.01]}>
             <planeGeometry args={[cellSize/2, cellSize/6]} />
             <meshBasicMaterial color="black" transparent opacity={0.8} />
           </mesh>
        </Billboard>
      )}
    </group>
  );
}