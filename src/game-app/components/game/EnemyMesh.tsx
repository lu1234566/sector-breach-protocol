// @ts-nocheck
import React, { Suspense, useMemo, useRef, Component } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const URLS = {
  rusher: '/assets/enemies/enemy_trilobite.glb',
  rifleman: '/assets/enemies/enemy_quadshell.glb',
  sniper: '/assets/enemies/enemy_eyedrone.glb',
} as const;

const DEBUG_ENEMY_RENDER = false;

class EnemyErrorBoundary extends Component<any, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e: any) { console.error('[EnemyMesh] failed', this.props.type, e); }
  render() {
    return this.state.err
      ? <Fallback cellSize={this.props.cellSize} color={this.props.color} type={this.props.type} />
      : this.props.children;
  }
}

useGLTF.preload(URLS.rusher);
useGLTF.preload(URLS.rifleman);
useGLTF.preload(URLS.sniper);

// Smaller FPS-readable targets. The previous values filled almost a full map
// cell, which made enemies look like giant debug objects when close to camera.
const TARGET: Record<string, number> = {
  rusher: 0.48,
  rifleman: 0.58,
  sniper: 0.42,
};

const BODY_TINT: Record<string, string> = {
  rusher: '#f6c2ff',
  rifleman: '#bff8ff',
  sniper: '#ffe9a6',
};

function makeMaterial(source: any, color: string, type: string) {
  const map = source?.map ?? null;
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }
  const mat = new THREE.MeshStandardMaterial({
    map,
    color: map ? '#ffffff' : (BODY_TINT[type] ?? '#dbeafe'),
    emissive: color,
    emissiveIntensity: 0.38,
    metalness: 0.25,
    roughness: 0.55,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  mat.toneMapped = false;
  return mat;
}

function getMeshBox(root: THREE.Object3D) {
  const box = new THREE.Box3();
  let meshCount = 0;
  root.updateMatrixWorld(true);
  root.traverse((o: any) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    meshCount++;
    box.expandByObject(o);
  });
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const invalid = meshCount === 0 || box.isEmpty() || !Number.isFinite(maxDim) || maxDim < 0.01;
  return { box, size, center, maxDim, invalid };
}

function Model({ url, cellSize, color, type, lastShot }: any) {
  const { scene } = useGLTF(url) as any;
  const ref = useRef<THREE.Group>(null);
  const emissiveMats = useRef<any[]>([]);

  const modelData = useMemo(() => {
    const cloned = scene.clone(true);
    emissiveMats.current = [];

    cloned.traverse((o: any) => {
      if (!o.isMesh) return;
      o.visible = true;
      o.frustumCulled = false;
      o.castShadow = false;
      o.receiveShadow = false;
      if (Array.isArray(o.material)) {
        o.material = o.material.map((m: any) => {
          const mat = makeMaterial(m, color, type);
          emissiveMats.current.push(mat);
          return mat;
        });
      } else {
        const mat = makeMaterial(o.material, color, type);
        o.material = mat;
        emissiveMats.current.push(mat);
      }
    });

    const before = getMeshBox(cloned);
    if (before.invalid) {
      console.warn('[EnemyMesh] invalid GLB bounds, using fallback', { type, url });
      return { cloned: null, invalid: true };
    }

    const target = cellSize * (TARGET[type] ?? 0.5);
    cloned.scale.setScalar(target / before.maxDim);
    cloned.updateMatrixWorld(true);

    const fitted = getMeshBox(cloned);
    cloned.position.x -= fitted.center.x;
    cloned.position.z -= fitted.center.z;
    cloned.position.y -= fitted.box.min.y;
    cloned.position.y += cellSize * 0.03;
    cloned.updateMatrixWorld(true);

    const finalBox = getMeshBox(cloned);
    if (finalBox.invalid) return { cloned: null, invalid: true };
    return { cloned, invalid: false };
  }, [scene, cellSize, color, type, url]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const since = (Date.now() - (lastShot ?? 0)) / 1000;
    let glow = 0.25 + Math.sin(t * 4) * 0.08;
    if (since > 0.4 && since < 1.0) glow = 1.15;
    if (since < 0.1) glow = 1.75;
    for (const m of emissiveMats.current) if (m) m.emissiveIntensity = glow;

    if (ref.current) {
      if (type === 'sniper') {
        ref.current.position.y = Math.sin(t * 2) * cellSize * 0.06 + cellSize * 0.16;
        ref.current.rotation.y = t * 0.4;
      } else if (type === 'rusher') {
        ref.current.rotation.x = -0.12 + Math.sin(t * 9) * 0.06;
      }
    }
  });

  if (modelData.invalid || !modelData.cloned) {
    return <Fallback cellSize={cellSize} color={color} type={type} />;
  }

  return (
    <group ref={ref}>
      <primitive object={modelData.cloned} />
      <SafetyMarker cellSize={cellSize} color={color} type={type} subtle />
      {DEBUG_ENEMY_RENDER && (
        <mesh position={[0, cellSize * 0.3, 0]}>
          <boxGeometry args={[cellSize * 0.55, cellSize * 0.55, cellSize * 0.55]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.7} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function SafetyMarker({ cellSize, color, type, subtle = false }: any) {
  const y = subtle ? cellSize * 0.08 : cellSize * 0.2;
  const coreSize = cellSize * (subtle ? 0.018 : 0.04);
  const ringInner = cellSize * (subtle ? 0.18 : 0.26);
  const ringOuter = cellSize * (subtle ? 0.21 : 0.32);
  return (
    <group>
      <pointLight color={color} intensity={subtle ? 0.35 : 0.7} distance={cellSize * 1.6} position={[0, cellSize * 0.35, 0]} />
      <mesh position={[0, y, 0]}>
        <sphereGeometry args={[coreSize, 10, 10]} />
        <meshBasicMaterial color={color} transparent opacity={subtle ? 0.45 : 0.85} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, -cellSize * 0.49, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ringInner, ringOuter, 24]} />
        <meshBasicMaterial color={color} transparent opacity={subtle ? 0.28 : 0.65} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Fallback({ cellSize, color, type }: any) {
  const accent = BODY_TINT[type] ?? color;
  const height = type === 'sniper' ? cellSize * 0.5 : type === 'rusher' ? cellSize * 0.32 : cellSize * 0.48;
  const width = type === 'sniper' ? cellSize * 0.2 : type === 'rusher' ? cellSize * 0.42 : cellSize * 0.36;
  return (
    <group>
      <mesh position={[0, height * 0.5 - cellSize * 0.48, 0]}>
        <boxGeometry args={[width, height, width]} />
        <meshStandardMaterial color={accent} emissive={color} emissiveIntensity={0.55} roughness={0.5} metalness={0.2} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <SafetyMarker cellSize={cellSize} color={color} type={type} />
    </group>
  );
}

export function EnemyMesh({ type, cellSize, color, lastShot }: any) {
  return (
    <EnemyErrorBoundary type={type} cellSize={cellSize} color={color}>
      <Suspense fallback={<Fallback cellSize={cellSize} color={color} type={type} />}>
        <Model url={URLS[type]} type={type} cellSize={cellSize} color={color} lastShot={lastShot} />
      </Suspense>
    </EnemyErrorBoundary>
  );
}

useGLTF.preload(URLS.rusher);
useGLTF.preload(URLS.rifleman);
useGLTF.preload(URLS.sniper);
