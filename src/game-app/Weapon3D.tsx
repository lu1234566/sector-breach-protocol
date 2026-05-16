// @ts-nocheck
import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Weapon3D — Protocol DOC neon arena weapons.
 * Procedural geometry, no GLB. Each weapon has a distinct silhouette,
 * cyan/magenta neon details, animated recoil, reload, swap, fire kick
 * and a pair of procedural tactical-glove hands.
 */

const NEON_CYAN = '#22d3ee';
const NEON_MAGENTA = '#e879f9';
const NEON_AMBER = '#fbbf24';
const FRAME_DARK = '#0b1220';
const BODY_DARK = '#1f2937';
const BODY_MID = '#374151';

export function Weapon3D({
  type,
  isReloading,
  isAds,
  recoilOffset,
  lastShotTime,
}: {
  type: string;
  isReloading: boolean;
  isAds: boolean;
  recoilOffset: number;
  lastShotTime: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} style={{ pointerEvents: 'none' }}>
        {/* Brighter rig lighting for clearer weapon read */}
        <ambientLight intensity={0.8} color="#475569" />
        <hemisphereLight intensity={0.7} color="#a5f3fc" groundColor="#020617" />
        <directionalLight position={[3, 5, 4]} intensity={1.25} color="#e0f7ff" />
        <directionalLight position={[-2, 2, 3]} intensity={0.5} color={NEON_MAGENTA} />
        <pointLight position={[1.2, -0.5, 2.5]} intensity={0.9} color={NEON_CYAN} distance={6} />
        <WeaponRig
          type={type}
          isReloading={isReloading}
          isAds={isAds}
          recoilOffset={recoilOffset}
          lastShotTime={lastShotTime}
        />
      </Canvas>
    </div>
  );
}

function WeaponRig({ type, isReloading, isAds, recoilOffset, lastShotTime }: any) {
  const group = useRef<THREE.Group>(null);
  const swapRef = useRef({ y: -3, lastType: type });
  const reloadProgress = useRef(0);
  const fireKickRef = useRef(0);

  if (swapRef.current.lastType !== type) {
    swapRef.current.y = -3.5;
    swapRef.current.lastType = type;
  }

  // Per-weapon idle resting pose — pushes weapon toward lower-right corner.
  const restPose = useMemo(() => {
    switch (type) {
      case 'sniper':
        return { x: 1.05, y: -0.95, z: 1.2, ry: -0.13, rx: 0.04 };
      case 'shotgun':
        return { x: 1.0, y: -0.95, z: 1.55, ry: -0.12, rx: 0.05 };
      case 'rifle':
        return { x: 0.95, y: -0.9, z: 1.6, ry: -0.11, rx: 0.04 };
      case 'pistol':
      default:
        return { x: 0.7, y: -0.75, z: 1.9, ry: -0.18, rx: 0.06 };
    }
  }, [type]);

  // Per-weapon recoil weights
  const recoilWeight = type === 'sniper' ? 1.6 : type === 'shotgun' ? 1.35 : type === 'rifle' ? 0.9 : 0.8;

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();

    swapRef.current.y = THREE.MathUtils.lerp(swapRef.current.y, 0, 0.13);

    // Idle sway (slightly stronger so weapon feels alive)
    const swayX = Math.sin(t * 1.35) * 0.018;
    const swayY = Math.cos(t * 1.05) * 0.024;
    const breath = Math.sin(t * 2.2) * 0.006;

    // Fire kick from lastShotTime (independent fast burst)
    const dt = Date.now() - lastShotTime;
    const kick = dt < 130 ? Math.pow(1 - dt / 130, 2) : 0;
    fireKickRef.current = THREE.MathUtils.lerp(fireKickRef.current, kick, 0.45);
    const fk = fireKickRef.current * recoilWeight;

    // ADS target
    const targetX = isAds ? 0 : restPose.x + swayX;
    const targetY = isAds ? -0.32 : restPose.y + swayY * 0.5 + breath + swapRef.current.y;
    const targetZ = isAds ? 2.95 : restPose.z + recoilOffset * 0.45 + fk * 0.4;

    group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, targetX, 0.16);
    group.current.position.y = THREE.MathUtils.lerp(
      group.current.position.y,
      targetY - fk * 0.05,
      0.18,
    );
    group.current.position.z = THREE.MathUtils.lerp(group.current.position.z, targetZ, 0.22);

    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      restPose.rx + recoilOffset * 0.22 + fk * 0.35,
      0.18,
    );
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      isAds ? 0 : restPose.ry,
      0.12,
    );
    group.current.rotation.z = THREE.MathUtils.lerp(
      group.current.rotation.z,
      isAds ? 0 : -0.04 + Math.sin(t * 1.1) * 0.012,
      0.1,
    );

    // Reload — tilts the gun down and pumps
    reloadProgress.current = THREE.MathUtils.lerp(
      reloadProgress.current,
      isReloading ? 1 : 0,
      0.14,
    );
    const reloadPump = Math.sin(t * 9) * 0.06 * reloadProgress.current;
    group.current.rotation.x += reloadProgress.current * 0.65 + reloadPump;
    group.current.rotation.z += reloadProgress.current * -0.25;
    group.current.position.y += -reloadProgress.current * 0.45;
    group.current.position.x += reloadProgress.current * 0.12;
  });

  return (
    <group ref={group}>
      <MuzzleFlash lastShotTime={lastShotTime} type={type} />
      {type === 'pistol' && <Pistol fireKick={fireKickRef} />}
      {type === 'rifle' && <Rifle fireKick={fireKickRef} />}
      {type === 'shotgun' && <Shotgun fireKick={fireKickRef} />}
      {type === 'sniper' && <Sniper fireKick={fireKickRef} isAds={isAds} />}
      <Hands type={type} reloadProgress={reloadProgress} />
    </group>
  );
}

function MuzzleFlash({ lastShotTime, type }: { lastShotTime: number; type: string }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const crossRef = useRef<THREE.Mesh>(null);
  const sparkRef = useRef<THREE.Mesh>(null);

  // Per-weapon flash scale + duration
  const cfg = useMemo(() => {
    switch (type) {
      case 'shotgun':
        return { scale: 1.8, life: 110, light: 26 };
      case 'sniper':
        return { scale: 1.5, life: 130, light: 30 };
      case 'rifle':
        return { scale: 1.05, life: 75, light: 18 };
      case 'pistol':
      default:
        return { scale: 0.85, life: 65, light: 14 };
    }
  }, [type]);

  // Per-weapon muzzle Z position
  const muzzleZ = type === 'sniper' ? -3.3 : type === 'shotgun' ? -2.1 : type === 'rifle' ? -2.55 : -1.7;

  useFrame(() => {
    const dt = Date.now() - lastShotTime;
    const visible = dt < cfg.life;
    const k = visible ? 1 - dt / cfg.life : 0;
    if (lightRef.current) lightRef.current.intensity = visible ? cfg.light * k : 0;

    if (coreRef.current) {
      coreRef.current.visible = visible;
      const s = (0.6 + Math.random() * 0.5) * cfg.scale;
      coreRef.current.scale.set(s, s, s);
      coreRef.current.rotation.z = Math.random() * Math.PI;
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = k;
    }
    if (ringRef.current) {
      ringRef.current.visible = visible;
      const s = (0.7 + (1 - k) * 1.1) * cfg.scale;
      ringRef.current.scale.set(s, s, s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = k * 0.85;
    }
    if (crossRef.current) {
      crossRef.current.visible = visible;
      const s = (1.2 + Math.random() * 0.6) * cfg.scale;
      crossRef.current.scale.set(s, s * 0.25, 1);
      crossRef.current.rotation.z = Math.random() * Math.PI;
      (crossRef.current.material as THREE.MeshBasicMaterial).opacity = k * 0.9;
    }
    if (sparkRef.current) {
      sparkRef.current.visible = visible;
      const s = (0.4 + Math.random() * 0.3) * cfg.scale;
      sparkRef.current.scale.set(s, s, s);
      (sparkRef.current.material as THREE.MeshBasicMaterial).opacity = k;
    }
  });

  return (
    <group position={[0, 0.22, muzzleZ]}>
      <pointLight ref={lightRef} color={'#fef9c3'} intensity={0} distance={9} decay={2} />
      {/* Hot core */}
      <mesh ref={coreRef} visible={false}>
        <sphereGeometry args={[0.22, 10, 10]} />
        <meshBasicMaterial color="#fffbe6" transparent opacity={1} />
      </mesh>
      {/* White-hot spark center */}
      <mesh ref={sparkRef} visible={false}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={1} />
      </mesh>
      {/* Cyan shock ring */}
      <mesh ref={ringRef} visible={false} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.46, 20]} />
        <meshBasicMaterial color={NEON_CYAN} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      {/* Cross flare */}
      <mesh ref={crossRef} visible={false}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ----------------------------- Materials ----------------------------- */
function useNeonMats() {
  return useMemo(() => {
    const body = new THREE.MeshStandardMaterial({
      color: BODY_DARK,
      metalness: 0.55,
      roughness: 0.4,
    });
    const bodyMid = new THREE.MeshStandardMaterial({
      color: BODY_MID,
      metalness: 0.5,
      roughness: 0.35,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: FRAME_DARK,
      metalness: 0.75,
      roughness: 0.25,
    });
    const grip = new THREE.MeshStandardMaterial({
      color: '#0a0f1a',
      metalness: 0.05,
      roughness: 0.95,
    });
    const cyan = new THREE.MeshStandardMaterial({
      color: NEON_CYAN,
      emissive: NEON_CYAN,
      emissiveIntensity: 1.8,
      metalness: 0.2,
      roughness: 0.3,
    });
    const magenta = new THREE.MeshStandardMaterial({
      color: NEON_MAGENTA,
      emissive: NEON_MAGENTA,
      emissiveIntensity: 1.6,
      metalness: 0.2,
      roughness: 0.3,
    });
    const amber = new THREE.MeshStandardMaterial({
      color: NEON_AMBER,
      emissive: NEON_AMBER,
      emissiveIntensity: 1.4,
    });
    return { body, bodyMid, dark, grip, cyan, magenta, amber };
  }, []);
}

/* ----------------------------- Pistol P-99 (compact) ----------------------------- */
function Pistol({ fireKick }: any) {
  const m = useNeonMats();
  const slideRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (slideRef.current) {
      slideRef.current.position.z = THREE.MathUtils.lerp(
        slideRef.current.position.z,
        0.1 + (fireKick?.current ?? 0) * 0.22,
        0.5,
      );
    }
  });
  return (
    <group scale={0.7} position={[0, 0.05, 0.1]}>
      {/* Slide (animated) */}
      <group ref={slideRef}>
        <mesh position={[0, 0.32, 0]} material={m.dark}>
          <boxGeometry args={[0.22, 0.18, 1.1]} />
        </mesh>
        <mesh position={[0, 0.42, 0]} material={m.cyan}>
          <boxGeometry args={[0.06, 0.02, 0.6]} />
        </mesh>
        {/* ejection port */}
        <mesh position={[0.12, 0.36, -0.1]} material={m.grip}>
          <boxGeometry args={[0.02, 0.06, 0.22]} />
        </mesh>
      </group>
      {/* Frame */}
      <mesh position={[0, 0.16, 0.2]} material={m.body}>
        <boxGeometry args={[0.2, 0.18, 0.85]} />
      </mesh>
      {/* Grip */}
      <mesh position={[0, -0.22, 0.45]} rotation={[-0.18, 0, 0]} material={m.grip}>
        <boxGeometry args={[0.2, 0.6, 0.28]} />
      </mesh>
      <mesh position={[0.105, -0.22, 0.45]} rotation={[-0.18, 0, 0]} material={m.cyan}>
        <boxGeometry args={[0.005, 0.4, 0.06]} />
      </mesh>
      <mesh position={[0, -0.55, 0.5]} rotation={[-0.18, 0, 0]} material={m.dark}>
        <boxGeometry args={[0.22, 0.06, 0.3]} />
      </mesh>
      <mesh position={[0, -0.54, 0.66]} rotation={[-0.18, 0, 0]} material={m.amber}>
        <boxGeometry args={[0.04, 0.02, 0.04]} />
      </mesh>
      <mesh position={[0, 0.32, -0.55]} rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
        <cylinderGeometry args={[0.06, 0.06, 0.2, 12]} />
      </mesh>
      <mesh position={[0, 0.46, -0.4]} material={m.cyan}>
        <boxGeometry args={[0.02, 0.04, 0.04]} />
      </mesh>
    </group>
  );
}

/* ----------------------------- Rifle M4-A1 (tactical) ----------------------------- */
function Rifle({ fireKick }: any) {
  const m = useNeonMats();
  const boltRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (boltRef.current) {
      boltRef.current.position.z = THREE.MathUtils.lerp(
        boltRef.current.position.z,
        0.3 + (fireKick?.current ?? 0) * 0.18,
        0.5,
      );
    }
  });
  return (
    <group scale={0.82} position={[0, 0.05, 0.1]}>
      {/* Receiver */}
      <mesh ref={boltRef} position={[0, 0.3, 0.3]} material={m.body}>
        <boxGeometry args={[0.22, 0.32, 1.0]} />
      </mesh>
      {/* Top rail */}
      <mesh position={[0, 0.5, 0.0]} material={m.dark}>
        <boxGeometry args={[0.12, 0.06, 1.7]} />
      </mesh>
      {/* Rail teeth */}
      {[-0.7, -0.4, -0.1, 0.2, 0.5].map((z) => (
        <mesh key={z} position={[0, 0.54, z]} material={m.bodyMid}>
          <boxGeometry args={[0.14, 0.02, 0.04]} />
        </mesh>
      ))}
      {/* Handguard */}
      <mesh position={[0, 0.3, -0.6]} material={m.dark}>
        <boxGeometry args={[0.2, 0.22, 0.9]} />
      </mesh>
      {[-0.3, 0, 0.3].map((z) => (
        <mesh key={z} position={[0, 0.3, -0.6 + z]} material={m.cyan}>
          <boxGeometry args={[0.21, 0.02, 0.06]} />
        </mesh>
      ))}
      {/* Side vent magenta */}
      <mesh position={[0.105, 0.32, -0.6]} material={m.magenta}>
        <boxGeometry args={[0.005, 0.05, 0.7]} />
      </mesh>
      {/* Barrel */}
      <mesh position={[0, 0.3, -1.35]} rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
        <cylinderGeometry args={[0.045, 0.045, 0.9, 12]} />
      </mesh>
      {/* Muzzle brake with vents */}
      <mesh position={[0, 0.3, -1.85]} rotation={[Math.PI / 2, 0, 0]} material={m.body}>
        <cylinderGeometry args={[0.085, 0.075, 0.22, 8]} />
      </mesh>
      <mesh position={[0, 0.36, -1.85]} material={m.cyan}>
        <boxGeometry args={[0.05, 0.01, 0.18]} />
      </mesh>
      {/* Magazine */}
      <mesh position={[0, -0.18, 0.18]} rotation={[0.12, 0, 0]} material={m.dark}>
        <boxGeometry args={[0.14, 0.62, 0.24]} />
      </mesh>
      <mesh position={[0, -0.18, 0.31]} rotation={[0.12, 0, 0]} material={m.amber}>
        <boxGeometry args={[0.08, 0.5, 0.005]} />
      </mesh>
      {/* Grip */}
      <mesh position={[0, -0.05, 0.55]} rotation={[-0.6, 0, 0]} material={m.grip}>
        <boxGeometry args={[0.14, 0.4, 0.16]} />
      </mesh>
      {/* Stock */}
      <mesh position={[0, 0.3, 1.05]} material={m.body}>
        <boxGeometry args={[0.14, 0.32, 0.6]} />
      </mesh>
      <mesh position={[0.075, 0.3, 1.05]} material={m.cyan}>
        <boxGeometry args={[0.005, 0.04, 0.4]} />
      </mesh>
    </group>
  );
}

/* ----------------------------- Shotgun KRM-262 (heavy) ----------------------------- */
function Shotgun({ fireKick }: any) {
  const m = useNeonMats();
  const pumpRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (pumpRef.current) {
      pumpRef.current.position.z = THREE.MathUtils.lerp(
        pumpRef.current.position.z,
        -0.35 + (fireKick?.current ?? 0) * 0.4,
        0.35,
      );
    }
  });
  return (
    <group scale={1.05} position={[0, 0.05, 0.1]}>
      {/* Receiver — boxier */}
      <mesh position={[0, 0.22, 0.25]} material={m.body}>
        <boxGeometry args={[0.36, 0.44, 1.05]} />
      </mesh>
      {/* Top magenta vent */}
      <mesh position={[0, 0.47, 0.25]} material={m.magenta}>
        <boxGeometry args={[0.08, 0.03, 0.7]} />
      </mesh>
      {/* Double-tube barrel */}
      <mesh position={[0, 0.34, -0.95]} rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
        <cylinderGeometry args={[0.16, 0.16, 1.6, 16]} />
      </mesh>
      {/* Lower tube (magazine tube) */}
      <mesh position={[0, 0.16, -0.95]} rotation={[Math.PI / 2, 0, 0]} material={m.bodyMid}>
        <cylinderGeometry args={[0.07, 0.07, 1.4, 12]} />
      </mesh>
      {/* Front sight bead */}
      <mesh position={[0, 0.5, -1.7]} material={m.amber}>
        <sphereGeometry args={[0.025, 8, 8]} />
      </mesh>
      {/* Barrel band */}
      <mesh position={[0, 0.32, -0.4]} rotation={[Math.PI / 2, 0, 0]} material={m.bodyMid}>
        <cylinderGeometry args={[0.18, 0.18, 0.08, 12]} />
      </mesh>
      {/* Animated pump */}
      <group ref={pumpRef}>
        <mesh position={[0, 0.12, 0]} material={m.grip}>
          <boxGeometry args={[0.32, 0.24, 0.55]} />
        </mesh>
        {[-0.2, -0.06, 0.08, 0.22].map((z) => (
          <mesh key={z} position={[0, 0.12, z]} material={m.dark}>
            <boxGeometry args={[0.33, 0.26, 0.03]} />
          </mesh>
        ))}
        <mesh position={[0.17, 0.12, 0]} material={m.cyan}>
          <boxGeometry args={[0.005, 0.06, 0.5]} />
        </mesh>
      </group>
      {/* Stock */}
      <mesh position={[0, 0.18, 0.95]} rotation={[-0.08, 0, 0]} material={m.body}>
        <boxGeometry args={[0.2, 0.5, 0.6]} />
      </mesh>
      <mesh position={[0, 0.4, 1.2]} rotation={[-0.08, 0, 0]} material={m.magenta}>
        <boxGeometry args={[0.06, 0.02, 0.04]} />
      </mesh>
      {/* Trigger guard */}
      <mesh position={[0, 0, 0.25]} rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
        <torusGeometry args={[0.07, 0.018, 8, 16]} />
      </mesh>
    </group>
  );
}

/* ----------------------------- Sniper DL-Q33 (long bolt-action) ----------------------------- */
function Sniper({ fireKick, isAds }: any) {
  const m = useNeonMats();
  const boltRef = useRef<THREE.Group>(null);
  const lensIntensity = useRef(0.3);
  const lensRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (boltRef.current) {
      // Bolt cycles after firing
      const k = fireKick?.current ?? 0;
      boltRef.current.rotation.z = THREE.MathUtils.lerp(
        boltRef.current.rotation.z,
        -0.4 + k * 1.2,
        0.4,
      );
      boltRef.current.position.x = THREE.MathUtils.lerp(
        boltRef.current.position.x,
        0.18 + k * 0.18,
        0.4,
      );
    }
    if (lensRef.current) {
      const target = isAds ? 0.85 : 0.3;
      lensIntensity.current = THREE.MathUtils.lerp(lensIntensity.current, target, 0.1);
      (lensRef.current.material as THREE.MeshBasicMaterial).opacity = lensIntensity.current;
    }
  });
  return (
    <group scale={1.05} position={[0, 0.05, 0.1]}>
      <mesh position={[0, 0.26, 0.55]} material={m.body}>
        <boxGeometry args={[0.2, 0.36, 1.4]} />
      </mesh>
      <mesh position={[0, 0.32, -1.1]} rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
        <cylinderGeometry args={[0.045, 0.045, 3.0, 8]} />
      </mesh>
      <mesh position={[0, 0.32, -2.6]} material={m.body}>
        <boxGeometry args={[0.18, 0.18, 0.26]} />
      </mesh>
      <mesh position={[0, 0.32, -2.78]} material={m.amber}>
        <boxGeometry args={[0.1, 0.1, 0.04]} />
      </mesh>
      {/* Scope rail */}
      <mesh position={[0, 0.46, 0.3]} material={m.dark}>
        <boxGeometry args={[0.1, 0.04, 0.9]} />
      </mesh>
      <group position={[0, 0.6, 0.3]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
          <cylinderGeometry args={[0.14, 0.14, 1.0, 20]} />
        </mesh>
        {/* Scope rings */}
        <mesh position={[0, 0, -0.35]} rotation={[Math.PI / 2, 0, 0]} material={m.bodyMid}>
          <cylinderGeometry args={[0.16, 0.16, 0.08, 16]} />
        </mesh>
        <mesh position={[0, 0, 0.35]} rotation={[Math.PI / 2, 0, 0]} material={m.bodyMid}>
          <cylinderGeometry args={[0.16, 0.16, 0.08, 16]} />
        </mesh>
        {/* Cyan ring back */}
        <mesh position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]} material={m.cyan}>
          <torusGeometry args={[0.13, 0.014, 8, 24]} />
        </mesh>
        {/* Lens reflection */}
        <mesh ref={lensRef} position={[0, 0, -0.5]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.11, 24]} />
          <meshBasicMaterial color={NEON_CYAN} transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* Bolt action (animated) */}
      <group ref={boltRef} position={[0.18, 0.36, 0.55]}>
        <mesh rotation={[0, 0, -0.4]} material={m.bodyMid}>
          <cylinderGeometry args={[0.028, 0.028, 0.2, 8]} />
        </mesh>
        <mesh position={[0.1, -0.04, 0]} material={m.dark}>
          <sphereGeometry args={[0.045, 8, 8]} />
        </mesh>
      </group>
      <mesh position={[0, -0.05, 0.45]} material={m.dark}>
        <boxGeometry args={[0.16, 0.32, 0.34]} />
      </mesh>
      <mesh position={[0, 0.22, 1.4]} material={m.body}>
        <boxGeometry args={[0.16, 0.4, 0.7]} />
      </mesh>
      <mesh position={[0, 0.42, 1.4]} material={m.cyan}>
        <boxGeometry args={[0.08, 0.02, 0.5]} />
      </mesh>
      <mesh position={[0, 0.08, -0.7]} material={m.dark}>
        <boxGeometry args={[0.22, 0.06, 0.4]} />
      </mesh>
    </group>
  );
}

/* ----------------------------- Hands ----------------------------- */
function Hands({ type, reloadProgress }: any) {
  const leftRef = useRef<THREE.Group>(null);
  const m = useMemo(
    () => ({
      glove: new THREE.MeshStandardMaterial({
        color: '#0b1220',
        metalness: 0.2,
        roughness: 0.85,
      }),
      sleeve: new THREE.MeshStandardMaterial({
        color: '#1a1f2e',
        metalness: 0.25,
        roughness: 0.7,
      }),
      cuff: new THREE.MeshStandardMaterial({
        color: NEON_CYAN,
        emissive: NEON_CYAN,
        emissiveIntensity: 1.1,
      }),
      knuckle: new THREE.MeshStandardMaterial({
        color: '#1f2937',
        metalness: 0.6,
        roughness: 0.4,
      }),
    }),
    [],
  );

  const leftPos: [number, number, number] =
    type === 'sniper'
      ? [-0.25, 0.05, -0.8]
      : type === 'shotgun'
        ? [-0.28, -0.05, -0.4]
        : type === 'rifle'
          ? [-0.25, 0.1, -0.55]
          : [-0.18, -0.05, 0.25];

  const rightPos: [number, number, number] =
    type === 'sniper'
      ? [0.18, -0.1, 0.95]
      : type === 'shotgun'
        ? [0.22, -0.05, 0.55]
        : type === 'rifle'
          ? [0.18, -0.05, 0.55]
          : [0.12, -0.18, 0.55];

  useFrame(() => {
    if (leftRef.current) {
      const k = reloadProgress.current;
      leftRef.current.position.y = THREE.MathUtils.lerp(
        leftRef.current.position.y,
        leftPos[1] + k * -0.6,
        0.18,
      );
      leftRef.current.position.z = THREE.MathUtils.lerp(
        leftRef.current.position.z,
        leftPos[2] + k * 0.5,
        0.18,
      );
    }
  });

  return (
    <>
      {/* Front (left) hand */}
      <group ref={leftRef} position={leftPos} rotation={[0.2, 0.3, 0]}>
        <mesh position={[-0.15, 0.05, 0.25]} rotation={[1.2, 0, 0]} material={m.sleeve}>
          <cylinderGeometry args={[0.11, 0.13, 0.9, 8]} />
        </mesh>
        <mesh position={[-0.18, 0.08, 0.55]} rotation={[1.2, 0, 0]} material={m.cuff}>
          <torusGeometry args={[0.13, 0.012, 6, 16]} />
        </mesh>
        <mesh material={m.glove}>
          <boxGeometry args={[0.18, 0.16, 0.22]} />
        </mesh>
        {/* Knuckle plate */}
        <mesh position={[0, 0.07, -0.02]} material={m.knuckle}>
          <boxGeometry args={[0.16, 0.04, 0.18]} />
        </mesh>
        <mesh position={[0.05, -0.04, -0.04]} rotation={[0, 0, -0.3]} material={m.glove}>
          <boxGeometry args={[0.06, 0.06, 0.18]} />
        </mesh>
      </group>

      {/* Rear (right) trigger hand */}
      <group position={rightPos} rotation={[-0.1, -0.3, 0]}>
        <mesh position={[0.15, 0.0, 0.3]} rotation={[1.4, 0, 0]} material={m.sleeve}>
          <cylinderGeometry args={[0.11, 0.13, 0.95, 8]} />
        </mesh>
        <mesh position={[0.18, 0.04, 0.6]} rotation={[1.4, 0, 0]} material={m.cuff}>
          <torusGeometry args={[0.13, 0.012, 6, 16]} />
        </mesh>
        <mesh material={m.glove}>
          <boxGeometry args={[0.18, 0.16, 0.22]} />
        </mesh>
        <mesh position={[0, 0.07, -0.02]} material={m.knuckle}>
          <boxGeometry args={[0.16, 0.04, 0.18]} />
        </mesh>
        <mesh position={[-0.04, -0.05, -0.06]} rotation={[0.4, 0, 0.2]} material={m.glove}>
          <boxGeometry args={[0.05, 0.05, 0.16]} />
        </mesh>
      </group>
    </>
  );
}
