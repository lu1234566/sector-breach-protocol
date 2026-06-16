// @ts-nocheck
import React, { Suspense, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { World } from "./World";
import { WorldLite } from "./WorldLite";
import { Enemy3D } from "./Enemy3D";
import { EnemyLite } from "./EnemyLite";
import { Particles3D } from "./Particles3D";
import { Tracers3D } from "./Tracers3D";
import { Pickups3D } from "./Pickups3D";
import { Decals3D } from "./Decals3D";
import { ObjectiveZone3D } from "./ObjectiveZone3D";
import { Weapon3D } from "../../Weapon3D";
import { resolveQuality } from "../../game/quality";
import { useSettings } from "../../game/settings";
import { PerfProbe, PerfHud, usePerfHudEnabled } from "./PerfHud";

import {
  Player,
  Enemy,
  Particle,
  Tracer,
  Pickup,
  WallDecal,
  ObjectiveRuntime,
} from "../../game/types";

interface GameSceneProps {
  player: React.MutableRefObject<Player>;
  enemies: Enemy[];
  particlesRef: React.MutableRefObject<Particle[]>;
  tracersRef: React.MutableRefObject<Tracer[]>;
  pickups: Pickup[];
  decals?: WallDecal[];
  objective?: ObjectiveRuntime | null;
  mapData: number[][];
  cellSize: number;
  currentWeapon: string;
  isReloading: boolean;
  recoilOffsetRef: React.MutableRefObject<number>;
  screenShakeRef: React.MutableRefObject<number>;
  lastShotTimeRef: React.MutableRefObject<number>;
  debugMode?: boolean;
  /** When true, gameplay simulation is suspended (pause menu, settings,
   *  death screen still mounted). The Canvas drops to demand frameloop so
   *  the GPU stops burning frames behind a modal. */
  paused?: boolean;
}

function PlayerController({
  player,
  cellSize,
  mapData,
  recoilOffsetRef,
  screenShakeRef,
  currentWeapon,
}: {
  player: React.MutableRefObject<Player>;
  cellSize: number;
  mapData: number[][];
  recoilOffsetRef: React.MutableRefObject<number>;
  screenShakeRef: React.MutableRefObject<number>;
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

    camera.rotation.order = "YXZ";
    camera.rotation.y = -player.current.angle - Math.PI / 2;
    // Shake/recoil read from refs at full frame rate — previously these were
    // props sampled at the 30Hz React sync, so the kick felt steppy.
    const screenShake = screenShakeRef.current;
    const shakeY = (Math.random() - 0.5) * screenShake * 0.005;
    const shakeX = (Math.random() - 0.5) * screenShake * 0.004;
    const recoilPitch = recoilOffsetRef.current * 20;
    const visualPitch = THREE.MathUtils.clamp(player.current.pitch - recoilPitch, -25, 25);
    camera.rotation.x = THREE.MathUtils.degToRad(visualPitch) + shakeY;
    camera.rotation.z = shakeX * 0.3;

    const ads = player.current.adsProgress;
    const baseFov = 75;
    let adsFov = 60;
    if (currentWeapon === "sniper") adsFov = 22;
    else if (currentWeapon === "rifle") adsFov = 55;
    const targetFov = baseFov + (adsFov - baseFov) * ads;
    const cam = camera as THREE.PerspectiveCamera;
    if ((cam as any).isPerspectiveCamera) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 0.18);
      cam.updateProjectionMatrix();
    }
  });

  return null;
}

export const GameScene = React.memo(function GameScene({
  player,
  enemies,
  particlesRef,
  tracersRef,
  mapData,
  cellSize,
  currentWeapon,
  isReloading,
  recoilOffsetRef,
  screenShakeRef,
  lastShotTimeRef,
  pickups,
  decals,
  objective,
  debugMode,
  paused,
}: GameSceneProps) {
  const [settingsState] = useSettings();
  const quality = resolveQuality(settingsState.quality);
  const isLowQuality = quality.tier === "low";
  const mapWidth = mapData[0].length * cellSize;
  const mapHeight = mapData.length * cellSize;

  // Chromebook-friendly caps. These reduce React/Three object count during
  // firefights, which is usually where FPS collapses on low-end integrated GPUs.
  const visibleDecals = isLowQuality ? [] : decals;
  const EnemyRenderer = isLowQuality ? EnemyLite : Enemy3D;

  const perfEnabled = usePerfHudEnabled();
  const [perfSample, setPerfSample] = useState<{
    fps: number;
    calls: number;
    triangles: number;
  } | null>(null);

  // Hard DPR caps per tier — never let auto-DPR reach 2.
  // Low ≤ 0.75, medium ≤ 1.0, high ≤ 1.25.
  const dprCap = isLowQuality ? 0.75 : quality.tier === "medium" ? 1.0 : 1.25;
  const dprFloor = isLowQuality ? 0.5 : 0.6;
  const dpr: [number, number] = [dprFloor, Math.min(dprCap, quality.pixelRatio)];

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        shadows={false}
        dpr={dpr}
        // When the player opens any modal (pause/settings/death), drop to
        // demand frameloop. The scene stays mounted (no GLB re-load on resume)
        // but the GPU stops re-rendering the same frame at 60 Hz behind UI.
        frameloop={paused ? "demand" : "always"}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        performance={{ min: isLowQuality ? 0.25 : 0.5 }}
      >
        {perfEnabled && <PerfProbe onSample={setPerfSample} />}
        <PerspectiveCamera makeDefault fov={75} />
        <color attach="background" args={[isLowQuality ? "#0f1724" : "#121a2a"]} />
        {!isLowQuality && <fog attach="fog" args={["#16233a", cellSize * 14, cellSize * 38]} />}

        {isLowQuality ? (
          <ambientLight intensity={1.8} color="#dbeafe" />
        ) : (
          <>
            <ambientLight intensity={1.4} color="#b8d8ff" />
            <hemisphereLight intensity={1.0} groundColor="#3a4f74" color="#ffffff" />
            <directionalLight position={[20, 50, 10]} intensity={1.7} color="#ffffff" />
          </>
        )}

        {/* Suspense boundary INSIDE the canvas: texture/GLB loads (World,
            Pickups, props) suspend here with no visible fallback instead of
            bubbling to the route-level Suspense, which would unmount and
            remount the entire game (the "loading screen" flash on first
            pickup, plus the resource leak that tanked FPS). */}
        <Suspense fallback={null}>
          {isLowQuality ? (
            <WorldLite mapData={mapData} cellSize={cellSize} />
          ) : (
            <World mapData={mapData} cellSize={cellSize} propsDensity={quality.propsDensity} />
          )}

          {/* Always mounted so it never suspends mid-match when the first
              pickup drops. */}
          <Pickups3D
            pickups={isLowQuality ? pickups.slice(0, 6) : pickups}
            cellSize={cellSize}
            mapData={mapData}
          />
        </Suspense>

        <Particles3D
          particlesRef={particlesRef}
          cellSize={cellSize}
          mapWidth={mapWidth}
          mapHeight={mapHeight}
        />
        <Tracers3D
          tracersRef={tracersRef}
          cellSize={cellSize}
          mapWidth={mapWidth}
          mapHeight={mapHeight}
        />
        {visibleDecals && visibleDecals.length > 0 && (
          <Decals3D decals={visibleDecals} cellSize={cellSize} mapData={mapData} />
        )}
        {objective && objective.zone && objective.status === "active" && (
          <ObjectiveZone3D objective={objective} cellSize={cellSize} mapData={mapData} />
        )}

        {enemies.map((enemy) => (
          <EnemyRenderer
            key={enemy.id}
            live={enemy}
            type={enemy.type}
            isBoss={enemy.isBoss}
            maxHp={enemy.maxHp}
            cellSize={cellSize}
            mapWidth={mapWidth}
            mapHeight={mapHeight}
            debug={debugMode}
          />
        ))}

        <PlayerController
          player={player}
          cellSize={cellSize}
          mapData={mapData}
          recoilOffsetRef={recoilOffsetRef}
          screenShakeRef={screenShakeRef}
          currentWeapon={currentWeapon}
        />
      </Canvas>

      <Weapon3D
        type={currentWeapon}
        isReloading={isReloading}
        playerRef={player}
        recoilOffsetRef={recoilOffsetRef}
        lastShotTimeRef={lastShotTimeRef}
      />

      {perfEnabled && (
        <PerfHud
          enemies={enemies.length}
          particles={particlesRef.current?.length ?? 0}
          qualityTier={quality.tier}
          paused={!!paused}
          sample={perfSample}
        />
      )}
    </div>
  );
});
