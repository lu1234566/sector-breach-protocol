import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ObjectiveRuntime } from "../../game/types";

const KIND_COLORS: Record<string, string> = {
  hack: "#22d3ee",
  defend: "#34d399",
  extract: "#fbbf24",
};

interface Props {
  objective: ObjectiveRuntime;
  cellSize: number;
  mapData: number[][];
}

/**
 * In-world marker for hack/defend/extract zones: a glowing floor disc,
 * a rotating ring and a vertical beacon beam so the player can actually
 * see where the objective is (the HUD only says "Enter Zone").
 */
export function ObjectiveZone3D({ objective, cellSize, mapData }: Props) {
  const zone = objective.zone;
  const ringRef = useRef<THREE.Mesh>(null);
  const beamMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const discMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const color = KIND_COLORS[objective.kind] ?? "#22d3ee";

  const { posX, posZ } = useMemo(() => {
    const mapWidth = mapData[0].length * cellSize;
    const mapHeight = mapData.length * cellSize;
    return {
      posX: (zone?.x ?? 0) - mapWidth / 2,
      posZ: (zone?.y ?? 0) - mapHeight / 2,
    };
  }, [zone, cellSize, mapData]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) ringRef.current.rotation.z = t * 0.6;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    if (beamMatRef.current) beamMatRef.current.opacity = 0.1 + pulse * 0.12;
    if (discMatRef.current) discMatRef.current.opacity = 0.16 + pulse * 0.14;
  });

  if (!zone || objective.status !== "active") return null;
  // Extraction zone only becomes visible once it activates.
  if (objective.kind === "extract" && !objective.extractActive) return null;

  const r = zone.radius;

  return (
    <group position={[posX, 0, posZ]}>
      {/* Floor disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]}>
        <circleGeometry args={[r, 40]} />
        <meshBasicMaterial
          ref={discMatRef}
          color={color}
          transparent
          opacity={0.2}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Rotating edge ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 2, 0]}>
        <ringGeometry args={[r * 0.92, r, 40, 1]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.85}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Beacon beam */}
      <mesh position={[0, cellSize * 1.5, 0]}>
        <cylinderGeometry args={[r * 0.2, r * 0.35, cellSize * 3, 16, 1, true]} />
        <meshBasicMaterial
          ref={beamMatRef}
          color={color}
          transparent
          opacity={0.15}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
