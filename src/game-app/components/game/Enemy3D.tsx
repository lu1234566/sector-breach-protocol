// @ts-nocheck
import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { EnemyRig } from "./EnemyRig";
import type { Enemy } from "../../game/types";

interface EnemyProps {
  /** Live enemy object mutated by the game loop — read per frame. */
  live: Enemy;
  type: "rusher" | "rifleman" | "sniper" | "titan";
  maxHp: number;
  cellSize: number;
  mapWidth: number;
  mapHeight: number;
  isBoss?: boolean;
  debug?: boolean;
}

const TYPE_COLOR: Record<string, string> = {
  rusher: "#e879f9",
  rifleman: "#22d3ee",
  sniper: "#fbbf24",
  titan: "#38bdf8",
  boss: "#38bdf8",
};

/**
 * Memoized: parent re-renders (game-state sync) bail out because every prop
 * is stable. Position, yaw, scale and health update imperatively at full
 * frame rate from the live object; React only re-renders this subtree when
 * the animation state actually transitions (idle/move/attack/death).
 */
export const Enemy3D = React.memo(function Enemy3D({
  live,
  type,
  cellSize,
  mapWidth,
  mapHeight,
  isBoss,
  maxHp,
  debug,
}: EnemyProps) {
  const outer = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const prevPos = useRef<THREE.Vector2 | null>(null);
  const speedRef = useRef(0);
  const modelKey = isBoss ? "titan" : type;
  const tColor = isBoss ? TYPE_COLOR.boss : TYPE_COLOR[type];
  const dyingProgress = useRef(0);
  const yawRef = useRef(0);
  const yawInitRef = useRef(false);

  const [animState, setAnimState] = useState<"idle" | "move" | "attack" | "death">("idle");
  const animStateRef = useRef(animState);

  useFrame((_, delta) => {
    if (!outer.current || !root.current) return;

    const wx = live.x - mapWidth / 2;
    const wz = live.y - mapHeight / 2;
    outer.current.position.set(wx, 0, wz);

    if (!prevPos.current) prevPos.current = new THREE.Vector2(wx, wz);
    const last = prevPos.current;
    const dx = wx - last.x;
    const dz = wz - last.y;
    const dist = Math.hypot(dx, dz);
    const instantSpeed = delta > 0 ? dist / delta : 0;
    speedRef.current = THREE.MathUtils.lerp(speedRef.current, instantSpeed, 0.25);
    last.set(wx, wz);

    const hp = live.hp;

    // Face movement direction (yaw around Y). Threshold prevents jitter when
    // standing still; lerp via shortest-angle path keeps rotation smooth.
    if (hp > 0 && dist > cellSize * 0.0015) {
      const targetYaw = Math.atan2(dx, dz);
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

    const sinceSpawn = (Date.now() - (live.spawnTime ?? 0)) / 1000;
    const spawnK = Math.max(0, Math.min(1, sinceSpawn / 0.55));
    root.current.scale.setScalar(spawnK);

    if (hp <= 0) {
      dyingProgress.current = Math.min(1, dyingProgress.current + delta * 2.5);
      root.current.position.y = -dyingProgress.current * cellSize * 0.5;
      root.current.scale.setScalar(spawnK * (1 - dyingProgress.current * 0.35));
    }

    // Anim state machine — re-render the rig subtree only on transitions so
    // it always receives a fresh lastShot/hp without per-tick reconciliation.
    const sinceShot = (Date.now() - (live.lastShot ?? 0)) / 1000;
    const desired =
      hp <= 0
        ? "death"
        : sinceShot < 0.22
          ? "attack"
          : speedRef.current > cellSize * 0.04
            ? "move"
            : "idle";
    if (desired !== animStateRef.current) {
      animStateRef.current = desired;
      setAnimState(desired);
    }
  });

  return (
    <group ref={outer} position={[live.x - mapWidth / 2, 0, live.y - mapHeight / 2]}>
      <group ref={root}>
        <EnemyRig
          type={type}
          isBoss={isBoss}
          cellSize={cellSize}
          color={tColor}
          animState={animState}
          hp={live.hp}
          lastShot={live.lastShot}
        />
        <HealthBar cellSize={cellSize} live={live} maxHp={maxHp} isBoss={!!isBoss} color={tColor} />
        {debug && (
          <DebugLabel
            cellSize={cellSize}
            isBoss={!!isBoss}
            modelKey={modelKey}
            animState={animState}
          />
        )}
      </group>
    </group>
  );
});

function DebugLabel({ cellSize, isBoss, modelKey, animState }: any) {
  const y = isBoss ? cellSize * 2.7 : cellSize * 1.65;
  const text = [`type: ${modelKey}`, `state: ${animState}`].join("\n");
  return (
    <Billboard position={[0, y, 0]}>
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[cellSize * 1.55, cellSize * 0.45]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <Text
        fontSize={cellSize * 0.095}
        color="#a78bfa"
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

function HealthBar({ cellSize, live, maxHp, isBoss, color }: any) {
  const w = isBoss ? cellSize * 1.1 : cellSize * 0.7;
  const h = isBoss ? cellSize * 0.06 : cellSize * 0.075;
  const y = isBoss ? cellSize * 2.05 : cellSize * 1.05;
  const fillRef = useRef<THREE.Mesh>(null);
  const fillMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // Fixed geometry; only scale/offset/color change per frame. The previous
  // version baked healthPct into planeGeometry args, rebuilding the geometry
  // on every hit.
  useFrame(() => {
    const pct = Math.max(0, Math.min(1, (live?.hp ?? 0) / Math.max(1, maxHp)));
    if (fillRef.current) {
      fillRef.current.scale.x = Math.max(pct, 0.0001);
      fillRef.current.position.x = (-w * (1 - pct)) / 2;
    }
    if (fillMatRef.current) {
      fillMatRef.current.color.set(pct > 0.6 ? "#22d3ee" : pct > 0.3 ? "#fbbf24" : "#f43f5e");
    }
  });

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
      <mesh ref={fillRef} position={[0, 0, 0.01]}>
        <planeGeometry args={[w, h * 0.7]} />
        <meshBasicMaterial ref={fillMatRef} color="#22d3ee" depthWrite={false} />
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
