// @ts-nocheck
import React, { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, useTexture } from "@react-three/drei";
import { ASSETS } from "../../game/assets";

interface Pickup {
  id: number;
  x: number;
  y: number;
  type: "health" | "ammo";
  rotation: number;
}

interface Pickups3DProps {
  pickups: Pickup[];
  cellSize: number;
  mapData: number[][];
}

export function Pickups3D({ pickups, cellSize, mapData }: Pickups3DProps) {
  const mapWidth = mapData[0].length * cellSize;
  const mapHeight = mapData.length * cellSize;

  const healthIconTexture = useTexture(ASSETS.ui.pickupHealth);
  const ammoIconTexture = useTexture(ASSETS.ui.pickupAmmo);

  const configuredTextures = useMemo(() => {
    [healthIconTexture, ammoIconTexture].forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
    });
    return { healthIconTexture, ammoIconTexture };
  }, [healthIconTexture, ammoIconTexture]);

  const boxMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#334155",
        metalness: 0.55,
        roughness: 0.42,
      }),
    [],
  );

  const healthIconMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: configuredTextures.healthIconTexture,
        transparent: true,
        alphaTest: 0.08,
        side: THREE.DoubleSide,
      }),
    [configuredTextures.healthIconTexture],
  );

  const ammoIconMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: configuredTextures.ammoIconTexture,
        transparent: true,
        alphaTest: 0.08,
        side: THREE.DoubleSide,
      }),
    [configuredTextures.ammoIconTexture],
  );

  const healthAccentMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#22c55e",
        emissive: "#22c55e",
        emissiveIntensity: 0.35,
      }),
    [],
  );

  const ammoAccentMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#fbbf24",
        emissive: "#fbbf24",
        emissiveIntensity: 0.35,
      }),
    [],
  );

  return (
    <>
      {pickups.map((p) => {
        const posX = p.x - mapWidth / 2;
        const posZ = p.y - mapHeight / 2;

        return (
          <group key={p.id} position={[posX, cellSize / 5, posZ]}>
            <AnimatedPickup
              boxMaterial={boxMaterial}
              accentMaterial={p.type === "health" ? healthAccentMaterial : ammoAccentMaterial}
              iconMaterial={p.type === "health" ? healthIconMaterial : ammoIconMaterial}
            />
            <PointLightWithPulse color={p.type === "health" ? "#22c55e" : "#fbbf24"} />
          </group>
        );
      })}
    </>
  );
}

function AnimatedPickup({ boxMaterial, accentMaterial, iconMaterial }: any) {
  const groupRef = React.useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 2;
      groupRef.current.rotation.y += 0.01;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow material={boxMaterial}>
        <boxGeometry args={[12, 8, 12]} />
      </mesh>
      <mesh position={[0, 0, 0]} material={accentMaterial}>
        <boxGeometry args={[13, 2, 13]} />
      </mesh>
      <Billboard position={[0, 13, 0]}>
        <mesh material={iconMaterial}>
          <planeGeometry args={[14, 14]} />
        </mesh>
      </Billboard>
    </group>
  );
}

function PointLightWithPulse({ color }: { color: string }) {
  const lightRef = React.useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (lightRef.current) {
      lightRef.current.intensity = 0.35 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
    }
  });

  return <pointLight ref={lightRef} distance={36} color={color} intensity={0.35} />;
}
