// @ts-nocheck
import React, { Component, Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PROP_MODELS, type PropModelDef } from "../../game/modelAssets";

// Preload all prop GLBs so the arena's props don't suspend the scene
// piecemeal during play.
Object.values(PROP_MODELS).forEach((p: any) => useGLTF.preload(p.url));

interface PropProps {
  modelKey: keyof typeof PROP_MODELS;
  cellSize: number;
  accentColor?: string;
  pulse?: boolean;
  flicker?: boolean;
  emissiveBoost?: number;
  emissiveBase?: number;
  noFloorSnap?: boolean;
  fallback?: React.ReactNode;
}

class PropBoundary extends Component<any, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() {
    return { err: true };
  }
  render() {
    if (this.state.err) return this.props.fallback ?? null;
    return this.props.children;
  }
}

function fitProp(root: THREE.Object3D, def: PropModelDef, cellSize: number, noFloorSnap = false) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let count = 0;
  root.traverse((o: any) => {
    if (o.isMesh && o.geometry && o.visible) {
      count++;
      box.expandByObject(o);
    }
  });
  if (!count || box.isEmpty()) return false;
  const size = new THREE.Vector3();
  box.getSize(size);
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
  if (noFloorSnap) {
    root.position.y -= c2.y;
  } else {
    root.position.y -= box2.min.y;
  }
  root.position.y += cellSize * def.yOffset;
  return true;
}

function isLightPart(mat: any) {
  const name = `${mat?.name ?? ""}`.toLowerCase();
  if (mat?.emissiveMap) return true;
  if (
    mat?.emissive instanceof THREE.Color &&
    mat.emissive.r + mat.emissive.g + mat.emissive.b > 0.15
  )
    return true;
  return /visor|eye|core|reactor|screen|led|light|emissive|glow|panel_light|strip|stripe|band|lamp/i.test(
    name,
  );
}

function setColorSpaceSafe(tex?: THREE.Texture | null) {
  if (!tex) return;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
}

function prepProp(root: THREE.Object3D, accent?: string, boost = 0) {
  const pulseMats: any[] = [];
  root.traverse((o: any) => {
    if (!o.isMesh) return;
    o.visible = true;
    o.frustumCulled = false;
    o.castShadow = false;
    o.receiveShadow = false;
    const apply = (mat: any) => {
      if (!mat) return mat;
      const cloned = mat.clone ? mat.clone() : mat;

      // Only color textures get sRGB; data maps stay linear.
      setColorSpaceSafe(cloned.map);
      setColorSpaceSafe(cloned.emissiveMap);

      cloned.depthWrite = true;
      cloned.depthTest = true;
      cloned.transparent = !!cloned.transparent && (cloned.opacity ?? 1) < 1;

      if (isLightPart(cloned)) {
        if (!cloned.emissive) cloned.emissive = new THREE.Color(accent ?? "#22d3ee");
        if (cloned.emissive instanceof THREE.Color && cloned.emissive.getHex() === 0)
          cloned.emissive.set(accent ?? "#22d3ee");
        cloned.emissiveIntensity = Math.max(cloned.emissiveIntensity ?? 0, 0.25 + boost);
        cloned.toneMapped = false;
        pulseMats.push(cloned);
      } else if ("emissiveIntensity" in cloned) {
        // Keep non-light parts grounded — do NOT tint whole body.
        cloned.emissiveIntensity = Math.min(cloned.emissiveIntensity ?? 0, 0.04);
      }

      cloned.needsUpdate = true;
      return cloned;
    };
    if (Array.isArray(o.material)) o.material = o.material.map(apply);
    else o.material = apply(o.material);
  });
  return pulseMats;
}

function PropInner({
  modelKey,
  cellSize,
  accentColor,
  pulse,
  flicker,
  emissiveBoost = 0,
  emissiveBase = 0.22,
  noFloorSnap,
}: PropProps) {
  const def = PROP_MODELS[modelKey];
  const gltf = useGLTF(def.url) as any;
  const matsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  const cloned = useMemo(() => {
    const c = gltf.scene.clone(true);
    matsRef.current = prepProp(c, accentColor, emissiveBoost);
    if (!fitProp(c, def, cellSize, noFloorSnap)) return null;
    c.rotation.set(def.rotation[0], def.rotation[1], def.rotation[2]);
    return c;
  }, [gltf.scene, def, cellSize, accentColor, emissiveBoost, noFloorSnap]);

  useFrame((state) => {
    if (!matsRef.current.length || (!pulse && !flicker)) return;
    const t = state.clock.getElapsedTime();
    const base = emissiveBase + emissiveBoost * 0.6;
    let k = base;
    if (pulse) k += Math.sin(t * 2.0) * 0.08 + 0.08;
    if (flicker) {
      const f = Math.sin(t * 23.1 + Math.sin(t * 7.3) * 2.5);
      k += f > 0.88 ? 0.35 : 0;
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
