// @ts-nocheck
import React, { Component, Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ENEMY_MODELS, type EnemyModelDef } from '../../game/modelAssets';

interface EnemyModelProps {
  modelKey: keyof typeof ENEMY_MODELS;
  cellSize: number;
  lastShot?: number;
  hp?: number;
  Fallback?: React.ComponentType<{ cellSize: number; color: string }>;
}

class EnemyModelBoundary extends Component<any, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e: any) {
    // eslint-disable-next-line no-console
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

function pickClip(
  clips: THREE.AnimationClip[],
  map: Record<string, number>,
  state: string,
  fallbackStates: string[] = [],
): THREE.AnimationClip | null {
  if (!clips || clips.length === 0) return null;
  const tryState = (s: string): THREE.AnimationClip | null => {
    const idx = map[s];
    if (typeof idx === 'number' && clips[idx]) return clips[idx];
    const byName = clips.find((c) => c.name?.toLowerCase().includes(s));
    return byName ?? null;
  };
  return tryState(state) ?? fallbackStates.reduce<THREE.AnimationClip | null>(
    (acc, s) => acc ?? tryState(s),
    null,
  ) ?? clips[0];
}

function prepareMaterials(root: THREE.Object3D, color: string) {
  const collected: THREE.MeshStandardMaterial[] = [];
  root.traverse((o: any) => {
    if (!o.isMesh) return;
    o.visible = true;
    o.frustumCulled = false;
    o.castShadow = false;
    o.receiveShadow = false;
    const apply = (mat: any) => {
      if (!mat) return mat;
      const map = mat.map ?? null;
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        map.needsUpdate = true;
      }
      const nm = new THREE.MeshStandardMaterial({
        map,
        color: map ? '#ffffff' : (mat.color ?? new THREE.Color('#cfd8e4')),
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.3,
        metalness: Math.min(0.35, mat.metalness ?? 0.2),
        roughness: Math.max(0.45, mat.roughness ?? 0.6),
        transparent: false,
        opacity: 1,
        depthWrite: true,
        depthTest: true,
        side: THREE.DoubleSide,
      });
      nm.toneMapped = false;
      collected.push(nm);
      return nm;
    };
    if (Array.isArray(o.material)) o.material = o.material.map(apply);
    else o.material = apply(o.material);
  });
  return collected;
}

function fitToCell(root: THREE.Object3D, def: EnemyModelDef, cellSize: number) {
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
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
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
  root.position.y -= box2.min.y;
  root.position.y += cellSize * def.yOffset;
  return true;
}

function Model({ modelKey, cellSize, lastShot = 0, hp = 1, Fallback }: EnemyModelProps) {
  const def = ENEMY_MODELS[modelKey];
  const gltf = useGLTF(def.url) as any;
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const currentRef = useRef<string>('idle');
  const matsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  const cloned = useMemo(() => {
    try {
      const c = cloneSkinned(gltf.scene);
      matsRef.current = prepareMaterials(c, def.color);
      if (!fitToCell(c, def, cellSize)) return null;
      c.rotation.set(def.rotation[0], def.rotation[1], def.rotation[2]);
      return c;
    } catch (e) {
      console.warn('[EnemyModel] clone failed', modelKey, e);
      return null;
    }
  }, [gltf.scene, modelKey, cellSize, def]);

  useEffect(() => {
    if (!cloned || !gltf.animations?.length) return;
    const mixer = new THREE.AnimationMixer(cloned);
    mixerRef.current = mixer;
    const states = ['idle', 'walk', 'run', 'attack', 'shoot', 'hit', 'death'];
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const s of states) {
      const clip = pickClip(gltf.animations, def.animationMap, s);
      if (clip) actions[s] = mixer.clipAction(clip);
    }
    actionsRef.current = actions;
    const initial = actions.idle ?? actions.walk ?? actions.run;
    if (initial) initial.reset().fadeIn(0.2).play();
    return () => { mixer.stopAllAction(); };
  }, [cloned, gltf.animations, def]);

  const switchTo = (state: string) => {
    if (currentRef.current === state) return;
    const acts = actionsRef.current;
    const next = acts[state];
    if (!next) return;
    const prev = acts[currentRef.current];
    next.reset().fadeIn(0.15).play();
    if (prev && prev !== next) prev.fadeOut(0.15);
    currentRef.current = state;
  };

  useFrame((_, delta) => {
    if (mixerRef.current) mixerRef.current.update(delta);
    const since = (Date.now() - (lastShot ?? 0)) / 1000;
    if (hp <= 0 && actionsRef.current.death) {
      switchTo('death');
    } else if (since < 0.25 && (actionsRef.current.attack || actionsRef.current.shoot)) {
      switchTo(actionsRef.current.attack ? 'attack' : 'shoot');
    } else if (actionsRef.current.walk || actionsRef.current.run) {
      switchTo(actionsRef.current.walk ? 'walk' : 'run');
    } else if (actionsRef.current.idle) {
      switchTo('idle');
    }
    // Emissive pulse
    const t = performance.now() / 1000;
    let glow = 0.25 + Math.sin(t * 3.6) * 0.08;
    if (since < 0.12) glow = 1.4;
    else if (since < 0.6) glow = 0.7;
    for (const m of matsRef.current) m.emissiveIntensity = glow;
  });

  if (!cloned) {
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
