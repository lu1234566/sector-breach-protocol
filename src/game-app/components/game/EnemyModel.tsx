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

const ANIM_ALIASES: Record<string, string[]> = {
  idle: ['idle', 'stand', 'breath', 'loop', 'rest'],
  walk: ['walk', 'walking', 'move', 'locomotion', 'forward'],
  run: ['run', 'running', 'sprint', 'rush'],
  attack: ['attack', 'slash', 'melee', 'strike', 'fire', 'shoot'],
  shoot: ['shoot', 'fire', 'rifle', 'shot', 'attack'],
  hit: ['hit', 'hurt', 'damage', 'impact'],
  death: ['death', 'die', 'dead', 'collapse'],
};

function findClipByName(clips: THREE.AnimationClip[], state: string) {
  const aliases = ANIM_ALIASES[state] ?? [state];
  return clips.find((clip) => {
    const n = clip.name?.toLowerCase?.() ?? '';
    return aliases.some((a) => n.includes(a));
  }) ?? null;
}

function pickClip(
  clips: THREE.AnimationClip[],
  map: Record<string, number>,
  state: string,
  fallbackStates: string[] = [],
): THREE.AnimationClip | null {
  if (!clips || clips.length === 0) return null;

  const named = findClipByName(clips, state);
  if (named) return named;

  for (const fs of fallbackStates) {
    const fallbackNamed = findClipByName(clips, fs);
    if (fallbackNamed) return fallbackNamed;
  }

  const idx = map[state];
  if (typeof idx === 'number' && clips[idx]) return clips[idx];

  for (const fs of fallbackStates) {
    const fIdx = map[fs];
    if (typeof fIdx === 'number' && clips[fIdx]) return clips[fIdx];
  }

  if (state === 'idle' || state === 'walk' || state === 'run') return clips[0];
  return null;
}

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

      // Only color textures get sRGB. Data maps (normal/rough/metal/ao) stay linear.
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
        cloned.emissiveIntensity = Math.max(cloned.emissiveIntensity ?? 0, 0.22);
        cloned.toneMapped = false;
        pulseMats.push(cloned);
      } else if ('emissiveIntensity' in cloned) {
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

function logClipsOnce(modelKey: string, animations: THREE.AnimationClip[], actions: Record<string, THREE.AnimationAction>) {
  if (loggedClips.has(modelKey)) return;
  loggedClips.add(modelKey);
  try {
    console.groupCollapsed(`[EnemyModel] animation clips: ${modelKey}`);
    console.table(animations.map((clip, index) => ({ index, name: clip.name, duration: Number(clip.duration.toFixed(3)) })));
    console.table(Object.entries(actions).map(([state, action]) => ({ state, clip: action.getClip().name, duration: Number(action.getClip().duration.toFixed(3)) })));
    console.groupEnd();
  } catch {}
}

function Model({ modelKey, cellSize, lastShot = 0, hp = 1, animState, Fallback, centerVertically }: EnemyModelProps) {
  const def = ENEMY_MODELS[modelKey];
  const gltf = useGLTF(def.url) as any;
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const currentRef = useRef<string>('');
  const pulseMatsRef = useRef<any[]>([]);
  const actionLockUntilRef = useRef(0);

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
    if (!cloned || !gltf.animations?.length) return;

    const mixer = new THREE.AnimationMixer(cloned);
    mixerRef.current = mixer;

    const states = ['idle', 'walk', 'run', 'attack', 'shoot', 'hit', 'death'];
    const actions: Record<string, THREE.AnimationAction> = {};

    for (const s of states) {
      const clip = pickClip(gltf.animations, def.animationMap, s, s === 'walk' ? ['run', 'idle'] : s === 'run' ? ['walk', 'idle'] : ['idle']);
      if (clip) {
        const action = mixer.clipAction(clip);
        action.enabled = true;
        action.clampWhenFinished = s === 'death' || s === 'attack' || s === 'shoot';
        action.loop = s === 'death' || s === 'attack' || s === 'shoot' ? THREE.LoopOnce : THREE.LoopRepeat;
        actions[s] = action;
      }
    }

    actionsRef.current = actions;
    logClipsOnce(String(modelKey), gltf.animations, actions);

    const initial = actions.idle ?? actions.walk ?? actions.run;
    if (initial) {
      initial.reset().fadeIn(0.18).play();
      currentRef.current = Object.keys(actions).find((k) => actions[k] === initial) ?? 'idle';
    }

    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
      actionsRef.current = {};
      currentRef.current = '';
    };
  }, [cloned, gltf.animations, def, modelKey]);

  const switchTo = (state: string, fade = 0.16) => {
    const acts = actionsRef.current;
    const next = acts[state];
    if (!next || currentRef.current === state) return;

    const prev = acts[currentRef.current];
    next.reset().fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
    currentRef.current = state;
  };

  useFrame((_, delta) => {
    if (mixerRef.current) mixerRef.current.update(delta);

    const now = performance.now();
    const sinceShot = (Date.now() - (lastShot ?? 0)) / 1000;
    const acts = actionsRef.current;
    const desired = hp <= 0 ? 'death' : animState ?? (sinceShot < 0.18 ? 'attack' : 'move');

    if (desired === 'death' && acts.death) {
      switchTo('death', 0.08);
    } else if ((desired === 'attack' || sinceShot < 0.18) && (acts.shoot || acts.attack)) {
      switchTo(acts.shoot ? 'shoot' : 'attack', 0.08);
      actionLockUntilRef.current = now + 260;
    } else if (now > actionLockUntilRef.current) {
      if (desired === 'idle' && acts.idle) switchTo('idle');
      else if (modelKey === 'rusher' && (acts.run || acts.walk)) switchTo(acts.run ? 'run' : 'walk');
      else if (acts.walk || acts.run) switchTo(acts.walk ? 'walk' : 'run');
      else if (acts.idle) switchTo('idle');
    }

    const t = performance.now() / 1000;
    let glow = 0.22 + Math.sin(t * 3.6) * 0.06;
    if (sinceShot < 0.12) glow = 0.95;
    else if (sinceShot < 0.45) glow = 0.5;
    for (const m of pulseMatsRef.current) {
      if ('emissiveIntensity' in m) m.emissiveIntensity = glow;
    }

    // Procedural bob/sway fallback so enemies don't look like they're sliding
    // when the GLB has no walk/run clip. Only applies during 'move'.
    if (groupRef.current) {
      const moving = desired === 'move' || desired === 'attack';
      const hasLocomotion = !!(acts.walk || acts.run);
      const bobAmp = hasLocomotion ? 0 : (modelKey === 'titan' ? 0.012 : modelKey === 'rusher' ? 0.05 : 0.03);
      const bobFreq = modelKey === 'titan' ? 3.0 : modelKey === 'rusher' ? 9.0 : 6.0;
      const swayAmp = hasLocomotion ? 0 : 0.04;
      if (moving && bobAmp > 0) {
        groupRef.current.position.y = Math.abs(Math.sin(t * bobFreq)) * cellSize * bobAmp;
        groupRef.current.rotation.z = Math.sin(t * bobFreq * 0.5) * swayAmp;
      } else {
        groupRef.current.position.y *= 0.85;
        groupRef.current.rotation.z *= 0.85;
      }
    }
  });

  if (!cloned) return Fallback ? <Fallback cellSize={cellSize} color={def.color} /> : null;
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
