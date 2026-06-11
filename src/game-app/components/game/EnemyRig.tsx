// @ts-nocheck
// Part-based procedural enemies. Replaces the GLB-as-gameplay strategy on
// Medium/High: each enemy is composed of a small set of meshes whose limbs,
// torso, weapon and visor are animated by code per anim state (idle / move /
// attack / death). The silhouettes, palette and visor/core accents are
// deliberately tuned to look like reinterpretations of the existing GLBs in
// public/assets/models/enemies/, but without depending on their broken rigs.
//
// Art rules (see docs/art-bible.md):
//  - Body shells stay neutral metallic gray; the type color only lights
//    visors, cores, vents and a ground ring.
//  - Pulse uses emissiveIntensity only — never floods the whole body.
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type AnimState = "idle" | "move" | "attack" | "shoot" | "death";

interface RigProps {
  cellSize: number;
  color: string;
  animState: AnimState;
  hp: number;
  lastShot?: number;
}

// ---------- shared materials ----------
function useRigMats(color: string) {
  return useMemo(() => {
    const shellDark = new THREE.MeshStandardMaterial({
      color: "#1a2333",
      roughness: 0.55,
      metalness: 0.55,
    });
    const shellMid = new THREE.MeshStandardMaterial({
      color: "#2b384f",
      roughness: 0.5,
      metalness: 0.6,
    });
    const shellLight = new THREE.MeshStandardMaterial({
      color: "#3b4a66",
      roughness: 0.45,
      metalness: 0.55,
    });
    const visor = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 1.4,
      roughness: 0.2,
      metalness: 0.1,
      toneMapped: false,
    });
    const core = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 1.7,
      roughness: 0.25,
      metalness: 0.2,
      toneMapped: false,
    });
    const accentSoft = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.55,
      roughness: 0.4,
      metalness: 0.4,
      toneMapped: false,
    });
    const weapon = new THREE.MeshStandardMaterial({
      color: "#0f1623",
      roughness: 0.35,
      metalness: 0.85,
    });
    return { shellDark, shellMid, shellLight, visor, core, accentSoft, weapon };
  }, [color]);
}

function GroundRing({ cellSize, color, boss = false }: any) {
  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[cellSize * (boss ? 0.5 : 0.24), cellSize * (boss ? 0.6 : 0.31), 28]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.42}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

// Smooth lerp helper for refs
function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k;
}

// ============================================================
// RUSHER  — low crouched melee creature, two slashing claws
// ============================================================
function RusherRig({ cellSize, color, animState, hp, lastShot = 0 }: RigProps) {
  const m = useRigMats(color);
  const s = cellSize;
  const body = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const headBob = useRef<THREE.Group>(null);
  const clawL = useRef<THREE.Group>(null);
  const clawR = useRef<THREE.Group>(null);
  const visorMat = m.visor;
  const lungeRef = useRef(0);

  useFrame((state, delta) => {
    if (!body.current || !torso.current || !clawL.current || !clawR.current || !headBob.current)
      return;
    const t = state.clock.getElapsedTime();
    const dying = hp <= 0;
    const sinceShot = (Date.now() - lastShot) / 1000;
    const attackPulse =
      animState === "attack" || animState === "shoot" ? Math.max(0, 1 - sinceShot / 0.25) : 0;
    lungeRef.current = lerp(lungeRef.current, attackPulse, Math.min(1, delta * 14));

    if (dying) {
      body.current.rotation.x = lerp(body.current.rotation.x, 1.0, Math.min(1, delta * 5));
      body.current.position.y = lerp(body.current.position.y, -s * 0.1, Math.min(1, delta * 5));
      clawL.current.rotation.x = lerp(clawL.current.rotation.x, -1.2, Math.min(1, delta * 5));
      clawR.current.rotation.x = lerp(clawR.current.rotation.x, -1.2, Math.min(1, delta * 5));
      visorMat.emissiveIntensity = lerp(visorMat.emissiveIntensity, 0.1, Math.min(1, delta * 4));
      return;
    }

    const moving = animState === "move";
    const f = moving ? 11 : 3.4;
    const bob = moving ? 0.06 : 0.018;
    body.current.position.y = Math.abs(Math.sin(t * f)) * s * bob;
    body.current.rotation.x = 0.28 + lungeRef.current * 0.18;
    body.current.position.z = lungeRef.current * s * 0.18;

    // head/visor scans side to side when idle, locks forward on attack
    headBob.current.rotation.y = moving ? Math.sin(t * f * 0.5) * 0.12 : Math.sin(t * 1.6) * 0.18;
    visorMat.emissiveIntensity = 1.2 + Math.sin(t * 6) * 0.25 + lungeRef.current * 1.0;

    // claws swing opposite while running, snap in on attack
    const swing = moving ? Math.sin(t * f) * 0.9 : Math.sin(t * 2.2) * 0.15;
    clawL.current.rotation.x = 0.4 - swing + lungeRef.current * 1.1;
    clawR.current.rotation.x = 0.4 + swing + lungeRef.current * 1.1;
    clawL.current.rotation.z = 0.25 - lungeRef.current * 0.4;
    clawR.current.rotation.z = -0.25 + lungeRef.current * 0.4;
  });

  return (
    <group ref={body} position={[0, s * 0.3, 0]}>
      {/* low torso */}
      <group ref={torso}>
        <mesh material={m.shellDark} scale={[s * 0.5, s * 0.28, s * 0.62]}>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        <mesh
          material={m.shellMid}
          position={[0, s * 0.14, 0]}
          scale={[s * 0.42, s * 0.16, s * 0.5]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        {/* dorsal spine accent */}
        <mesh
          material={m.accentSoft}
          position={[0, s * 0.22, 0]}
          scale={[s * 0.06, s * 0.05, s * 0.58]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>

        {/* head + visor — model forward is +Z (yaw aligns +Z with movement) */}
        <group ref={headBob} position={[0, s * 0.08, s * 0.34]}>
          <mesh material={m.shellMid} scale={[s * 0.28, s * 0.2, s * 0.24]}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          <mesh
            material={visorMat}
            position={[0, s * 0.02, s * 0.1]}
            scale={[s * 0.22, s * 0.07, s * 0.03]}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        </group>

        {/* legs (static stance) */}
        {[-1, 1].map((dx) => (
          <mesh
            key={`leg${dx}`}
            material={m.shellDark}
            position={[dx * s * 0.16, -s * 0.2, -s * 0.05]}
            scale={[s * 0.12, s * 0.22, s * 0.16]}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        ))}
      </group>

      {/* articulated claw arms */}
      <group ref={clawL} position={[-s * 0.32, s * 0.05, s * 0.05]}>
        <mesh
          material={m.shellMid}
          position={[0, 0, s * 0.18]}
          scale={[s * 0.07, s * 0.07, s * 0.42]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        <mesh
          material={m.accentSoft}
          position={[0, 0, s * 0.42]}
          rotation={[0, 0, 0.4]}
          scale={[s * 0.04, s * 0.13, s * 0.22]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        <mesh
          material={m.accentSoft}
          position={[0, 0, s * 0.42]}
          rotation={[0, 0, -0.4]}
          scale={[s * 0.04, s * 0.13, s * 0.22]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      </group>
      <group ref={clawR} position={[s * 0.32, s * 0.05, s * 0.05]}>
        <mesh
          material={m.shellMid}
          position={[0, 0, s * 0.18]}
          scale={[s * 0.07, s * 0.07, s * 0.42]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        <mesh
          material={m.accentSoft}
          position={[0, 0, s * 0.42]}
          rotation={[0, 0, 0.4]}
          scale={[s * 0.04, s * 0.13, s * 0.22]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        <mesh
          material={m.accentSoft}
          position={[0, 0, s * 0.42]}
          rotation={[0, 0, -0.4]}
          scale={[s * 0.04, s * 0.13, s * 0.22]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      </group>

      <GroundRing cellSize={s} color={color} />
    </group>
  );
}

// ============================================================
// RIFLEMAN — boxy soldier, holds rifle, recoils on shoot
// ============================================================
function RiflemanRig({ cellSize, color, animState, hp, lastShot = 0 }: RigProps) {
  const m = useRigMats(color);
  const s = cellSize;
  const body = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const muzzle = useRef<THREE.Mesh>(null);
  const visorMat = m.visor;
  const recoilRef = useRef(0);

  useFrame((state, delta) => {
    if (
      !body.current ||
      !torso.current ||
      !legL.current ||
      !legR.current ||
      !armL.current ||
      !armR.current
    )
      return;
    const t = state.clock.getElapsedTime();
    const dying = hp <= 0;
    const sinceShot = (Date.now() - lastShot) / 1000;
    const recoilPulse =
      animState === "attack" || animState === "shoot" ? Math.max(0, 1 - sinceShot / 0.18) : 0;
    recoilRef.current = lerp(recoilRef.current, recoilPulse, Math.min(1, delta * 18));

    if (muzzle.current) {
      const show = sinceShot < 0.07;
      muzzle.current.visible = show;
      muzzle.current.scale.setScalar(show ? 1.6 : 0.4);
    }

    if (dying) {
      body.current.rotation.x = lerp(body.current.rotation.x, 1.2, Math.min(1, delta * 4));
      body.current.position.y = lerp(body.current.position.y, -s * 0.18, Math.min(1, delta * 4));
      legL.current.rotation.x = 0;
      legR.current.rotation.x = 0;
      visorMat.emissiveIntensity = lerp(visorMat.emissiveIntensity, 0.1, Math.min(1, delta * 4));
      return;
    }

    const moving = animState === "move";
    const f = moving ? 6.5 : 2.0;
    const stride = moving ? 0.7 : 0.05;
    legL.current.rotation.x = Math.sin(t * f) * stride;
    legR.current.rotation.x = -Math.sin(t * f) * stride;
    body.current.position.y = moving
      ? Math.abs(Math.sin(t * f * 2)) * s * 0.025
      : Math.sin(t * 2) * s * 0.008;
    torso.current.rotation.y = moving ? Math.sin(t * f) * 0.08 : Math.sin(t * 1.8) * 0.04;

    // arms holding rifle (forward = +Z), recoil pushes torso back (-Z)
    armR.current.rotation.x = 1.05 + recoilRef.current * 0.35;
    armL.current.rotation.x = 1.0 + recoilRef.current * 0.2;
    torso.current.position.z = -recoilRef.current * s * 0.06;
    visorMat.emissiveIntensity = 1.1 + recoilRef.current * 1.2 + Math.sin(t * 4) * 0.1;
  });

  return (
    <group ref={body} position={[0, s * 0.5, 0]}>
      <group ref={torso}>
        {/* torso */}
        <mesh material={m.shellDark} scale={[s * 0.42, s * 0.5, s * 0.3]}>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        {/* chest plate accent */}
        <mesh
          material={m.accentSoft}
          position={[0, s * 0.05, s * 0.16]}
          scale={[s * 0.18, s * 0.12, s * 0.02]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        {/* shoulders */}
        {[-1, 1].map((dx) => (
          <mesh
            key={`sh${dx}`}
            material={m.shellMid}
            position={[dx * s * 0.27, s * 0.2, 0]}
            scale={[s * 0.16, s * 0.14, s * 0.28]}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        ))}
        {/* head + visor band */}
        <mesh
          material={m.shellMid}
          position={[0, s * 0.38, 0]}
          scale={[s * 0.26, s * 0.22, s * 0.24]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        <mesh
          material={visorMat}
          position={[0, s * 0.38, s * 0.13]}
          scale={[s * 0.2, s * 0.05, s * 0.025]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>

        {/* arms — rifle points forward (+Z), matching the visor */}
        <group ref={armL} position={[-s * 0.27, s * 0.1, 0]}>
          <mesh
            material={m.shellMid}
            position={[0, -s * 0.05, s * 0.18]}
            scale={[s * 0.1, s * 0.1, s * 0.36]}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        </group>
        <group ref={armR} position={[s * 0.27, s * 0.1, 0]}>
          <mesh
            material={m.shellMid}
            position={[0, -s * 0.05, s * 0.18]}
            scale={[s * 0.1, s * 0.1, s * 0.36]}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          {/* rifle */}
          <mesh
            material={m.weapon}
            position={[0, -s * 0.08, s * 0.42]}
            scale={[s * 0.06, s * 0.08, s * 0.58]}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          {/* energy strip on rifle */}
          <mesh
            material={m.accentSoft}
            position={[0, -s * 0.13, s * 0.42]}
            scale={[s * 0.04, s * 0.015, s * 0.42]}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          {/* muzzle flash */}
          <mesh ref={muzzle} visible={false} position={[0, -s * 0.08, s * 0.74]} material={m.visor}>
            <sphereGeometry args={[s * 0.06, 10, 10]} />
          </mesh>
        </group>
      </group>

      {/* legs */}
      <group ref={legL} position={[-s * 0.1, -s * 0.28, 0]}>
        <mesh
          material={m.shellDark}
          position={[0, -s * 0.15, 0]}
          scale={[s * 0.13, s * 0.32, s * 0.16]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      </group>
      <group ref={legR} position={[s * 0.1, -s * 0.28, 0]}>
        <mesh
          material={m.shellDark}
          position={[0, -s * 0.15, 0]}
          scale={[s * 0.13, s * 0.32, s * 0.16]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      </group>

      <GroundRing cellSize={s} color={color} />
    </group>
  );
}

// ============================================================
// SNIPER — tall, thin, long rifle with scope laser
// ============================================================
function SniperRig({ cellSize, color, animState, hp, lastShot = 0 }: RigProps) {
  const m = useRigMats(color);
  const s = cellSize;
  const body = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const rifle = useRef<THREE.Group>(null);
  const laser = useRef<THREE.Mesh>(null);
  const muzzle = useRef<THREE.Mesh>(null);
  const scopeMat = m.core;
  const recoilRef = useRef(0);

  useFrame((state, delta) => {
    if (!body.current || !torso.current || !legL.current || !legR.current || !rifle.current) return;
    const t = state.clock.getElapsedTime();
    const dying = hp <= 0;
    const sinceShot = (Date.now() - lastShot) / 1000;
    const recoilPulse =
      animState === "attack" || animState === "shoot" ? Math.max(0, 1 - sinceShot / 0.32) : 0;
    recoilRef.current = lerp(recoilRef.current, recoilPulse, Math.min(1, delta * 10));

    if (laser.current) laser.current.visible = sinceShot > 0.4 && sinceShot < 1.2 && !dying;
    if (muzzle.current) {
      const show = sinceShot < 0.1;
      muzzle.current.visible = show;
      muzzle.current.scale.setScalar(show ? 2 : 0.4);
    }

    if (dying) {
      body.current.rotation.z = lerp(body.current.rotation.z, 1.3, Math.min(1, delta * 3.5));
      body.current.position.y = lerp(body.current.position.y, -s * 0.18, Math.min(1, delta * 3.5));
      scopeMat.emissiveIntensity = lerp(scopeMat.emissiveIntensity, 0.1, Math.min(1, delta * 4));
      return;
    }

    const moving = animState === "move";
    const f = moving ? 4.2 : 1.4;
    const stride = moving ? 0.4 : 0.04;
    legL.current.rotation.x = Math.sin(t * f) * stride;
    legR.current.rotation.x = -Math.sin(t * f) * stride;
    body.current.position.y = moving ? Math.abs(Math.sin(t * f * 2)) * s * 0.015 : 0;

    // rifle aims slightly, recoils strongly (kick pushes back along -Z)
    rifle.current.position.z = -recoilRef.current * s * 0.18;
    rifle.current.rotation.x = recoilRef.current * 0.25;
    torso.current.rotation.x = recoilRef.current * 0.08;

    // scope pulses, gets brighter when charging next shot
    const charge = Math.min(1, sinceShot / 1.5);
    scopeMat.emissiveIntensity = 1.0 + Math.sin(t * 3) * 0.2 + charge * 0.8;
  });

  return (
    <group ref={body} position={[0, s * 0.56, 0]}>
      <group ref={torso}>
        {/* thin torso */}
        <mesh material={m.shellDark} scale={[s * 0.22, s * 0.7, s * 0.2]}>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        <mesh
          material={m.shellMid}
          position={[0, s * 0.45, 0]}
          scale={[s * 0.2, s * 0.18, s * 0.22]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        {/* visor */}
        <mesh
          material={m.visor}
          position={[0, s * 0.45, s * 0.12]}
          scale={[s * 0.14, s * 0.04, s * 0.02]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        {/* antenna */}
        <mesh
          material={m.accentSoft}
          position={[0, s * 0.62, -s * 0.06]}
          scale={[s * 0.02, s * 0.16, s * 0.02]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>

        {/* long rifle on right shoulder, barrel forward (+Z) */}
        <group ref={rifle} position={[s * 0.16, s * 0.2, s * 0.15]}>
          <mesh
            material={m.weapon}
            position={[0, 0, s * 0.05]}
            scale={[s * 0.06, s * 0.07, s * 0.95]}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          {/* scope */}
          <mesh material={scopeMat} position={[0, s * 0.08, 0]}>
            <sphereGeometry args={[s * 0.05, 12, 12]} />
          </mesh>
          {/* muzzle flash */}
          <mesh ref={muzzle} visible={false} position={[0, 0, s * 0.54]} material={m.visor}>
            <sphereGeometry args={[s * 0.07, 10, 10]} />
          </mesh>
          {/* aim laser */}
          <mesh
            ref={laser}
            visible={false}
            position={[0, 0, s * 1.2]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.012, 0.012, s * 1.8, 6]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.6}
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>

      {/* legs */}
      <group ref={legL} position={[-s * 0.07, -s * 0.34, 0]}>
        <mesh
          material={m.shellDark}
          position={[0, -s * 0.16, 0]}
          scale={[s * 0.09, s * 0.34, s * 0.12]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      </group>
      <group ref={legR} position={[s * 0.07, -s * 0.34, 0]}>
        <mesh
          material={m.shellDark}
          position={[0, -s * 0.16, 0]}
          scale={[s * 0.09, s * 0.34, s * 0.12]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      </group>

      <GroundRing cellSize={s} color={color} />
    </group>
  );
}

// ============================================================
// TITAN — large hunched boss with glowing chest core
// ============================================================
function TitanRig({ cellSize, color, animState, hp, lastShot = 0 }: RigProps) {
  const m = useRigMats(color);
  const s = cellSize;
  const body = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const coreMesh = useRef<THREE.Mesh>(null);
  const coreMat = m.core;
  const visorMat = m.visor;
  const slamRef = useRef(0);

  useFrame((state, delta) => {
    if (
      !body.current ||
      !torso.current ||
      !armL.current ||
      !armR.current ||
      !legL.current ||
      !legR.current
    )
      return;
    const t = state.clock.getElapsedTime();
    const dying = hp <= 0;
    const sinceShot = (Date.now() - lastShot) / 1000;
    const slamPulse =
      animState === "attack" || animState === "shoot" ? Math.max(0, 1 - sinceShot / 0.45) : 0;
    slamRef.current = lerp(slamRef.current, slamPulse, Math.min(1, delta * 8));

    if (dying) {
      body.current.rotation.x = lerp(body.current.rotation.x, 1.0, Math.min(1, delta * 3));
      body.current.position.y = lerp(body.current.position.y, -s * 0.3, Math.min(1, delta * 3));
      coreMat.emissiveIntensity = lerp(coreMat.emissiveIntensity, 0.2, Math.min(1, delta * 3));
      visorMat.emissiveIntensity = lerp(visorMat.emissiveIntensity, 0.1, Math.min(1, delta * 3));
      return;
    }

    const moving = animState === "move";
    const f = moving ? 2.3 : 0.9;
    // heavy stomp
    legL.current.rotation.x = Math.sin(t * f) * (moving ? 0.45 : 0.05);
    legR.current.rotation.x = -Math.sin(t * f) * (moving ? 0.45 : 0.05);
    body.current.position.y = moving
      ? Math.abs(Math.sin(t * f * 2)) * s * 0.06
      : Math.sin(t * 1.1) * s * 0.025;
    body.current.rotation.x = 0.12 + slamRef.current * 0.35;
    torso.current.rotation.y = moving ? Math.sin(t * f) * 0.1 : Math.sin(t * 0.8) * 0.05;

    // arms swing while walking, raise on slam
    armL.current.rotation.x = -Math.sin(t * f) * 0.4 - slamRef.current * 1.6;
    armR.current.rotation.x = Math.sin(t * f) * 0.4 - slamRef.current * 1.6;

    // core flares (and pulses harder on attack windup)
    const flare = 1.4 + Math.sin(t * 2.6) * 0.45 + slamRef.current * 1.8;
    coreMat.emissiveIntensity = flare;
    if (coreMesh.current)
      coreMesh.current.scale.setScalar(1 + Math.sin(t * 2.6) * 0.06 + slamRef.current * 0.25);
    visorMat.emissiveIntensity = 1.2 + Math.sin(t * 3) * 0.2 + slamRef.current * 0.8;
  });

  return (
    <group ref={body} position={[0, s * 1.05, 0]}>
      <group ref={torso}>
        {/* huge chest */}
        <mesh material={m.shellDark} scale={[s * 1.05, s * 1.05, s * 0.85]}>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        {/* upper armor band */}
        <mesh
          material={m.shellMid}
          position={[0, s * 0.45, 0]}
          scale={[s * 1.1, s * 0.18, s * 0.9]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        {/* core */}
        <mesh ref={coreMesh} material={coreMat} position={[0, 0, s * 0.45]}>
          <sphereGeometry args={[s * 0.2, 18, 18]} />
        </mesh>
        {/* core housing ring */}
        <mesh material={m.shellLight} position={[0, 0, s * 0.43]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[s * 0.24, s * 0.04, 10, 24]} />
        </mesh>
        {/* head */}
        <mesh
          material={m.shellMid}
          position={[0, s * 0.7, 0]}
          scale={[s * 0.42, s * 0.32, s * 0.4]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        <mesh
          material={visorMat}
          position={[0, s * 0.7, s * 0.21]}
          scale={[s * 0.34, s * 0.08, s * 0.025]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>

        {/* shoulders */}
        {[-1, 1].map((dx) => (
          <mesh
            key={`tsh${dx}`}
            material={m.shellLight}
            position={[dx * s * 0.62, s * 0.35, 0]}
            scale={[s * 0.34, s * 0.28, s * 0.5]}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        ))}

        {/* arms */}
        <group ref={armL} position={[-s * 0.65, s * 0.1, 0]}>
          <mesh
            material={m.shellDark}
            position={[0, -s * 0.25, 0]}
            scale={[s * 0.26, s * 0.55, s * 0.32]}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          <mesh
            material={m.accentSoft}
            position={[0, -s * 0.5, 0]}
            scale={[s * 0.22, s * 0.05, s * 0.28]}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        </group>
        <group ref={armR} position={[s * 0.65, s * 0.1, 0]}>
          <mesh
            material={m.shellDark}
            position={[0, -s * 0.25, 0]}
            scale={[s * 0.26, s * 0.55, s * 0.32]}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          <mesh
            material={m.accentSoft}
            position={[0, -s * 0.5, 0]}
            scale={[s * 0.22, s * 0.05, s * 0.28]}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        </group>
      </group>

      {/* legs */}
      <group ref={legL} position={[-s * 0.28, -s * 0.55, 0]}>
        <mesh
          material={m.shellDark}
          position={[0, -s * 0.3, 0]}
          scale={[s * 0.3, s * 0.6, s * 0.34]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      </group>
      <group ref={legR} position={[s * 0.28, -s * 0.55, 0]}>
        <mesh
          material={m.shellDark}
          position={[0, -s * 0.3, 0]}
          scale={[s * 0.3, s * 0.6, s * 0.34]}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      </group>

      <GroundRing cellSize={s} color={color} boss />
    </group>
  );
}

// ============================================================
// Public entry — pick rig by type
// ============================================================
export function EnemyRig({
  type,
  isBoss,
  cellSize,
  color,
  animState,
  hp,
  lastShot,
}: {
  type: "rusher" | "rifleman" | "sniper" | "titan";
  isBoss?: boolean;
  cellSize: number;
  color: string;
  animState: AnimState;
  hp: number;
  lastShot?: number;
}) {
  if (isBoss || type === "titan") {
    return (
      <TitanRig
        cellSize={cellSize}
        color={color}
        animState={animState}
        hp={hp}
        lastShot={lastShot}
      />
    );
  }
  if (type === "rusher") {
    return (
      <RusherRig
        cellSize={cellSize}
        color={color}
        animState={animState}
        hp={hp}
        lastShot={lastShot}
      />
    );
  }
  if (type === "sniper") {
    return (
      <SniperRig
        cellSize={cellSize}
        color={color}
        animState={animState}
        hp={hp}
        lastShot={lastShot}
      />
    );
  }
  return (
    <RiflemanRig
      cellSize={cellSize}
      color={color}
      animState={animState}
      hp={hp}
      lastShot={lastShot}
    />
  );
}
