// @ts-nocheck
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";

const TYPE_COLOR: Record<string, string> = {
  rusher: "#e879f9",
  rifleman: "#22d3ee",
  sniper: "#fbbf24",
  titan: "#38bdf8",
  boss: "#f43f5e",
};

function useLiteMats(color: string) {
  return useMemo(() => {
    const shell = new THREE.MeshBasicMaterial({ color: "#141b2a", toneMapped: false });
    const shell2 = new THREE.MeshBasicMaterial({ color: "#273247", toneMapped: false });
    const accent = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    const visor = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
    });
    return { shell, shell2, accent, visor };
  }, [color]);
}

/**
 * Low-end enemy renderer. Memoized: the 30Hz game-state sync bails out and
 * position/scale/health are driven imperatively from the live enemy object
 * at full frame rate.
 */
export const EnemyLite = React.memo(function EnemyLite({
  live,
  type,
  cellSize,
  mapWidth,
  mapHeight,
  isBoss,
  maxHp,
}: any) {
  const outer = useRef<THREE.Group>(null);
  const root = useRef<THREE.Group>(null);
  const prevPos = useRef<THREE.Vector2 | null>(null);
  const yawRef = useRef(0);
  const color = isBoss ? TYPE_COLOR.boss : TYPE_COLOR[type];

  useFrame((state, delta) => {
    if (!outer.current || !root.current) return;
    const wx = live.x - mapWidth / 2;
    const wz = live.y - mapHeight / 2;
    outer.current.position.set(wx, (cellSize / 2) * (isBoss ? 3 : 1), wz);

    // Face movement direction (the lite renderer previously never turned)
    if (!prevPos.current) prevPos.current = new THREE.Vector2(wx, wz);
    const dx = wx - prevPos.current.x;
    const dz = wz - prevPos.current.y;
    if (live.hp > 0 && Math.hypot(dx, dz) > cellSize * 0.0015) {
      const targetYaw = Math.atan2(dx, dz);
      let diff = targetYaw - yawRef.current;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      yawRef.current += diff * Math.min(1, delta * 10);
    }
    prevPos.current.set(wx, wz);

    const sinceSpawn = (Date.now() - (live.spawnTime ?? 0)) / 1000;
    const spawnK = Math.max(0, Math.min(1, sinceSpawn / 0.45));
    // Quick collapse while the corpse lingers for the death window
    const deadK =
      live.hp <= 0 && live.diedAt ? Math.max(0, 1 - (Date.now() - live.diedAt) / 700) : 1;
    root.current.scale.setScalar(spawnK * (isBoss ? 2.5 : 1) * deadK);
    root.current.rotation.y =
      yawRef.current + Math.sin(state.clock.getElapsedTime() * (isBoss ? 0.7 : 1.6)) * 0.08;
  });

  return (
    <group
      ref={outer}
      position={[live.x - mapWidth / 2, (cellSize / 2) * (isBoss ? 3 : 1), live.y - mapHeight / 2]}
    >
      <group ref={root}>
        {isBoss ? (
          <LiteTitan cellSize={cellSize} color={color} live={live} maxHp={maxHp} />
        ) : type === "rusher" ? (
          <LiteRusher cellSize={cellSize} color={color} live={live} />
        ) : type === "sniper" ? (
          <LiteSniper cellSize={cellSize} color={color} live={live} />
        ) : (
          <LiteRifleman cellSize={cellSize} color={color} live={live} />
        )}
        <LiteHealthBar cellSize={cellSize} live={live} maxHp={maxHp} isBoss={!!isBoss} />
      </group>
    </group>
  );
});

function LiteRusher({ cellSize, color, live }: any) {
  const m = useLiteMats(color);
  const body = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!body.current) return;
    const t = state.clock.getElapsedTime();
    body.current.position.y = Math.abs(Math.sin(t * 9)) * cellSize * 0.035;
    body.current.rotation.x = 0.25 + Math.sin(t * 9) * 0.04;
  });
  const s = cellSize;
  return (
    <group ref={body}>
      <mesh material={m.shell} scale={[s * 0.45, s * 0.26, s * 0.58]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh position={[0, s * 0.16, 0]} material={m.accent} scale={[s * 0.08, s * 0.045, s * 0.55]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh
        position={[0, s * 0.05, s * 0.36]}
        material={m.visor}
        scale={[s * 0.18, s * 0.06, s * 0.025]}
      >
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      {[-1, 1].map((dx) => (
        <mesh
          key={dx}
          position={[dx * s * 0.32, 0, s * 0.08]}
          rotation={[0, 0, dx * 0.25]}
          material={m.accent}
          scale={[s * 0.04, s * 0.13, s * 0.48]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      ))}
      <GroundRing cellSize={cellSize} color={color} />
    </group>
  );
}

function LiteRifleman({ cellSize, color, live }: any) {
  const m = useLiteMats(color);
  const muzzle = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!muzzle.current) return;
    const flash = Date.now() - (live?.lastShot ?? 0) < 90;
    muzzle.current.visible = flash;
    muzzle.current.scale.setScalar(flash ? 1.5 : 1);
  });
  const s = cellSize;
  return (
    <group>
      <mesh material={m.shell} scale={[s * 0.42, s * 0.55, s * 0.3]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh position={[0, s * 0.38, 0]} material={m.shell2} scale={[s * 0.28, s * 0.2, s * 0.24]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh
        position={[0, s * 0.38, s * 0.13]}
        material={m.visor}
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
      <mesh ref={muzzle} visible={false} position={[s * 0.2, 0, s * 0.52]} material={m.accent}>
        <sphereGeometry args={[s * 0.06, 8, 8]} />
      </mesh>
      <mesh position={[0, -s * 0.36, 0]} material={m.accent} scale={[s * 0.28, s * 0.04, s * 0.12]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <GroundRing cellSize={cellSize} color={color} />
    </group>
  );
}

function LiteSniper({ cellSize, color, live }: any) {
  const m = useLiteMats(color);
  const laser = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!laser.current) return;
    const since = (Date.now() - (live?.lastShot ?? 0)) / 1000;
    laser.current.visible = since > 0.35 && since < 1.0;
  });
  const s = cellSize;
  return (
    <group>
      <mesh position={[0, s * 0.18, 0]} material={m.shell} scale={[s * 0.2, s * 0.72, s * 0.18]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh position={[0, s * 0.58, 0]} material={m.visor}>
        <sphereGeometry args={[s * 0.1, 8, 8]} />
      </mesh>
      <mesh
        position={[s * 0.14, s * 0.2, s * 0.22]}
        material={m.shell2}
        scale={[s * 0.045, s * 0.06, s * 0.8]}
      >
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh
        ref={laser}
        visible={false}
        position={[s * 0.14, s * 0.2, s * 1.2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.01, 0.01, s * 1.7, 5]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} toneMapped={false} />
      </mesh>
      <GroundRing cellSize={cellSize} color={color} />
    </group>
  );
}

function LiteTitan({ cellSize, color, live, maxHp }: any) {
  const m = useLiteMats(color);
  const core = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!core.current) return;
    const t = state.clock.getElapsedTime();
    const healthPct = Math.max(0, Math.min(1, (live?.hp ?? 0) / Math.max(1, maxHp)));
    const k = 1 + Math.sin(t * 4) * 0.08 + (1 - healthPct) * 0.35;
    core.current.scale.setScalar(k);
  });
  const s = cellSize;
  return (
    <group>
      <mesh material={m.shell} scale={[s * 0.75, s * 1.05, s * 0.65]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh ref={core} position={[0, 0, s * 0.36]} material={m.accent}>
        <sphereGeometry args={[s * 0.16, 14, 14]} />
      </mesh>
      {[-1, 1].map((dx) => (
        <mesh
          key={dx}
          position={[dx * s * 0.5, s * 0.25, 0]}
          material={m.shell2}
          scale={[s * 0.26, s * 0.38, s * 0.55]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      ))}
      <GroundRing cellSize={cellSize} color={color} boss />
    </group>
  );
}

function GroundRing({ cellSize, color, boss = false }: any) {
  return (
    <mesh position={[0, -cellSize * 0.49, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[cellSize * (boss ? 0.32 : 0.2), cellSize * (boss ? 0.42 : 0.25), 24]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.45}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function LiteHealthBar({ cellSize, live, maxHp, isBoss }: any) {
  const w = isBoss ? cellSize * 0.48 : cellSize * 0.55;
  const h = isBoss ? cellSize * 0.04 : cellSize * 0.055;
  const fillRef = useRef<THREE.Mesh>(null);
  const fillMatRef = useRef<THREE.MeshBasicMaterial>(null);

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
    <Billboard position={[0, cellSize * (isBoss ? 1.05 : 0.95), 0]}>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color="#08111f" transparent opacity={0.75} toneMapped={false} />
      </mesh>
      <mesh ref={fillRef} position={[0, 0, 0.01]}>
        <planeGeometry args={[w, h * 0.65]} />
        <meshBasicMaterial ref={fillMatRef} color="#22d3ee" toneMapped={false} />
      </mesh>
    </Billboard>
  );
}
