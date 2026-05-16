// @ts-nocheck
import React from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { World } from './World';
import { Enemy3D } from './Enemy3D';
import { Particles3D } from './Particles3D';
import { Tracers3D } from './Tracers3D';
import { Pickups3D } from './Pickups3D';
import { Decals3D } from './Decals3D';
import { Weapon3D } from '../../Weapon3D';

import { Player, Enemy, Particle, Tracer, Pickup, WallDecal } from '../../game/types';

interface GameSceneProps {
  player: React.MutableRefObject<Player>;
  enemies: Enemy[];
  particles: Particle[];
  tracers: Tracer[];
  pickups: Pickup[];
  decals?: WallDecal[];
  mapData: number[][];
  cellSize: number;
  currentWeapon: string;
  isReloading: boolean;
  recoilOffset: number;
  screenShake: number;
  lastShotTime: number;
  debugMode?: boolean;
}

function PlayerController({
  player,
  cellSize,
  mapData,
  recoilOffset,
  screenShake,
}: {
  player: React.MutableRefObject<Player>;
  cellSize: number;
  mapData: number[][];
  recoilOffset: number;
  screenShake: number;
}) {
  const { camera } = useThree();
  const mapWidth = mapData[0].length * cellSize;
  const mapHeight = mapData.length * cellSize;

  useFrame(() => {
    camera.position.set(
      player.current.x - mapWidth / 2,
      cellSize / 1.5,
      player.current.y - mapHeight / 2,
    );

    camera.rotation.order = 'YXZ';
    camera.rotation.y = -player.current.angle - Math.PI / 2;
    const shakeY = (Math.random() - 0.5) * screenShake * 0.005;
    const shakeX = (Math.random() - 0.5) * screenShake * 0.004;
    const recoilPitch = recoilOffset * 20;
    const visualPitch = THREE.MathUtils.clamp(player.current.pitch - recoilPitch, -25, 25);
    camera.rotation.x = THREE.MathUtils.degToRad(visualPitch) + shakeY;
    camera.rotation.z = shakeX * 0.3;
  });

  return null;
}

export function GameScene({
  player,
  enemies,
  particles,
  tracers,
  mapData,
  cellSize,
  currentWeapon,
  isReloading,
  recoilOffset,
  screenShake,
  lastShotTime,
  pickups,
  decals,
  debugMode,
}: GameSceneProps) {
  const now = Date.now();
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        shadows={false}
        dpr={[0.6, 1]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <PerspectiveCamera makeDefault fov={75} />
        {/* Neon arena ambience */}
        <color attach="background" args={['#0a0e1a']} />
        <fog attach="fog" args={['#0f1730', cellSize * 12, cellSize * 34]} />

        <ambientLight intensity={0.85} color="#2d3a55" />
        <hemisphereLight intensity={0.7} groundColor="#0a0f1e" color="#7dd3fc" />
        <directionalLight position={[20, 50, 10]} intensity={0.95} color="#e0f2fe" />
        {/* Subtle rim from magenta side */}
        <directionalLight position={[-20, 30, -10]} intensity={0.45} color="#f0abfc" />

        <World mapData={mapData} cellSize={cellSize} />

        <Particles3D particles={particles} cellSize={cellSize} mapData={mapData} />
        <Tracers3D tracers={tracers} cellSize={cellSize} mapData={mapData} />
        {decals && decals.length > 0 && (
          <Decals3D decals={decals} cellSize={cellSize} mapData={mapData} now={now} />
        )}
        <Pickups3D pickups={pickups} cellSize={cellSize} mapData={mapData} />

        {enemies.map((enemy) => (
          <Enemy3D
            key={enemy.id}
            {...enemy}
            cellSize={cellSize}
            debug={debugMode}
            x={enemy.x - (mapData[0].length * cellSize) / 2}
            y={enemy.y - (mapData.length * cellSize) / 2}
          />
        ))}

        <PlayerController
          player={player}
          cellSize={cellSize}
          mapData={mapData}
          recoilOffset={recoilOffset}
          screenShake={screenShake}
        />
      </Canvas>

      <Weapon3D
        type={currentWeapon}
        isReloading={isReloading}
        isAds={player.current.isAds}
        recoilOffset={recoilOffset}
        lastShotTime={lastShotTime}
      />
    </div>
  );
}
