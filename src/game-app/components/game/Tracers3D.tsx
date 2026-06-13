// @ts-nocheck
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Tracer {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
}

const MAX_TRACERS = 32;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Pooled instanced tracers (3 draw calls: glow, core, impact spark) reading
 * the live tracer list from a ref every frame. This removes the dependency
 * on React re-renders — enemy shots that don't change any game state still
 * show their tracer — and drops the per-tracer mesh/geometry churn.
 * Fade is approximated by thinning the beam with the remaining alpha.
 */
export const Tracers3D = React.memo(function Tracers3D({
  tracersRef,
  cellSize,
  mapWidth,
  mapHeight,
}: {
  tracersRef: React.MutableRefObject<Tracer[]>;
  cellSize: number;
  mapWidth: number;
  mapHeight: number;
}) {
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const coreRef = useRef<THREE.InstancedMesh>(null);
  const sparkRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const p1 = useMemo(() => new THREE.Vector3(), []);
  const p2 = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    const glow = glowRef.current;
    const core = coreRef.current;
    const spark = sparkRef.current;
    if (!glow || !core || !spark) return;
    const list = tracersRef.current ?? [];
    const n = Math.min(list.length, MAX_TRACERS);
    const y = cellSize / 2.5;

    for (let i = 0; i < n; i++) {
      const t = list[i];
      p1.set(t.x1 - mapWidth / 2, y, t.y1 - mapHeight / 2);
      p2.set(t.x2 - mapWidth / 2, y, t.y2 - mapHeight / 2);
      const distance = Math.max(p1.distanceTo(p2), 0.001);
      dir.subVectors(p2, p1).normalize();
      quat.setFromUnitVectors(UP, dir);
      const a = Math.max(0, Math.min(1, t.alpha));

      dummy.position.copy(p1).add(p2).multiplyScalar(0.5);
      dummy.quaternion.copy(quat);

      dummy.scale.set(0.06 * a + 0.005, distance, 0.06 * a + 0.005);
      dummy.updateMatrix();
      glow.setMatrixAt(i, dummy.matrix);

      dummy.scale.set(0.018 * a + 0.002, distance, 0.018 * a + 0.002);
      dummy.updateMatrix();
      core.setMatrixAt(i, dummy.matrix);

      dummy.position.copy(p2);
      dummy.quaternion.identity();
      dummy.scale.setScalar(0.18 * a + 0.01);
      dummy.updateMatrix();
      spark.setMatrixAt(i, dummy.matrix);
    }
    glow.count = n;
    core.count = n;
    spark.count = n;
    glow.instanceMatrix.needsUpdate = true;
    core.instanceMatrix.needsUpdate = true;
    spark.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={glowRef} args={[undefined, undefined, MAX_TRACERS]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={coreRef} args={[undefined, undefined, MAX_TRACERS]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
      </instancedMesh>
      <instancedMesh
        ref={sparkRef}
        args={[undefined, undefined, MAX_TRACERS]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.7} depthWrite={false} />
      </instancedMesh>
    </>
  );
});
