// @ts-nocheck
import React, { Component, Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ENEMY_MODELS, type EnemyModelDef } from '../../game/modelAssets';

type AnimState = 'idle' | 'move' | 'attack' | 'death';

interface EnemyModelProps {
  modelKey: keyof typeof ENEMY_MODELS;
  cellSize: number;
  lastShot?: number;
  hp?: number;
  animState?: AnimState;
  centerVertically?: boolean;
  Fallback?: React.ComponentType<{ cellSize: number; color: string }>;
  debugRef?: { current: { clip: string; usingFallback: boolean; hasAnimations: boolean } };
}

class EnemyModelBoundary extends Component<any, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e: any) {
    console.warn('[EnemyModel] render failed', this.props.modelKey, e);
  }
  render() {
    if (this.state.err) {
      const def = ENEMY_MODELS[this.props.modelKey];
      const F = this.props.Fallback;
      return F ? <F cellSize={this.props.cellSize} color={def.color} /> : null;
    }
    return this.props.children;
  }
}

const loggedClips = new Set<string>();

function setTextureColorSpace(tex?: THREE.Texture | null) {
  if (!tex) return;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
}

function shouldPulseMaterial(mat: any) {
  const name = `${mat?.name ?? ''}`.toLowerCase();
  const hasEmissiveMap = !!mat?.emissiveMap;
  const hasStrongEmissive = !!mat?.emissive && mat.emissive instanceof THREE.Color && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0.15;
  return hasEmissiveMap || hasStrongEmissive || /visor|eye|eyes|core|glow|light|led|emissive|screen|reactor|energy|cyan|blue|amber|red/i.test(name);
}

function prepareMaterials(root: THREE.Object3D, accentColor: string) {
  const pulseMats: THREE.Material[] = [];

  root.traverse((o: any) => {
    if (!o.isMesh) return;

    o.visible = true;
    o.frustumCulled = false;
    o.castShadow = false;
    o.receiveShadow = false;

    const apply = (mat: any) => {
      if (!mat) return mat;
      const cloned = mat.clone ? mat.clone() : mat;

      // Color textures only. Keep data textures linear.
      setTextureColorSpace(cloned.map);
      setTextureColorSpace(cloned.emissiveMap);

      cloned.depthWrite = true;
      cloned.depthTest = true;
      cloned.side = THREE.FrontSide;
      cloned.opacity = typeof cloned.opacity === 'number' ? cloned.opacity : 1;
      cloned.transparent = !!cloned.transparent && cloned.opacity < 1;

      if ('metalness' in cloned && typeof cloned.metalness !== 'number') cloned.metalness = 0.35;
      if ('roughness' in cloned && typeof cloned.roughness !== 'number') cloned.roughness = 0.65;

      if (shouldPulseMaterial(cloned)) {
        if (!cloned.emissive) cloned.emissive = new THREE.Color(accentColor);
        if (cloned.emissive instanceof THREE.Color && cloned.emissive.getHex() === 0) cloned.emissive.set(accentColor);
        cloned.emissiveIntensity = Math.max(cloned.emissiveIntensity ?? 0, 0.18);
        cloned.toneMapped = false;
        pulseMats.push(cloned);
      } else if ('emissiveIntensity' in cloned) {
        cloned.emissiveIntensity = 0;
      }

      cloned.needsUpdate = true;
      return cloned;
    };

    if (Array.isArray(o.material)) o.material = o.material.map(apply);
    else o.material = apply(o.material);
  });

  return pulseMats;
}

function fitToCell(root: THREE.Object3D, def: EnemyModelDef, cellSize: number, centerVertically = false) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let count = 0;
  root.traverse((o: any) => {
    if (o.isMesh && o.geometry && o.visible) {
      count++;
      box.expandByObject(o);
    }
  });
  if (count === 0 || box.isEmpty()) return false;

  const size = new THREE.Vector3();
  box.getSize(size);
  const max = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(max) || max < 0.001) return false;

  const target = cellSize * def.targetSize;
  const k = target / max;
  root.scale.setScalar(k);
  root.updateMatrixWorld(true);

  const box2 = new THREE.Box3().setFromObject(root);
  const c2 = new THREE.Vector3();
  box2.getCenter(c2);
  root.position.x -= c2.x;
  root.position.z -= c2.z;
  if (centerVertically) root.position.y -= c2.y;
  else root.position.y -= box2.min.y;
  root.position.y += cellSize * def.yOffset;
  return true;
}

function logClipsOnce(modelKey: string, animations: THREE.AnimationClip[]) {
  if (loggedClips.has(modelKey)) return;
  loggedClips.add(modelKey);
  try {
    console.groupCollapsed(`[EnemyModel] GLB clips ignored for stability: ${modelKey}`);
    console.table((animations ?? []).map((clip, index) => ({
      index,
      name: clip.name,
      duration: Number(clip.duration.toFixed(3)),
    })));
    console.info('Using procedural motion layer instead of GLB clip playback. This avoids broken Tripo/NlaTrack animations until exact clip maps are verified.');
    console.groupEnd();
  } catch {}
}

function getMotionProfile(modelKey: string) {
  if (modelKey === 'titan' || modelKey === 'oldTitan') {
    return { idleBob: 0.008, moveBob: 0.016, moveFreq: 3.1, sway: 0.018, attack: 0.045 };
  }
  if (modelKey === 'rusher') {
    return { idleBob: 0.012, moveBob: 0.055, moveFreq: 9.2, sway: 0.06, attack: 0.075 };
  }
  if (modelKey === 'sniper') {
    return { idleBob: 0.008, moveBob: 0.025, moveFreq: 4.8, sway: 0.025, attack: 0.035 };
  }
  return { idleBob: 0.01, moveBob: 0.032, moveFreq: 5.8, sway: 0.035, attack: 0.045 };
}

function Model({ modelKey, cellSize, lastShot = 0, hp = 1, animState, Fallback, centerVertically, debugRef }: EnemyModelProps) {
  const def = ENEMY_MODELS[modelKey];
  const gltf = useGLTF(def.url) as any;
  const groupRef = useRef<THREE.Group>(null);
  const pulseMatsRef = useRef<any[]>([]);

  const cloned = useMemo(() => {
    try {
      const c = cloneSkinned(gltf.scene);
      pulseMatsRef.current = prepareMaterials(c, def.color);
      if (!fitToCell(c, def, cellSize, centerVertically)) return null;
      c.rotation.set(def.rotation[0], def.rotation[1], def.rotation[2]);
      return c;
    } catch (e) {
      console.warn('[EnemyModel] clone failed', modelKey, e);
      return null;
    }
  }, [gltf.scene, modelKey, cellSize, def, centerVertically]);

  useEffect(() => {
    logClipsOnce(String(modelKey), gltf.animations ?? []);
    if (debugRef) debugRef.current = { clip: 'procedural', usingFallback: false, hasAnimations: !!gltf.animations?.length };
  }, [modelKey, gltf.animations, debugRef]);

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;

    const t = state.clock.getElapsedTime();
    const sinceShot = (Date.now() - (lastShot ?? 0)) / 1000;
    const desired: AnimState = hp <= 0 ? 'death' : animState ?? (sinceShot < 0.18 ? 'attack' : 'move');
    const p = getMotionProfile(String(modelKey));

    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    g.scale.set(1, 1, 1);

    if (desired === 'death') {
      const k = 1;
      g.position.y = -cellSize * 0.08;
      g.rotation.x = -0.85 * k;
      g.rotation.z = Math.sin(t * 5) * 0.08;
      g.scale.setScalar(0.92);
    } else if (desired === 'attack') {
      const pulse = Math.max(0, 1 - Math.min(1, sinceShot / 0.22));
      const wobble = Math.sin(t * 18) * 0.012;
      g.position.y = Math.abs(Math.sin(t * p.moveFreq)) * cellSize * p.idleBob;
      g.rotation.x = -p.attack * pulse;
      g.rotation.z = wobble;
      g.scale.set(1 + pulse * 0.035, 1 - pulse * 0.018, 1 + pulse * 0.055);
    } else if (desired === 'move') {
      const bob = Math.abs(Math.sin(t * p.moveFreq)) * cellSize * p.moveBob;
      g.position.y = bob;
      g.rotation.z = Math.sin(t * p.moveFreq * 0.5) * p.sway;
      g.rotation.x = Math.cos(t * p.moveFreq) * p.sway * 0.35;
    } else {
      g.position.y = Math.sin(t * 2.2) * cellSize * p.idleBob;
      g.rotation.z = Math.sin(t * 1.6) * p.sway * 0.18;
    }

    let glow = 0.16 + Math.sin(t * 3.2) * 0.04;
    if (sinceShot < 0.12) glow = 0.65;
    else if (sinceShot < 0.45) glow = 0.36;
    for (const m of pulseMatsRef.current) {
      if ('emissiveIntensity' in m) m.emissiveIntensity = glow;
    }
  });

  if (!cloned) {
    if (debugRef) debugRef.current = { clip: 'fallback', usingFallback: true, hasAnimations: false };
    return Fallback ? <Fallback cellSize={cellSize} color={def.color} /> : null;
  }

  return <group ref={groupRef}><primitive object={cloned} /></group>;
}

export function EnemyModel(props: EnemyModelProps) {
  const def = ENEMY_MODELS[props.modelKey];
  const F = props.Fallback;
  return (
    <EnemyModelBoundary modelKey={props.modelKey} cellSize={props.cellSize} Fallback={F}>
      <Suspense fallback={F ? <F cellSize={props.cellSize} color={def.color} /> : null}>
        <Model {...props} />
      </Suspense>
    </EnemyModelBoundary>
  );
}
