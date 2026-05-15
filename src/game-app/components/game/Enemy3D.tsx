// @ts-nocheck
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Billboard } from '@react-three/drei';

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
  rusher: '#e879f9',     // magenta
  rifleman: '#22d3ee',   // cyan
  sniper: '#fbbf24',     // amber
  boss: '#f43f5e',       // danger red-pink (titan core)
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
  const tColor = isBoss ? TYPE_COLOR.boss : TYPE_COLOR[type];
  const healthPct = Math.max(0, Math.min(1, hp / maxHp));

  // Death dissolve when hp drops below 0
  const dyingProgress = useRef(0);

  useFrame((state, delta) => {
    if (!root.current) return;
    const t = state.clock.getElapsedTime();
    // Spawn rise animation
    const sinceSpawn = (Date.now() - spawnTime) / 1000;
    const spawnK = Math.max(0, Math.min(1, sinceSpawn / 0.6));
    root.current.scale.setScalar(spawnK);

    // Death dissolve
    if (hp <= 0) {
      dyingProgress.current = Math.min(1, dyingProgress.current + delta * 2.5);
      root.current.position.y = -dyingProgress.current * cellSize * 0.5;
      root.current.scale.setScalar(spawnK * (1 - dyingProgress.current * 0.4));
    }
  });

  return (
    <group position={[x, (cellSize / 2) * (isBoss ? 3 : 1), y]} scale={isBoss ? 2.6 : 1}>
      <group ref={root}>
        {!isBoss && type === 'rusher' && <RusherBody cellSize={cellSize} color={tColor} lastShot={lastShot} />}
        {!isBoss && type === 'rifleman' && <RiflemanBody cellSize={cellSize} color={tColor} lastShot={lastShot} />}
        {!isBoss && type === 'sniper' && <SniperBody cellSize={cellSize} color={tColor} lastShot={lastShot} />}
        {isBoss && <TitanBody cellSize={cellSize} color={tColor} healthPct={healthPct} lastShot={lastShot} />}

        <HealthBar cellSize={cellSize} healthPct={healthPct} isBoss={!!isBoss} />
      </group>
    </group>
  );
}

/* ----------------------------- Health Bar ----------------------------- */
function HealthBar({ cellSize, healthPct, isBoss }: any) {
  const w = isBoss ? cellSize * 0.55 : cellSize * 0.7;
  const h = isBoss ? cellSize * 0.05 : cellSize * 0.08;
  const color = healthPct > 0.6 ? '#22d3ee' : healthPct > 0.3 ? '#fbbf24' : '#f43f5e';
  return (
    <Billboard position={[0, cellSize * 1.25, 0]}>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[w + 0.06, h + 0.06]} />
        <meshBasicMaterial color="#0b1220" transparent opacity={0.85} />
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color="#0a0f1a" />
      </mesh>
      <mesh position={[(-w * (1 - healthPct)) / 2, 0, 0.01]}>
        <planeGeometry args={[w * healthPct, h * 0.7]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </Billboard>
  );
}

/* ----------------------------- Materials ----------------------------- */
function useEnemyMats(color: string) {
  return useMemo(() => {
    return {
      shell: new THREE.MeshStandardMaterial({
        color: '#1a1f2e',
        metalness: 0.55,
        roughness: 0.55,
      }),
      shellMid: new THREE.MeshStandardMaterial({
        color: '#2a3145',
        metalness: 0.45,
        roughness: 0.6,
      }),
      neon: new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 1.4,
      }),
      neonSoft: new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.6,
      }),
      visor: new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 1.8,
        transparent: true,
        opacity: 0.85,
      }),
    };
  }, [color]);
}

/* ----------------------------- Rusher ----------------------------- */
function RusherBody({ cellSize, color, lastShot }: any) {
  const m = useEnemyMats(color);
  const groupRef = useRef<THREE.Group>(null);
  const flareRef = useRef<THREE.Mesh>(null);
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const since = (Date.now() - lastShot) / 1000;
    // Telegraph: pulse magenta when about to attack (last attack > 1s ago and < 1.5s ago)
    const pulse = since > 1 && since < 1.5 ? 1 : 0.3;
    if (flareRef.current) {
      const k = pulse + Math.sin(t * 12) * 0.15 * pulse;
      (flareRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.0 + k * 1.2;
      flareRef.current.scale.setScalar(0.9 + k * 0.2);
    }
    // Walking
    const step = Math.sin(t * 9) * 0.12;
    if (leftLeg.current) leftLeg.current.position.z = step;
    if (rightLeg.current) rightLeg.current.position.z = -step;
    if (groupRef.current) {
      groupRef.current.rotation.x = -0.25 + Math.abs(step) * 0.3;
      groupRef.current.position.y = Math.abs(Math.sin(t * 9)) * 0.1;
    }
  });

  const s = cellSize;
  return (
    <group ref={groupRef}>
      {/* Crouched torso, leaning forward */}
      <mesh material={m.shell}>
        <boxGeometry args={[s * 0.42, s * 0.32, s * 0.55]} />
      </mesh>
      {/* Spine ridge magenta */}
      <mesh ref={flareRef} position={[0, s * 0.18, 0]} material={m.neon}>
        <boxGeometry args={[s * 0.08, s * 0.06, s * 0.5]} />
      </mesh>
      {/* Two blade arms */}
      {[-1, 1].map((dx) => (
        <group key={dx} position={[dx * s * 0.28, s * 0.05, s * 0.1]}>
          <mesh material={m.shellMid}>
            <boxGeometry args={[s * 0.1, s * 0.12, s * 0.4]} />
          </mesh>
          {/* Blade */}
          <mesh position={[dx * s * 0.06, 0, -s * 0.35]} rotation={[0, 0, dx * 0.2]} material={m.neon}>
            <boxGeometry args={[s * 0.04, s * 0.18, s * 0.4]} />
          </mesh>
        </group>
      ))}
      {/* Head — small forward visor */}
      <mesh position={[0, s * 0.05, -s * 0.32]} material={m.shell}>
        <boxGeometry args={[s * 0.22, s * 0.18, s * 0.18]} />
      </mesh>
      <mesh position={[0, s * 0.07, -s * 0.42]} material={m.visor}>
        <boxGeometry args={[s * 0.16, s * 0.04, s * 0.02]} />
      </mesh>
      {/* Legs */}
      <mesh ref={leftLeg} position={[-s * 0.12, -s * 0.3, 0]} material={m.shell}>
        <boxGeometry args={[s * 0.12, s * 0.35, s * 0.18]} />
      </mesh>
      <mesh ref={rightLeg} position={[s * 0.12, -s * 0.3, 0]} material={m.shell}>
        <boxGeometry args={[s * 0.12, s * 0.35, s * 0.18]} />
      </mesh>
      {/* Glow point light for arena pop */}
      <pointLight color={color} intensity={0.6} distance={s * 1.4} position={[0, 0, 0]} />
    </group>
  );
}

/* ----------------------------- Rifleman ----------------------------- */
function RiflemanBody({ cellSize, color, lastShot }: any) {
  const m = useEnemyMats(color);
  const muzzle = useRef<THREE.Mesh>(null);
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const since = (Date.now() - lastShot) / 1000;
    if (muzzle.current) {
      const flash = since < 0.08 ? 1 : 0;
      (muzzle.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + flash * 5;
      muzzle.current.scale.setScalar(1 + flash * 1.5);
    }
    const step = Math.sin(t * 6) * 0.08;
    if (leftLeg.current) leftLeg.current.position.z = step;
    if (rightLeg.current) rightLeg.current.position.z = -step;
  });

  const s = cellSize;
  return (
    <group>
      {/* Boxy torso */}
      <mesh material={m.shell}>
        <boxGeometry args={[s * 0.5, s * 0.5, s * 0.32]} />
      </mesh>
      {/* Chest plate cyan trim */}
      <mesh position={[0, 0, s * 0.17]} material={m.neonSoft}>
        <boxGeometry args={[s * 0.36, s * 0.08, s * 0.02]} />
      </mesh>
      {/* Wide shoulders */}
      {[-1, 1].map((dx) => (
        <mesh key={dx} position={[dx * s * 0.32, s * 0.18, 0]} material={m.shellMid}>
          <boxGeometry args={[s * 0.16, s * 0.16, s * 0.3]} />
        </mesh>
      ))}
      {/* Helmet */}
      <mesh position={[0, s * 0.36, 0]} material={m.shellMid}>
        <boxGeometry args={[s * 0.28, s * 0.22, s * 0.28]} />
      </mesh>
      {/* Visor */}
      <mesh position={[0, s * 0.36, s * 0.15]} material={m.visor}>
        <boxGeometry args={[s * 0.22, s * 0.06, s * 0.02]} />
      </mesh>
      {/* Rifle attached to body, front */}
      <group position={[s * 0.18, 0, s * 0.2]}>
        <mesh material={m.shell}>
          <boxGeometry args={[s * 0.06, s * 0.08, s * 0.55]} />
        </mesh>
        <mesh ref={muzzle} position={[0, 0, -s * 0.32]} material={m.neonSoft}>
          <sphereGeometry args={[s * 0.05, 12, 12]} />
        </mesh>
      </group>
      {/* Legs */}
      <mesh ref={leftLeg} position={[-s * 0.12, -s * 0.4, 0]} material={m.shell}>
        <boxGeometry args={[s * 0.14, s * 0.35, s * 0.18]} />
      </mesh>
      <mesh ref={rightLeg} position={[s * 0.12, -s * 0.4, 0]} material={m.shell}>
        <boxGeometry args={[s * 0.14, s * 0.35, s * 0.18]} />
      </mesh>
      <pointLight color={color} intensity={0.4} distance={s * 1.2} position={[0, s * 0.36, s * 0.1]} />
    </group>
  );
}

/* ----------------------------- Sniper ----------------------------- */
function SniperBody({ cellSize, color, lastShot }: any) {
  const m = useEnemyMats(color);
  const laserRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!laserRef.current) return;
    const since = (Date.now() - lastShot) / 1000;
    // Laser visible while charging shot (last shot was just fired, then again before next)
    // Simulate: laser glows for ~600ms BEFORE next shot — approximated as 0.4s..1.0s after last shot
    const visible = since > 0.4 && since < 1.0;
    laserRef.current.visible = visible;
    if (visible) {
      const k = (since - 0.4) / 0.6;
      (laserRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + k * 0.6;
    }
  });

  const s = cellSize;
  return (
    <group>
      {/* Tall thin torso */}
      <mesh position={[0, s * 0.1, 0]} material={m.shell}>
        <boxGeometry args={[s * 0.22, s * 0.7, s * 0.2]} />
      </mesh>
      {/* Long antenna */}
      <mesh position={[0, s * 0.7, 0]} material={m.shellMid}>
        <cylinderGeometry args={[0.015, 0.025, s * 0.5, 6]} />
      </mesh>
      <mesh position={[0, s * 0.95, 0]} material={m.neon}>
        <sphereGeometry args={[s * 0.04, 8, 8]} />
      </mesh>
      {/* Head */}
      <mesh position={[0, s * 0.5, 0]} material={m.shellMid}>
        <boxGeometry args={[s * 0.18, s * 0.18, s * 0.18]} />
      </mesh>
      {/* Amber visor */}
      <mesh position={[0, s * 0.5, s * 0.1]} material={m.visor}>
        <boxGeometry args={[s * 0.14, s * 0.04, s * 0.02]} />
      </mesh>
      {/* Long rifle */}
      <group position={[s * 0.15, s * 0.2, 0]}>
        <mesh material={m.shell}>
          <boxGeometry args={[s * 0.05, s * 0.06, s * 0.6]} />
        </mesh>
        <mesh position={[0, 0, -s * 0.5]} rotation={[Math.PI / 2, 0, 0]} material={m.shellMid}>
          <cylinderGeometry args={[0.02, 0.02, s * 0.7, 6]} />
        </mesh>
      </group>
      {/* Aiming laser (amber) */}
      <mesh ref={laserRef} visible={false} position={[s * 0.15, s * 0.2, -s * 1.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, s * 2, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
      {/* Legs */}
      <mesh position={[-s * 0.08, -s * 0.4, 0]} material={m.shell}>
        <boxGeometry args={[s * 0.08, s * 0.35, s * 0.12]} />
      </mesh>
      <mesh position={[s * 0.08, -s * 0.4, 0]} material={m.shell}>
        <boxGeometry args={[s * 0.08, s * 0.35, s * 0.12]} />
      </mesh>
      <pointLight color={color} intensity={0.35} distance={s * 1.4} position={[0, s * 0.5, s * 0.1]} />
    </group>
  );
}

/* ----------------------------- Titan (Boss) ----------------------------- */
function TitanBody({ cellSize, color, healthPct, lastShot }: any) {
  const m = useEnemyMats(color);
  const coreRef = useRef<THREE.Mesh>(null);
  const coreLightRef = useRef<THREE.PointLight>(null);

  // Phase derived from hp
  const phase = healthPct > 0.66 ? 1 : healthPct > 0.33 ? 2 : 3;

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const since = (Date.now() - lastShot) / 1000;
    // Core flares with phase intensity + pulses before each attack
    const baseIntensity = 1.5 + (phase - 1) * 1.2;
    const flare = since > 0.8 && since < 1.4 ? 2.5 : 0;
    const pulse = Math.sin(t * (3 + phase)) * 0.4;
    const k = baseIntensity + flare + pulse;
    if (coreRef.current) {
      (coreRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = k;
      coreRef.current.scale.setScalar(1 + pulse * 0.05 + flare * 0.1);
    }
    if (coreLightRef.current) {
      coreLightRef.current.intensity = 0.8 + flare * 0.6 + pulse * 0.3;
    }
  });

  const s = cellSize;
  return (
    <group>
      {/* Massive curved torso - layered plates */}
      <mesh material={m.shell}>
        <boxGeometry args={[s * 0.85, s * 1.2, s * 0.8]} />
      </mesh>
      {/* Segmented chest plates */}
      {[-1, 0, 1].map((i) => (
        <mesh key={i} position={[0, i * s * 0.35, s * 0.41]} material={m.shellMid}>
          <boxGeometry args={[s * 0.7, s * 0.28, s * 0.04]} />
        </mesh>
      ))}
      {/* Core (magenta pulsating) */}
      <mesh ref={coreRef} position={[0, 0, s * 0.46]} material={m.neon}>
        <sphereGeometry args={[s * 0.18, 16, 16]} />
      </mesh>
      <pointLight ref={coreLightRef} color={color} intensity={0.8} distance={s * 4} position={[0, 0, s * 0.5]} />

      {/* Cracks appear in phase 2+ */}
      {phase >= 2 && (
        <>
          <mesh position={[s * 0.25, s * 0.2, s * 0.42]} rotation={[0, 0, 0.6]} material={m.neonSoft}>
            <boxGeometry args={[s * 0.02, s * 0.4, s * 0.005]} />
          </mesh>
          <mesh position={[-s * 0.2, -s * 0.1, s * 0.42]} rotation={[0, 0, -0.5]} material={m.neonSoft}>
            <boxGeometry args={[s * 0.02, s * 0.3, s * 0.005]} />
          </mesh>
        </>
      )}
      {/* Phase 3: more cracks + secondary core glow */}
      {phase >= 3 && (
        <>
          <mesh position={[s * 0.05, -s * 0.45, s * 0.42]} rotation={[0, 0, 1.2]} material={m.neonSoft}>
            <boxGeometry args={[s * 0.02, s * 0.5, s * 0.005]} />
          </mesh>
          <mesh position={[0, s * 0.5, s * 0.46]} material={m.neonSoft}>
            <sphereGeometry args={[s * 0.06, 8, 8]} />
          </mesh>
        </>
      )}

      {/* Heavy shoulder pauldrons */}
      {[-1, 1].map((dx) => (
        <group key={dx} position={[dx * s * 0.55, s * 0.4, 0]}>
          <mesh material={m.shellMid}>
            <boxGeometry args={[s * 0.32, s * 0.4, s * 0.7]} />
          </mesh>
          {/* Magenta strip */}
          <mesh position={[dx * s * 0.17, 0, 0]} material={m.neon}>
            <boxGeometry args={[s * 0.02, s * 0.3, s * 0.5]} />
          </mesh>
        </group>
      ))}

      {/* Head */}
      <mesh position={[0, s * 0.75, 0]} material={m.shell}>
        <boxGeometry args={[s * 0.4, s * 0.3, s * 0.4]} />
      </mesh>
      <mesh position={[0, s * 0.75, s * 0.21]} material={m.visor}>
        <boxGeometry args={[s * 0.32, s * 0.08, s * 0.02]} />
      </mesh>

      {/* Heavy legs */}
      {[-1, 1].map((dx) => (
        <mesh key={dx} position={[dx * s * 0.22, -s * 0.85, 0]} material={m.shell}>
          <boxGeometry args={[s * 0.28, s * 0.5, s * 0.32]} />
        </mesh>
      ))}
    </group>
  );
}
