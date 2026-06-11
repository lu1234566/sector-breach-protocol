// @ts-nocheck
import React from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { World } from './World';
import { WorldLite } from './WorldLite';
import { Enemy3D } from './Enemy3D';
import { EnemyLite } from './EnemyLite';
import { Particles3D } from './Particles3D';
import { Tracers3D } from './Tracers3D';
import { Pickups3D } from './Pickups3D';
import { Decals3D } from './Decals3D';
import { ObjectiveZone3D } from './ObjectiveZone3D';
import { Weapon3D } from '../../Weapon3D';
import { resolveQuality } from '../../game/quality';
import { useSettings } from '../../game/settings';

import {
  Player,
  Enemy,
  Particle,
  Tracer,
  Pickup,
  WallDecal,
  ObjectiveRuntime,
} from '../../game/types';

interface GameSceneProps {
  player: React.MutableRefObject<Player>;
  enemies: Enemy[];
  particles: Particle[];
  tracers: Tracer[];
  pickups: Pickup[];
  decals?: WallDecal[];
  objective?: ObjectiveRuntime | null;
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
  currentWeapon,
}: {
  player: React.MutableRefObject<Player>;
  cellSize: number;
  mapData: number[][];
  recoilOffset: number;
  screenShake: number;
  currentWeapon: string;
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

    const ads = player.current.adsProgress;
    const baseFov = 75;
    let adsFov = 60;
    if (currentWeapon === 'sniper') adsFov = 22;
    else if (currentWeapon === 'rifle') adsFov = 55;
    const targetFov = baseFov + (adsFov - baseFov) * ads;
    const cam = camera as THREE.PerspectiveCamera;
    if ((cam as any).isPerspectiveCamera) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 0.18);
      cam.updateProjectionMatrix();
    }
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
  objective,
  debugMode,
}: GameSceneProps) {
  const now = Date.now();
  const [settingsState] = useSettings();
  const quality = resolveQuality(settingsState.quality);
  const isLowQuality = quality.tier === 'low';

  // Chromebook-friendly caps. These reduce React/Three object count during
  // firefights, which is usually where FPS collapses on low-end integrated GPUs.
  const visibleParticles = isLowQuality ? particles.slice(0, 18) : particles;
  const visibleTracers = isLowQuality ? tracers.slice(-8) : tracers;
  const visibleDecals = isLowQuality ? [] : decals;
  const EnemyRenderer = isLowQuality ? EnemyLite : Enemy3D;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        shadows={false}
        dpr={isLowQuality ? [0.45, 0.55] : [0.6, Math.min(quality.pixelRatio, 1)]}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        performance={{ min: isLowQuality ? 0.25 : 0.5 }}
      >
        <PerspectiveCamera makeDefault fov={75} />
        <color attach="background" args={[isLowQuality ? '#0f1724' : '#121a2a']} />
        {!isLowQuality && <fog attach="fog" args={['#16233a', cellSize * 14, cellSize * 38]} />}

        {isLowQuality ? (
          <ambientLight intensity={1.8} color="#dbeafe" />
        ) : (
          <>
            <ambientLight intensity={1.4} color="#b8d8ff" />
            <hemisphereLight intensity={1.0} groundColor="#3a4f74" color="#ffffff" />
            <directionalLight position={[20, 50, 10]} intensity={1.7} color="#ffffff" />
          </>
        )}

        {isLowQuality ? <WorldLite mapData={mapData} cellSize={cellSize} /> : <World mapData={mapData} cellSize={cellSize} propsDensity={quality.propsDensity} />}

        <Particles3D particles={visibleParticles} cellSize={cellSize} mapData={mapData} />
        <Tracers3D tracers={visibleTracers} cellSize={cellSize} mapData={mapData} />
        {visibleDecals && visibleDecals.length > 0 && (
          <Decals3D decals={visibleDecals} cellSize={cellSize} mapData={mapData} now={now} />
        )}
        {objective && objective.zone && objective.status === 'active' && (
          <ObjectiveZone3D objective={objective} cellSize={cellSize} mapData={mapData} />
        )}
        {!isLowQuality && <Pickups3D pickups={pickups} cellSize={cellSize} mapData={mapData} />}
        {isLowQuality && pickups.length > 0 && <Pickups3D pickups={pickups.slice(0, 6)} cellSize={cellSize} mapData={mapData} />}

        {enemies.map((enemy) => (
          <EnemyRenderer
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
          currentWeapon={currentWeapon}
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
