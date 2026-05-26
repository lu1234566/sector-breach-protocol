// @ts-nocheck
import React, { Component, Suspense, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { PROP_MODELS, type PropModelDef } from '../../game/modelAssets';

interface PropProps {
  modelKey: keyof typeof PROP_MODELS;
  cellSize: number;
  accentColor?: string;
  pulse?: boolean;
  flicker?: boolean;
  emissiveBoost?: number;
  fallback?: React.ReactNode;
}

class PropBoundary extends Component<any, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  render() {
    if (this.state.err) return this.props.fallback ?? null;
    return this.props.children;
  }
}

function fitProp(root: THREE.Object3D, def: PropModelDef, cellSize: number) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let count = 0;
  root.traverse((o: any) => {
    if (o.isMesh && o.geometry && o.visible) { count++; box.expandByObject(o); }
  });
  if (!count || box.isEmpty()) return false;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size); box.getCenter(center);
  const max = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(max) || max < 0.001) return false;
  const k = (cellSize * def.targetSize) / max;
  root.scale.setScalar(k);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const c2 = new THREE.Vector3();
  box2.getCenter(c2);
  root.position.x -= c2.x;
  root.position.z -= c2.z;
  root.position.y -= box2.min.y;
  root.position.y += cellSize * def.yOffset;
  return true;
}

function prepProp(root: THREE.Object3D, accent?: string, boost = 0) {
  const mats: THREE.MeshStandardMaterial[] = [];
  root.traverse((o: any) => {
    if (!o.isMesh) return;
    o.visible = true;
    o.frustumCulled = false;
    o.castShadow = false;
    o.receiveShadow = false;
    const apply = (mat: any) => {
      if (!mat) return mat;
      const map = mat.map ?? null;
      if (map) { map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true; }
      const nm = new THREE.MeshStandardMaterial({
        map,
        color: map ? '#ffffff' : (mat.color ?? new THREE.Color('#9aa6b8')),
        emissive: accent ? new THREE.Color(accent) : new THREE.Color('#000000'),
        emissiveIntensity: accent ? 0.25 + boost : 0,
        metalness: Math.min(0.4, mat.metalness ?? 0.3),
        roughness: Math.max(0.45, mat.roughness ?? 0.6),
        transparent: false,
        opacity: 1,
        depthWrite: true,
        side: THREE.DoubleSide,
      });
      nm.toneMapped = false;
      mats.push(nm);
      return nm;
    };
    if (Array.isArray(o.material)) o.material = o.material.map(apply);
    else o.material = apply(o.material);
  });
  return mats;
}

function PropInner({ modelKey, cellSize, accentColor, pulse, flicker, emissiveBoost = 0 }: PropProps) {
  const def = PROP_MODELS[modelKey];
  const gltf = useGLTF(def.url) as any;
  const matsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  const cloned = useMemo(() => {
    const c = gltf.scene.clone(true);
    matsRef.current = prepProp(c, accentColor, emissiveBoost);
    if (!fitProp(c, def, cellSize)) return null;
    c.rotation.set(def.rotation[0], def.rotation[1], def.rotation[2]);
    return c;
  }, [gltf.scene, def, cellSize, accentColor, emissiveBoost]);

  useFrame((state) => {
    if (!matsRef.current.length || (!pulse && !flicker)) return;
    const t = state.clock.getElapsedTime();
    const base = 0.25 + emissiveBoost;
    let k = base;
    if (pulse) k += Math.sin(t * 2.2) * 0.18 + 0.18;
    if (flicker) {
      const f = Math.sin(t * 23.1 + Math.sin(t * 7.3) * 2.5);
      k += f > 0.85 ? 0.6 : 0;
    }
    for (const m of matsRef.current) if (m.emissive) m.emissiveIntensity = k;
  });

  if (!cloned) return null;
  return <primitive object={cloned} />;
}

export function PropModel(props: PropProps) {
  return (
    <PropBoundary fallback={props.fallback}>
      <Suspense fallback={props.fallback ?? null}>
        <PropInner {...props} />
      </Suspense>
    </PropBoundary>
  );
}
