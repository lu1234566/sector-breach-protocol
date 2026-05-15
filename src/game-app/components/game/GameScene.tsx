// @ts-nocheck
import React from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { World } from './World';
import { Enemy3D } from './Enemy3D';
import { Particles3D } from './Particles3D';
import { Tracers3D } from './Tracers3D';
import { Pickups3D } from './Pickups3D';
import { Weapon3D } from '../../Weapon3D';

import { 
  Player, 
  Enemy, 
  Particle, 
  Tracer, 
  Pickup 
} from '../../game/types';

interface GameSceneProps {
  player: React.MutableRefObject<Player>;
  enemies: Enemy[];
  particles: Particle[];
  tracers: Tracer[];
  pickups: Pickup[];
  mapData: number[][];
  cellSize: number;
  currentWeapon: string;
  isReloading: boolean;
  recoilOffset: number;
  screenShake: number;
  lastShotTime: number;
  debugMode?: boolean;
}

function PlayerController({ player, cellSize, mapData, recoilOffset, screenShake }: { 
  player: React.MutableRefObject<Player>, 
  cellSize: number, 
  mapData: number[][],
  recoilOffset: number,
  screenShake: number
}) {
  const { camera } = useThree();
  const mapWidth = mapData[0].length * cellSize;
  const mapHeight = mapData.length * cellSize;

  useFrame(() => {
    camera.position.set(
      player.current.x - (mapWidth / 2),
      cellSize / 1.5, // Eye height
      player.current.y - (mapHeight / 2)
    );

    // Rotation - Order is important for FPS
    camera.rotation.order = 'YXZ';
    camera.rotation.y = -player.current.angle - Math.PI / 2;
    
    // Pitch (Vertical rotation)
    // Combine base pitch with visual offsets (recoil and shake)
    const shakeY = (Math.random() - 0.5) * screenShake * 0.005;
    const recoilPitch = recoilOffset * 20;
    // Clamp the final visual pitch to avoid extreme camera angles
    const visualPitch = THREE.MathUtils.clamp(player.current.pitch - recoilPitch, -25, 25);
    camera.rotation.x = THREE.MathUtils.degToRad(visualPitch) + shakeY;
    camera.rotation.z = 0; // Lock roll
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
  debugMode,
}: GameSceneProps) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas 
        shadows={false} 
        dpr={[0.6, 1]} 
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <PerspectiveCamera makeDefault fov={75} />
        <ambientLight intensity={0.7} />
        <hemisphereLight intensity={0.5} groundColor="#020617" color="#67e8f9" />
        <directionalLight position={[20, 50, 10]} intensity={0.7} color="#cffafe" />
        <fog attach="fog" args={['#020617', cellSize * 12, cellSize * 35]} />

        <World mapData={mapData} cellSize={cellSize} />

        <Particles3D particles={particles} cellSize={cellSize} mapData={mapData} />
        <Tracers3D tracers={tracers} cellSize={cellSize} mapData={mapData} />
        <Pickups3D pickups={pickups} cellSize={cellSize} mapData={mapData} />

        {enemies.map((enemy) => (
           <Enemy3D 
            key={enemy.id} 
            {...enemy} 
            cellSize={cellSize} 
            debug={debugMode}
            // Correct coordinate transform
            x={enemy.x - (mapData[0].length * cellSize / 2)}
            y={enemy.y - (mapData.length * cellSize / 2)}
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

      {/* Overlay the Weapon UI Component - keeps it fixed and easy to handle HUD-wise */}
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