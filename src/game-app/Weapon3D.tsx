// @ts-nocheck
import React, { useRef, useMemo, useEffect, Suspense, Component } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

useGLTF.preload("/assets/weapons/pistol.glb");
useGLTF.preload("/assets/weapons/rifle.glb");
useGLTF.preload("/assets/weapons/shotgun.glb");
useGLTF.preload("/assets/weapons/sniper.glb");

/**
 * Weapon3D — first-person viewmodel layer rendered in its own overlay Canvas.
 * Loads the GLB weapons from /assets/weapons with animated recoil, reload,
 * swap, fire kick and muzzle flash.
 */

const NEON_CYAN = "#22d3ee";

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
        position: "absolute",
        bottom: 0,
        right: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ pointerEvents: "none" }}
        dpr={[0.75, 1]}
        gl={{ antialias: false, powerPreference: "low-power" }}
      >
        {/* Minimal lighting for the viewmodel rig */}
        <ambientLight intensity={1.4} color="#cfd8e8" />
        <directionalLight position={[3, 5, 4]} intensity={1.6} color="#ffffff" />
        <pointLight position={[1.2, -0.5, 2.5]} intensity={1.0} color={NEON_CYAN} distance={6} />
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
      case "sniper":
        return { x: 1.15, y: -1.05, z: 2.4, ry: -0.13, rx: 0.04 };
      case "shotgun":
        return { x: 1.1, y: -1.05, z: 2.7, ry: -0.12, rx: 0.05 };
      case "rifle":
        return { x: 1.05, y: -1.0, z: 2.8, ry: -0.11, rx: 0.04 };
      case "pistol":
      default:
        return { x: 0.95, y: -0.9, z: 3.1, ry: -0.18, rx: 0.06 };
    }
  }, [type]);

  // Per-weapon recoil weights
  const recoilWeight =
    type === "sniper" ? 1.6 : type === "shotgun" ? 1.35 : type === "rifle" ? 0.9 : 0.8;

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

    // Reload — tilts the gun down and pumps. These offsets must be part of
    // the lerp TARGETS below; adding them after the lerp creates a feedback
    // loop that flips the gun upside-down and drops it off screen.
    reloadProgress.current = THREE.MathUtils.lerp(
      reloadProgress.current,
      isReloading ? 1 : 0,
      0.14,
    );
    const rp = reloadProgress.current;
    const reloadPump = Math.sin(t * 9) * 0.06 * rp;

    // ADS target
    const targetX = (isAds ? 0 : restPose.x + swayX) + rp * 0.12;
    const targetY =
      (isAds ? -0.32 : restPose.y + swayY * 0.5 + breath + swapRef.current.y) - rp * 0.45;
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
      restPose.rx + recoilOffset * 0.22 + fk * 0.35 + rp * 0.65 + reloadPump,
      0.18,
    );
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      isAds ? 0 : restPose.ry,
      0.12,
    );
    group.current.rotation.z = THREE.MathUtils.lerp(
      group.current.rotation.z,
      (isAds ? 0 : -0.04 + Math.sin(t * 1.1) * 0.012) - rp * 0.25,
      0.1,
    );
  });

  return (
    <group ref={group}>
      <MuzzleFlash lastShotTime={lastShotTime} type={type} />
      <WeaponErrorBoundary type={type}>
        <Suspense fallback={null}>
          <WeaponModel
            type={type}
            fireKick={fireKickRef}
            lastShotTime={lastShotTime}
            isReloading={isReloading}
          />
        </Suspense>
      </WeaponErrorBoundary>
    </group>
  );
}

/* --------------------------- Error boundary --------------------------- */
class WeaponErrorBoundary extends Component<any, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() {
    return { err: true };
  }
  componentDidCatch(e: any) {
    console.error("[Weapon3D] failed to render", this.props.type, e);
  }
  componentDidUpdate(prev: any) {
    if (prev.type !== this.props.type && this.state.err) this.setState({ err: false });
  }
  render() {
    return this.state.err ? null : this.props.children;
  }
}

/* ----------------------------- GLB Weapon Model ----------------------------- */
// Per-weapon config. Each source GLB has a different "forward" axis and origin,
// so we apply a manual rotation that points the barrel toward -Z, then auto-fit
// the rotated bounding box to targetLength. Meshes matching `hideMeshes`
// (e.g. baked-in arms) are hidden so the weapon shows without duplicate hands.
const WEAPON_MODELS: Record<
  string,
  {
    url: string;
    targetLength: number;
    offset: [number, number, number];
    kickZ: number;
    hideMeshes?: RegExp;
    extraRotation?: [number, number, number];
  }
> = {
  pistol: {
    url: "/assets/weapons/pistol.glb",
    targetLength: 1.6,
    offset: [0.05, -0.05, 0.2],
    kickZ: 0.18,
    hideMeshes: /arm|hand|glove|finger|forearm|wrist|skin|body/i,
  },
  rifle: {
    url: "/assets/weapons/rifle.glb",
    targetLength: 2.4,
    offset: [0, -0.1, 0.1],
    kickZ: 0.14,
  },
  shotgun: {
    url: "/assets/weapons/shotgun.glb",
    targetLength: 2.4,
    offset: [0, -0.05, 0.1],
    kickZ: 0.28,
  },
  sniper: {
    url: "/assets/weapons/sniper.glb",
    targetLength: 3.2,
    offset: [0, -0.05, -0.2],
    kickZ: 0.22,
  },
};

// Auto-orient: detect longest axis of bbox and build a rotation that
// aligns that axis to -Z (barrel forward). Returns Euler angles.
function autoBarrelRotation(size: THREE.Vector3): [number, number, number] {
  const ax = size.x,
    ay = size.y,
    az = size.z;
  // Longest axis becomes -Z
  if (ax >= ay && ax >= az) {
    // X longest → rotate -90° around Y so +X maps to -Z
    return [0, -Math.PI / 2, 0];
  }
  if (ay >= ax && ay >= az) {
    // Y longest → rotate +90° around X so +Y maps to -Z
    return [Math.PI / 2, 0, 0];
  }
  // Z longest → already aligned (assume +Z, flip 180° around Y to point -Z)
  return [0, Math.PI, 0];
}

function WeaponModel({
  type,
  fireKick,
  lastShotTime,
  isReloading,
}: {
  type: string;
  fireKick: any;
  lastShotTime: number;
  isReloading: boolean;
}) {
  const cfg = WEAPON_MODELS[type] ?? WEAPON_MODELS.pistol;
  const gltf = useGLTF(cfg.url);
  const groupRef = useRef<THREE.Group>(null);

  const { scene, fit, rotation, mixer, fireAction, reloadAction, fireDuration } = useMemo(() => {
    const cloned = gltf.scene.clone(true);

    if (cfg.hideMeshes) {
      cloned.traverse((obj: any) => {
        if (obj.isMesh && cfg.hideMeshes!.test(obj.name ?? "")) obj.visible = false;
      });
    }

    cloned.traverse((obj: any) => {
      if (!obj.isMesh) return;
      obj.castShadow = false;
      obj.receiveShadow = false;
      obj.frustumCulled = false;
      const mat = obj.material;
      const boost = (mm: any) => {
        if (!mm) return;
        if (mm.color?.isColor) {
          const hsl = { h: 0, s: 0, l: 0 };
          mm.color.getHSL(hsl);
          if (hsl.l < 0.25) mm.color.setHSL(hsl.h, hsl.s, 0.35);
        }
        if (mm.emissive) {
          if (mm.emissive.getHex() === 0x000000) mm.emissive.set("#1a2236");
          mm.emissiveIntensity = Math.max(mm.emissiveIntensity ?? 0, 0.35);
        }
        if ("metalness" in mm) mm.metalness = Math.min(mm.metalness ?? 0.3, 0.6);
        if ("roughness" in mm) mm.roughness = Math.max(mm.roughness ?? 0.5, 0.4);
        mm.needsUpdate = true;
      };
      // clone(true) shares materials with drei's GLTF cache — clone them
      // before mutating or the boost leaks into every other consumer.
      if (Array.isArray(mat)) {
        obj.material = mat.map((m: any) => {
          const c = m.clone();
          boost(c);
          return c;
        });
      } else if (mat) {
        obj.material = mat.clone();
        boost(obj.material);
      }
    });

    const box = new THREE.Box3();
    cloned.traverse((obj: any) => {
      if (obj.isMesh && obj.visible) box.expandByObject(obj);
    });
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const rotation = cfg.extraRotation ?? autoBarrelRotation(size);
    const longest = Math.max(size.x, size.y, size.z) || 1;
    const scale = cfg.targetLength / longest;

    // Animation setup — supports clips named fire/shoot/reload, or a single
    // combined clip (e.g. "firereload"): in that case fire plays only the
    // first ~25% (slide cycle) and reload plays the full clip.
    let mixer: THREE.AnimationMixer | null = null;
    let fireAction: THREE.AnimationAction | null = null;
    let reloadAction: THREE.AnimationAction | null = null;
    let fireDuration = 0;
    const clips = (gltf as any).animations as THREE.AnimationClip[] | undefined;
    if (clips && clips.length > 0) {
      mixer = new THREE.AnimationMixer(cloned);
      const findClip = (re: RegExp) => clips.find((c) => re.test(c.name));
      const fireClip = findClip(/^fire$|shoot/i) ?? clips[0];
      const reloadClip = findClip(/reload/i) ?? clips[0];
      if (fireClip) {
        fireAction = mixer.clipAction(fireClip.clone());
        fireAction.setLoop(THREE.LoopOnce, 1);
        fireAction.clampWhenFinished = false;
        fireDuration =
          fireClip === reloadClip ? Math.min(0.28, fireClip.duration * 0.25) : fireClip.duration;
      }
      if (reloadClip) {
        reloadAction = mixer.clipAction(reloadClip.clone());
        reloadAction.setLoop(THREE.LoopOnce, 1);
        reloadAction.clampWhenFinished = true;
      }
    }

    return {
      scene: cloned,
      fit: { scale, center },
      rotation,
      mixer,
      fireAction,
      reloadAction,
      fireDuration,
    };
  }, [gltf.scene, cfg.targetLength, cfg.hideMeshes, cfg.extraRotation]);

  const lastShotRef = useRef(0);
  const lastReloadRef = useRef(false);
  const fireActiveUntil = useRef(0);

  // Tear down the previous weapon's mixer/clone when switching weapons,
  // otherwise each switch leaks a running AnimationMixer and its materials.
  useEffect(() => {
    return () => {
      if (mixer) {
        mixer.stopAllAction();
        mixer.uncacheRoot(scene);
      }
      scene.traverse((obj: any) => {
        if (!obj.isMesh) return;
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m: any) => m?.dispose?.());
        else mat?.dispose?.();
      });
    };
  }, [mixer, scene]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      const k = fireKick?.current ?? 0;
      groupRef.current.position.z = cfg.offset[2] + k * cfg.kickZ;
    }

    if (!mixer) return;

    // Rising edge: new shot -> play fire portion
    if (fireAction && lastShotTime !== lastShotRef.current && lastShotTime > 0) {
      lastShotRef.current = lastShotTime;
      if (!isReloading) {
        fireAction.reset();
        fireAction.setEffectiveTimeScale(1);
        fireAction.play();
        fireActiveUntil.current = performance.now() + fireDuration * 1000;
      }
    }

    // Stop fire after its window so slide returns and we don't bleed into reload pose
    if (fireAction && fireActiveUntil.current > 0 && performance.now() > fireActiveUntil.current) {
      fireAction.stop();
      fireActiveUntil.current = 0;
    }

    // Rising edge: reload start
    if (reloadAction && isReloading !== lastReloadRef.current) {
      lastReloadRef.current = isReloading;
      if (isReloading) {
        if (fireAction) fireAction.stop();
        fireActiveUntil.current = 0;
        reloadAction.reset();
        reloadAction.setEffectiveTimeScale(1);
        reloadAction.play();
      } else {
        reloadAction.stop();
      }
    }

    mixer.update(delta);
  });

  const invRot = useMemo(() => {
    const e = new THREE.Euler(rotation[0], rotation[1], rotation[2]);
    const q = new THREE.Quaternion().setFromEuler(e).invert();
    const c = new THREE.Vector3(fit.center.x, fit.center.y, fit.center.z).applyQuaternion(q);
    return [-c.x * fit.scale, -c.y * fit.scale, -c.z * fit.scale] as [number, number, number];
  }, [rotation, fit.center, fit.scale]);

  return (
    <group ref={groupRef} position={cfg.offset} rotation={rotation as any}>
      <primitive object={scene} scale={fit.scale} position={invRot} />
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
      case "shotgun":
        return { scale: 1.8, life: 110, light: 26 };
      case "sniper":
        return { scale: 1.5, life: 130, light: 30 };
      case "rifle":
        return { scale: 1.05, life: 75, light: 18 };
      case "pistol":
      default:
        return { scale: 0.85, life: 65, light: 14 };
    }
  }, [type]);

  // Per-weapon muzzle Z position
  const muzzleZ =
    type === "sniper" ? -3.3 : type === "shotgun" ? -2.1 : type === "rifle" ? -2.55 : -1.7;

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
      <pointLight ref={lightRef} color={"#fef9c3"} intensity={0} distance={9} decay={2} />
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
