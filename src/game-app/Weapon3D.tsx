// @ts-nocheck
import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Weapon3D — Protocol DOC neon arena weapons.
 * Procedural geometry, no GLB. Each weapon has a distinct silhouette,
 * cyan/magenta neon details, animated recoil, reload, swap, and a
 * pair of procedural hands holding it.
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
        <ambientLight intensity={0.55} color="#334155" />
        <hemisphereLight intensity={0.5} color="#67e8f9" groundColor="#020617" />
        <directionalLight position={[3, 5, 4]} intensity={0.9} color="#cffafe" />
        <pointLight position={[-3, 1, 2]} intensity={0.5} color={NEON_MAGENTA} />
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

  // Trigger swap animation when weapon type changes
  if (swapRef.current.lastType !== type) {
    swapRef.current.y = -3;
    swapRef.current.lastType = type;
  }

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();

    // Swap-in animation
    swapRef.current.y = THREE.MathUtils.lerp(swapRef.current.y, 0, 0.12);

    // Idle sway
    const swayX = Math.sin(t * 1.4) * 0.012;
    const swayY = Math.cos(t * 1.1) * 0.018;

    // ADS lerp
    const targetX = isAds ? 0 : 0.95;
    const targetY = isAds ? -0.38 : -0.85 + swapRef.current.y;
    const targetZ = isAds ? 2.8 : 1.6;

    group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, targetX + swayX, 0.16);
    group.current.position.y = THREE.MathUtils.lerp(
      group.current.position.y,
      targetY + swayY * 0.4,
      0.14,
    );
    group.current.position.z = THREE.MathUtils.lerp(
      group.current.position.z,
      targetZ + recoilOffset * 0.45,
      0.18,
    );

    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      recoilOffset * 0.22,
      0.14,
    );
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      isAds ? 0 : -0.11,
      0.12,
    );

    // Reload — tilts the gun down and rotates magazine
    reloadProgress.current = THREE.MathUtils.lerp(
      reloadProgress.current,
      isReloading ? 1 : 0,
      0.12,
    );
    group.current.rotation.x += reloadProgress.current * (0.6 + Math.sin(t * 8) * 0.05);
    group.current.position.y += -reloadProgress.current * 0.4;
  });

  return (
    <group ref={group}>
      <MuzzleFlash lastShotTime={lastShotTime} />
      {type === 'pistol' && <Pistol />}
      {type === 'rifle' && <Rifle />}
      {type === 'shotgun' && <Shotgun />}
      {type === 'sniper' && <Sniper />}
      <Hands type={type} reloadProgress={reloadProgress} />
    </group>
  );
}

function MuzzleFlash({ lastShotTime }: { lastShotTime: number }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const dt = Date.now() - lastShotTime;
    const visible = dt < 70;
    const k = visible ? 1 - dt / 70 : 0;
    if (lightRef.current) lightRef.current.intensity = visible ? 14 * k : 0;
    if (coreRef.current) {
      coreRef.current.visible = visible;
      const s = 0.5 + Math.random() * 0.5;
      coreRef.current.scale.set(s, s, s);
      coreRef.current.rotation.z = Math.random() * Math.PI;
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = k;
    }
    if (ringRef.current) {
      ringRef.current.visible = visible;
      const s = 0.6 + (1 - k) * 0.8;
      ringRef.current.scale.set(s, s, s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = k * 0.7;
    }
  });

  return (
    <group position={[0, 0.22, -2.6]}>
      <pointLight ref={lightRef} color={NEON_CYAN} intensity={0} distance={6} />
      <mesh ref={coreRef} visible={false}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={1} />
      </mesh>
      <mesh ref={ringRef} visible={false} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.34, 16]} />
        <meshBasicMaterial color={NEON_CYAN} transparent opacity={0} side={THREE.DoubleSide} />
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
      roughness: 0.45,
    });
    const bodyMid = new THREE.MeshStandardMaterial({
      color: BODY_MID,
      metalness: 0.5,
      roughness: 0.4,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: FRAME_DARK,
      metalness: 0.7,
      roughness: 0.3,
    });
    const grip = new THREE.MeshStandardMaterial({
      color: '#0a0f1a',
      metalness: 0.05,
      roughness: 0.95,
    });
    const cyan = new THREE.MeshStandardMaterial({
      color: NEON_CYAN,
      emissive: NEON_CYAN,
      emissiveIntensity: 1.3,
      metalness: 0.2,
      roughness: 0.3,
    });
    const magenta = new THREE.MeshStandardMaterial({
      color: NEON_MAGENTA,
      emissive: NEON_MAGENTA,
      emissiveIntensity: 1.2,
      metalness: 0.2,
      roughness: 0.3,
    });
    const amber = new THREE.MeshStandardMaterial({
      color: NEON_AMBER,
      emissive: NEON_AMBER,
      emissiveIntensity: 1.0,
    });
    return { body, bodyMid, dark, grip, cyan, magenta, amber };
  }, []);
}

/* ----------------------------- Pistol P-99 ----------------------------- */
function Pistol() {
  const m = useNeonMats();
  return (
    <group scale={0.78} position={[0, 0.05, 0.1]}>
      {/* Slide */}
      <mesh position={[0, 0.32, 0.1]} material={m.dark}>
        <boxGeometry args={[0.22, 0.18, 1.1]} />
      </mesh>
      {/* Cyan slide vent */}
      <mesh position={[0, 0.42, 0.1]} material={m.cyan}>
        <boxGeometry args={[0.06, 0.02, 0.6]} />
      </mesh>
      {/* Frame */}
      <mesh position={[0, 0.16, 0.2]} material={m.body}>
        <boxGeometry args={[0.2, 0.18, 0.85]} />
      </mesh>
      {/* Grip */}
      <mesh position={[0, -0.22, 0.45]} rotation={[-0.18, 0, 0]} material={m.grip}>
        <boxGeometry args={[0.2, 0.6, 0.28]} />
      </mesh>
      {/* Grip stripe */}
      <mesh position={[0.105, -0.22, 0.45]} rotation={[-0.18, 0, 0]} material={m.cyan}>
        <boxGeometry args={[0.005, 0.4, 0.06]} />
      </mesh>
      {/* Mag base */}
      <mesh position={[0, -0.55, 0.5]} rotation={[-0.18, 0, 0]} material={m.dark}>
        <boxGeometry args={[0.22, 0.06, 0.3]} />
      </mesh>
      {/* Mag amber LED */}
      <mesh position={[0, -0.54, 0.66]} rotation={[-0.18, 0, 0]} material={m.amber}>
        <boxGeometry args={[0.04, 0.02, 0.04]} />
      </mesh>
      {/* Barrel */}
      <mesh position={[0, 0.32, -0.55]} rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
        <cylinderGeometry args={[0.06, 0.06, 0.2, 12]} />
      </mesh>
      {/* Front sight */}
      <mesh position={[0, 0.46, -0.4]} material={m.cyan}>
        <boxGeometry args={[0.02, 0.04, 0.04]} />
      </mesh>
    </group>
  );
}

/* ----------------------------- Rifle M4-A1 ----------------------------- */
function Rifle() {
  const m = useNeonMats();
  return (
    <group scale={0.82} position={[0, 0.05, 0.1]}>
      {/* Receiver */}
      <mesh position={[0, 0.3, 0.3]} material={m.body}>
        <boxGeometry args={[0.22, 0.32, 1.0]} />
      </mesh>
      {/* Top rail */}
      <mesh position={[0, 0.5, 0.0]} material={m.dark}>
        <boxGeometry args={[0.12, 0.06, 1.7]} />
      </mesh>
      {/* Handguard */}
      <mesh position={[0, 0.3, -0.6]} material={m.dark}>
        <boxGeometry args={[0.2, 0.22, 0.9]} />
      </mesh>
      {/* Cyan handguard vents */}
      {[-0.3, 0, 0.3].map((z) => (
        <mesh key={z} position={[0, 0.3, -0.6 + z]} material={m.cyan}>
          <boxGeometry args={[0.21, 0.02, 0.06]} />
        </mesh>
      ))}
      {/* Barrel */}
      <mesh position={[0, 0.3, -1.35]} rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
        <cylinderGeometry args={[0.045, 0.045, 0.9, 12]} />
      </mesh>
      {/* Muzzle brake */}
      <mesh position={[0, 0.3, -1.85]} rotation={[Math.PI / 2, 0, 0]} material={m.body}>
        <cylinderGeometry args={[0.08, 0.07, 0.18, 8]} />
      </mesh>
      {/* Magazine */}
      <mesh position={[0, -0.18, 0.18]} rotation={[0.12, 0, 0]} material={m.dark}>
        <boxGeometry args={[0.14, 0.62, 0.24]} />
      </mesh>
      {/* Mag amber stripe */}
      <mesh position={[0, -0.18, 0.31]} rotation={[0.12, 0, 0]} material={m.amber}>
        <boxGeometry args={[0.08, 0.5, 0.005]} />
      </mesh>
      {/* Pistol grip */}
      <mesh position={[0, -0.05, 0.55]} rotation={[-0.6, 0, 0]} material={m.grip}>
        <boxGeometry args={[0.14, 0.4, 0.16]} />
      </mesh>
      {/* Stock */}
      <mesh position={[0, 0.3, 1.05]} material={m.body}>
        <boxGeometry args={[0.14, 0.32, 0.6]} />
      </mesh>
      {/* Cyan stock LED */}
      <mesh position={[0.075, 0.3, 1.05]} material={m.cyan}>
        <boxGeometry args={[0.005, 0.04, 0.4]} />
      </mesh>
    </group>
  );
}

/* ----------------------------- Shotgun KRM-262 ----------------------------- */
function Shotgun() {
  const m = useNeonMats();
  return (
    <group scale={1.0} position={[0, 0.05, 0.1]}>
      {/* Receiver */}
      <mesh position={[0, 0.22, 0.25]} material={m.body}>
        <boxGeometry args={[0.32, 0.4, 0.95]} />
      </mesh>
      {/* Top vent w/ magenta accent */}
      <mesh position={[0, 0.45, 0.25]} material={m.magenta}>
        <boxGeometry args={[0.08, 0.03, 0.7]} />
      </mesh>
      {/* Heavy double-tube barrel */}
      <mesh position={[0, 0.32, -0.85]} rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
        <cylinderGeometry args={[0.14, 0.14, 1.5, 12]} />
      </mesh>
      {/* Barrel band */}
      <mesh position={[0, 0.32, -0.4]} rotation={[Math.PI / 2, 0, 0]} material={m.bodyMid}>
        <cylinderGeometry args={[0.16, 0.16, 0.08, 12]} />
      </mesh>
      {/* Pump */}
      <mesh position={[0, 0.12, -0.35]} material={m.grip}>
        <boxGeometry args={[0.3, 0.22, 0.5]} />
      </mesh>
      {[-0.18, -0.06, 0.06, 0.18].map((z) => (
        <mesh key={z} position={[0, 0.12, -0.35 + z]} material={m.dark}>
          <boxGeometry args={[0.31, 0.24, 0.03]} />
        </mesh>
      ))}
      {/* Pump cyan stripe */}
      <mesh position={[0.155, 0.12, -0.35]} material={m.cyan}>
        <boxGeometry args={[0.005, 0.06, 0.45]} />
      </mesh>
      {/* Stock */}
      <mesh position={[0, 0.18, 0.95]} rotation={[-0.08, 0, 0]} material={m.body}>
        <boxGeometry args={[0.18, 0.46, 0.6]} />
      </mesh>
      {/* Stock magenta LED */}
      <mesh position={[0, 0.36, 1.2]} rotation={[-0.08, 0, 0]} material={m.magenta}>
        <boxGeometry args={[0.06, 0.02, 0.04]} />
      </mesh>
      {/* Trigger guard */}
      <mesh position={[0, 0, 0.25]} material={m.dark}>
        <torusGeometry args={[0.07, 0.018, 8, 16]} />
      </mesh>
    </group>
  );
}

/* ----------------------------- Sniper DL-Q33 ----------------------------- */
function Sniper() {
  const m = useNeonMats();
  return (
    <group scale={1.05} position={[0, 0.05, 0.1]}>
      {/* Frame */}
      <mesh position={[0, 0.26, 0.55]} material={m.body}>
        <boxGeometry args={[0.2, 0.36, 1.4]} />
      </mesh>
      {/* Long barrel */}
      <mesh position={[0, 0.32, -1.1]} rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
        <cylinderGeometry args={[0.04, 0.04, 3.0, 8]} />
      </mesh>
      {/* Heavy muzzle */}
      <mesh position={[0, 0.32, -2.6]} material={m.body}>
        <boxGeometry args={[0.16, 0.16, 0.22]} />
      </mesh>
      {/* Muzzle amber tip */}
      <mesh position={[0, 0.32, -2.75]} material={m.amber}>
        <boxGeometry args={[0.1, 0.1, 0.04]} />
      </mesh>
      {/* Scope rail */}
      <mesh position={[0, 0.46, 0.3]} material={m.dark}>
        <boxGeometry args={[0.1, 0.04, 0.9]} />
      </mesh>
      {/* Scope body */}
      <group position={[0, 0.6, 0.3]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
          <cylinderGeometry args={[0.13, 0.13, 0.95, 16]} />
        </mesh>
        {/* Cyan ring back */}
        <mesh position={[0, 0, 0.48]} rotation={[Math.PI / 2, 0, 0]} material={m.cyan}>
          <torusGeometry args={[0.13, 0.012, 8, 24]} />
        </mesh>
        {/* Lens (front, looking down barrel) */}
        <mesh position={[0, 0, -0.48]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.11, 24]} />
          <meshBasicMaterial color={NEON_CYAN} transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* Bolt action */}
      <mesh position={[0.18, 0.36, 0.55]} rotation={[0, 0, -0.4]} material={m.bodyMid}>
        <cylinderGeometry args={[0.025, 0.025, 0.18, 8]} />
      </mesh>
      <mesh position={[0.27, 0.32, 0.55]} material={m.dark}>
        <sphereGeometry args={[0.04, 8, 8]} />
      </mesh>
      {/* Magazine */}
      <mesh position={[0, -0.05, 0.45]} material={m.dark}>
        <boxGeometry args={[0.16, 0.32, 0.34]} />
      </mesh>
      {/* Stock */}
      <mesh position={[0, 0.22, 1.4]} material={m.body}>
        <boxGeometry args={[0.16, 0.4, 0.7]} />
      </mesh>
      {/* Cheek rest cyan */}
      <mesh position={[0, 0.42, 1.4]} material={m.cyan}>
        <boxGeometry args={[0.08, 0.02, 0.5]} />
      </mesh>
      {/* Bipod (folded) */}
      <mesh position={[0, 0.08, -0.7]} material={m.dark}>
        <boxGeometry args={[0.22, 0.06, 0.4]} />
      </mesh>
    </group>
  );
}

/* ----------------------------- Hands ----------------------------- */
function Hands({ type, reloadProgress }: any) {
  const leftRef = useRef<THREE.Group>(null);
  const rightRef = useRef<THREE.Group>(null);
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
        emissiveIntensity: 0.85,
      }),
    }),
    [],
  );

  // Position the front (left) hand on the foregrip per weapon
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
      // Left hand pulls down/back during reload
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
        {/* Sleeve */}
        <mesh position={[-0.15, 0.05, 0.25]} rotation={[1.2, 0, 0]} material={m.sleeve}>
          <cylinderGeometry args={[0.11, 0.13, 0.9, 8]} />
        </mesh>
        {/* Cuff */}
        <mesh position={[-0.18, 0.08, 0.55]} rotation={[1.2, 0, 0]} material={m.cuff}>
          <torusGeometry args={[0.13, 0.012, 6, 16]} />
        </mesh>
        {/* Glove */}
        <mesh material={m.glove}>
          <boxGeometry args={[0.18, 0.16, 0.22]} />
        </mesh>
        {/* Fingers */}
        <mesh position={[0.05, -0.04, -0.04]} rotation={[0, 0, -0.3]} material={m.glove}>
          <boxGeometry args={[0.06, 0.06, 0.18]} />
        </mesh>
      </group>

      {/* Rear (right) trigger hand */}
      <group ref={rightRef} position={rightPos} rotation={[-0.1, -0.3, 0]}>
        <mesh position={[0.15, 0.0, 0.3]} rotation={[1.4, 0, 0]} material={m.sleeve}>
          <cylinderGeometry args={[0.11, 0.13, 0.95, 8]} />
        </mesh>
        <mesh position={[0.18, 0.04, 0.6]} rotation={[1.4, 0, 0]} material={m.cuff}>
          <torusGeometry args={[0.13, 0.012, 6, 16]} />
        </mesh>
        <mesh material={m.glove}>
          <boxGeometry args={[0.18, 0.16, 0.22]} />
        </mesh>
        {/* Trigger finger */}
        <mesh position={[-0.04, -0.05, -0.06]} rotation={[0.4, 0, 0.2]} material={m.glove}>
          <boxGeometry args={[0.05, 0.05, 0.16]} />
        </mesh>
      </group>
    </>
  );
}
