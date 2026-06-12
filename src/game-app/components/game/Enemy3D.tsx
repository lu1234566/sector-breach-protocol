// @ts-nocheck
import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { EnemyRig } from "./EnemyRig";
import { EnemyModel } from "./EnemyModel";
import { ENEMY_MODELS } from "../../game/modelAssets";
import { useSettings } from "../../game/settings";
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
 * Memoized: parent re-renders (30Hz game-state sync) bail out because every
 * prop is stable. Position, yaw, scale and health update imperatively at
 * full frame rate from the live object; React only re-renders this subtree
 * when the animation state actually transitions (idle/move/attack/death).
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
  const [settings] = useSettings();
  const outer = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const prevPos = useRef<THREE.Vector2 | null>(null);
  const speedRef = useRef(0);
  const modelKey = isBoss ? "titan" : type;
  const tColor = isBoss ? TYPE_COLOR.boss : TYPE_COLOR[type];
  const dyingProgress = useRef(0);
  const yawRef = useRef(0);
  const yawInitRef = useRef(false);
  const facingOffset = (ENEMY_MODELS[modelKey]?.facingOffset ?? 0) as number;

  const [animState, setAnimState] = useState<"idle" | "move" | "attack" | "death">("idle");
  const animStateRef = useRef(animState);

  const debugRef = useRef({
    clip: "-",
    usingFallback: false,
    hasAnimations: false,
    animationStatus: "procedural",
    glbLoaded: false,
    sourceUrl: "",
    rootMotion: "lockXZ",
  });
  const debugAccum = useRef(0);
  const [debugInfo, setDebugInfo] = useState({
    clip: "-",
    usingFallback: false,
    hasAnimations: false,
    animationStatus: "procedural",
    glbLoaded: false,
    sourceUrl: "",
    rootMotion: "lockXZ",
  });

  const requestedMode = settings.enemyVisualMode ?? "auto";
  // Stable default: Auto currently means procedural rig. Force GLB only when
  // testing animation/positioning with enemyVisualMode='glb'.
  const visualMode = requestedMode === "glb" ? "glb" : "rig";

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

    const sinceSpawn = (Date.now() - (live.spawnTime ?? 0)) / 1000;
    const spawnK = Math.max(0, Math.min(1, sinceSpawn / 0.55));
    root.current.scale.setScalar(spawnK);

    if (hp <= 0) {
      dyingProgress.current = Math.min(1, dyingProgress.current + delta * 2.5);
      root.current.position.y = -dyingProgress.current * cellSize * 0.5;
      root.current.scale.setScalar(spawnK * (1 - dyingProgress.current * 0.35));
    }

    // Anim state machine — re-render the rig subtree only on transitions so
    // it always receives a fresh lastShot/hp without 30Hz reconciliation.
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

    if (debug && visualMode === "glb") {
      debugAccum.current += delta;
      if (debugAccum.current > 0.2) {
        debugAccum.current = 0;
        const d = debugRef.current;
        if (
          d.clip !== debugInfo.clip ||
          d.usingFallback !== debugInfo.usingFallback ||
          d.hasAnimations !== debugInfo.hasAnimations ||
          d.animationStatus !== debugInfo.animationStatus ||
          d.rootMotion !== debugInfo.rootMotion ||
          d.sourceUrl !== debugInfo.sourceUrl
        ) {
          setDebugInfo({ ...d });
        }
      }
    }
  });

  return (
    <group ref={outer} position={[live.x - mapWidth / 2, 0, live.y - mapHeight / 2]}>
      <group ref={root}>
        {visualMode === "glb" ? (
          <EnemyModel
            modelKey={modelKey}
            cellSize={cellSize}
            hp={live.hp}
            lastShot={live.lastShot}
            animState={animState}
            Fallback={isBoss ? TitanFallback : getFallback(type)}
            debugRef={debug ? debugRef : undefined}
          />
        ) : (
          <EnemyRig
            type={type}
            isBoss={isBoss}
            cellSize={cellSize}
            color={tColor}
            animState={animState}
            hp={live.hp}
            lastShot={live.lastShot}
          />
        )}
        <HealthBar cellSize={cellSize} live={live} maxHp={maxHp} isBoss={!!isBoss} color={tColor} />
        {debug && (
          <DebugLabel
            cellSize={cellSize}
            isBoss={!!isBoss}
            modelKey={modelKey}
            animState={animState}
            visualMode={visualMode}
            requestedMode={requestedMode}
            clip={visualMode === "glb" ? debugInfo.clip : "procedural parts"}
            usingFallback={visualMode === "glb" ? debugInfo.usingFallback : false}
            hasAnimations={visualMode === "glb" ? debugInfo.hasAnimations : false}
            animationStatus={visualMode === "glb" ? debugInfo.animationStatus : "procedural"}
            glbLoaded={visualMode === "glb" ? debugInfo.glbLoaded : false}
            rootMotion={visualMode === "glb" ? debugInfo.rootMotion : "-"}
          />
        )}
      </group>
    </group>
  );
});

function DebugLabel({
  cellSize,
  isBoss,
  modelKey,
  animState,
  visualMode,
  requestedMode,
  clip,
  usingFallback,
  hasAnimations,
  animationStatus,
  glbLoaded,
  rootMotion,
}: any) {
  const y = isBoss ? cellSize * 2.7 : cellSize * 1.65;
  const status = animationStatus ?? (visualMode === "rig" ? "procedural" : "-");
  const color =
    visualMode === "glb"
      ? status === "valid"
        ? "#22d3ee"
        : status === "broken"
          ? "#f43f5e"
          : status === "missing"
            ? "#fbbf24"
            : "#a78bfa"
      : "#a78bfa";
  const text =
    visualMode === "glb"
      ? [
          `type: ${modelKey}`,
          `mode: GLB (requested: ${requestedMode})`,
          `anim: ${status}`,
          `clip: ${clip}`,
          `root: ${rootMotion ?? "-"}`,
          `glb: ${glbLoaded ? "loaded" : "failed"} | anims: ${hasAnimations ? "yes" : "no"}`,
          `state: ${animState}${usingFallback ? " [FB]" : ""}`,
        ].join("\n")
      : [
          `type: ${modelKey}`,
          `mode: procedural rig (requested: ${requestedMode})`,
          `state: ${animState}`,
        ].join("\n");
  return (
    <Billboard position={[0, y, 0]}>
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry
          args={[cellSize * 1.55, visualMode === "glb" ? cellSize * 0.78 : cellSize * 0.45]}
        />
        <meshBasicMaterial color="#000000" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <Text
        fontSize={cellSize * 0.095}
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
  if (type === "rusher") return RusherFallback;
  if (type === "sniper") return SniperFallback;
  return RiflemanFallback;
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

function useFallbackMats(color: string) {
  return React.useMemo(
    () => ({
      shell: new THREE.MeshStandardMaterial({ color: "#121826", roughness: 0.62, metalness: 0.35 }),
      shell2: new THREE.MeshStandardMaterial({ color: "#273247", roughness: 0.58, metalness: 0.3 }),
      glow: new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.05,
        toneMapped: false,
      }),
    }),
    [color],
  );
}

function GroundRing({ cellSize, color, boss = false }: any) {
  return (
    <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[cellSize * (boss ? 0.45 : 0.22), cellSize * (boss ? 0.55 : 0.28), 24]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.38}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function RusherFallback({ cellSize, color }: any) {
  const m = useFallbackMats(color);
  const s = cellSize;
  return (
    <group position={[0, s * 0.28, 0]}>
      <mesh material={m.shell} scale={[s * 0.45, s * 0.26, s * 0.58]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh position={[0, s * 0.16, 0]} material={m.glow} scale={[s * 0.08, s * 0.05, s * 0.52]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh
        position={[0, s * 0.05, s * 0.36]}
        material={m.glow}
        scale={[s * 0.18, s * 0.06, s * 0.025]}
      >
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      {[-1, 1].map((dx) => (
        <mesh
          key={dx}
          position={[dx * s * 0.32, 0, s * 0.08]}
          rotation={[0, 0, dx * 0.25]}
          material={m.glow}
          scale={[s * 0.04, s * 0.13, s * 0.48]}
        >
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
      <mesh material={m.shell} scale={[s * 0.42, s * 0.55, s * 0.3]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh position={[0, s * 0.38, 0]} material={m.shell2} scale={[s * 0.28, s * 0.2, s * 0.24]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh
        position={[0, s * 0.38, s * 0.13]}
        material={m.glow}
        scale={[s * 0.2, s * 0.045, s * 0.025]}
      >
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh
        position={[s * 0.2, 0, s * 0.18]}
        material={m.shell2}
        scale={[s * 0.06, s * 0.07, s * 0.62]}
      >
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <GroundRing cellSize={s} color={color} />
    </group>
  );
}

function SniperFallback({ cellSize, color }: any) {
  const m = useFallbackMats(color);
  const s = cellSize;
  return (
    <group position={[0, s * 0.52, 0]}>
      <mesh position={[0, s * 0.18, 0]} material={m.shell} scale={[s * 0.2, s * 0.72, s * 0.18]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh position={[0, s * 0.58, 0]} material={m.glow}>
        <sphereGeometry args={[s * 0.1, 8, 8]} />
      </mesh>
      <mesh
        position={[s * 0.14, s * 0.2, s * 0.22]}
        material={m.shell2}
        scale={[s * 0.045, s * 0.06, s * 0.8]}
      >
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <GroundRing cellSize={s} color={color} />
    </group>
  );
}

function TitanFallback({ cellSize, color }: any) {
  const m = useFallbackMats(color);
  const s = cellSize;
  return (
    <group position={[0, s * 0.9, 0]}>
      <mesh material={m.shell} scale={[s * 1.1, s * 1.5, s * 0.9]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh position={[0, 0, s * 0.48]} material={m.glow}>
        <sphereGeometry args={[s * 0.18, 16, 16]} />
      </mesh>
      {[-1, 1].map((dx) => (
        <mesh
          key={dx}
          position={[dx * s * 0.68, s * 0.3, 0]}
          material={m.shell2}
          scale={[s * 0.32, s * 0.55, s * 0.65]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      ))}
      <GroundRing cellSize={s} color={color} boss />
    </group>
  );
}
