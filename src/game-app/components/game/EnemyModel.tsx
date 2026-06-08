// @ts-nocheck
import React, { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ENEMY_MODELS, type EnemyModelDef } from '../../game/modelAssets';

type AnimState = 'idle' | 'move' | 'attack' | 'death';
type AnimStatus = 'valid' | 'missing' | 'broken' | 'procedural';

interface DebugRefShape {
  current: {
    clip: string;
    usingFallback: boolean;
    hasAnimations: boolean;
    animationStatus?: AnimStatus;
    glbLoaded?: boolean;
    sourceUrl?: string;
  };
}

interface EnemyModelProps {
  modelKey: keyof typeof ENEMY_MODELS;
  cellSize: number;
  lastShot?: number;
  hp?: number;
  animState?: AnimState;
  centerVertically?: boolean;
  Fallback?: React.ComponentType<{ cellSize: number; color: string }>;
  debugRef?: DebugRefShape;
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

// ---------- animatedUrl probe (HEAD fetch, cached) ----------
const animatedProbeCache = new Map<string, Promise<boolean>>();
function probeAnimatedUrl(url: string): Promise<boolean> {
  if (animatedProbeCache.has(url)) return animatedProbeCache.get(url)!;
  const p = fetch(url, { method: 'HEAD' })
    .then((r) => r.ok)
    .catch(() => false);
  animatedProbeCache.set(url, p);
  return p;
}

function useResolvedUrl(def: EnemyModelDef): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    def.preferAnimated && def.animatedUrl ? null : def.url,
  );
  useEffect(() => {
    let cancel = false;
    if (def.preferAnimated && def.animatedUrl) {
      probeAnimatedUrl(def.animatedUrl).then((ok) => {
        if (cancel) return;
        setUrl(ok ? def.animatedUrl! : def.url);
      });
    } else {
      setUrl(def.url);
    }
    return () => { cancel = true; };
  }, [def.url, def.animatedUrl, def.preferAnimated]);
  return url;
}

// ---------- material prep ----------
function setTextureColorSpace(tex?: THREE.Texture | null) {
  if (!tex) return;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
}

function shouldPulseMaterial(mat: any) {
  const name = `${mat?.name ?? ''}`.toLowerCase();
  const hasEmissiveMap = !!mat?.emissiveMap;
  const hasStrongEmissive = !!mat?.emissive && mat.emissive instanceof THREE.Color &&
    (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0.15;
  return hasEmissiveMap || hasStrongEmissive ||
    /visor|eye|eyes|core|glow|light|led|emissive|screen|reactor|energy|cyan|blue|amber|red/i.test(name);
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

// ---------- animation validation ----------
function validateClips(
  scene: THREE.Object3D,
  clips: THREE.AnimationClip[],
): { status: AnimStatus; usable: THREE.AnimationClip[] } {
  if (!clips || clips.length === 0) return { status: 'missing', usable: [] };

  // index nodes by name and uuid
  const nodeNames = new Set<string>();
  let hasSkinnedMesh = false;
  scene.traverse((o: any) => {
    if (o.name) nodeNames.add(o.name);
    if (o.isSkinnedMesh || o.isBone) hasSkinnedMesh = true;
  });

  const usable: THREE.AnimationClip[] = [];
  for (const clip of clips) {
    if (!clip || !clip.tracks || clip.tracks.length === 0) continue;
    if (!Number.isFinite(clip.duration) || clip.duration <= 0.01) continue;

    let validTracks = 0;
    let usefulTracks = 0;
    for (const track of clip.tracks) {
      // track name format: "NodeName.property" or "NodeName.morphTargetInfluences[idx]"
      const dot = track.name.indexOf('.');
      if (dot < 0) continue;
      const nodeName = track.name.slice(0, dot);
      const prop = track.name.slice(dot + 1);
      if (!nodeNames.has(nodeName)) continue;
      validTracks++;
      if (/position|quaternion|rotation|scale|morphTarget/.test(prop)) {
        // verify track has any non-zero variation
        const values: any = (track as any).values;
        if (values && values.length >= 2) {
          let v0 = values[0];
          let varies = false;
          for (let i = 1; i < values.length; i++) {
            if (Math.abs(values[i] - v0) > 1e-5) { varies = true; break; }
          }
          if (varies) usefulTracks++;
        }
      }
    }
    if (validTracks > 0 && usefulTracks > 0) usable.push(clip);
  }

  if (usable.length === 0) return { status: 'broken', usable: [] };
  return { status: 'valid', usable };
}

function pickClip(
  usable: THREE.AnimationClip[],
  map: Record<string, number>,
  desired: AnimState,
  modelKey: string,
): THREE.AnimationClip | null {
  if (usable.length === 0) return null;
  const candidates: string[] = [];
  if (desired === 'death') candidates.push('death', 'die', 'dead');
  else if (desired === 'attack') {
    if (modelKey === 'rifleman' || modelKey === 'sniper') candidates.push('shoot', 'fire', 'attack');
    else candidates.push('attack', 'bite', 'punch', 'slam', 'shoot');
  } else if (desired === 'move') candidates.push('run', 'walk', 'move', 'idle');
  else candidates.push('idle', 'breathe', 'pose');

  // Try animationMap indices first (against original clips list — but our usable
  // is filtered, so map by name match if possible).
  for (const name of candidates) {
    const idx = map[name];
    if (typeof idx === 'number' && usable[idx]) return usable[idx];
    const byName = usable.find((c) => c.name && c.name.toLowerCase().includes(name));
    if (byName) return byName;
  }
  return usable[0];
}

const loggedClips = new Set<string>();
function logClipsOnce(modelKey: string, sourceUrl: string, status: AnimStatus, clips: THREE.AnimationClip[]) {
  const key = `${modelKey}|${sourceUrl}`;
  if (loggedClips.has(key)) return;
  loggedClips.add(key);
  try {
    if (status === 'valid') {
      console.info(`[EnemyModel] animations OK for ${modelKey} (${sourceUrl})`,
        clips.map((c) => c.name));
    } else if (status === 'missing') {
      console.info(`[EnemyModel] animations unavailable for ${modelKey} (${sourceUrl}) — using procedural fallback`);
    } else {
      console.info(`[EnemyModel] animations unusable for ${modelKey} (${sourceUrl}) — using procedural fallback`);
    }
  } catch {}
}

// ---------- procedural motion profiles ----------
function getMotionProfile(modelKey: string) {
  if (modelKey === 'titan' || modelKey === 'oldTitan')
    return { idleBob: 0.008, moveBob: 0.016, moveFreq: 3.1, sway: 0.018, attack: 0.045 };
  if (modelKey === 'rusher')
    return { idleBob: 0.012, moveBob: 0.055, moveFreq: 9.2, sway: 0.06, attack: 0.075 };
  if (modelKey === 'sniper')
    return { idleBob: 0.008, moveBob: 0.025, moveFreq: 4.8, sway: 0.025, attack: 0.035 };
  return { idleBob: 0.01, moveBob: 0.032, moveFreq: 5.8, sway: 0.035, attack: 0.045 };
}

// ---------- Model ----------
function Model({
  modelKey, cellSize, lastShot = 0, hp = 1, animState, Fallback, centerVertically, debugRef, sourceUrl,
}: EnemyModelProps & { sourceUrl: string }) {
  const def = ENEMY_MODELS[modelKey];
  const gltf = useGLTF(sourceUrl) as any;
  const groupRef = useRef<THREE.Group>(null);
  const pulseMatsRef = useRef<any[]>([]);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const currentClipNameRef = useRef<string>('none');
  const animDataRef = useRef<{ status: AnimStatus; usable: THREE.AnimationClip[] }>({ status: 'missing', usable: [] });
  const lastAnimStateRef = useRef<AnimState | null>(null);

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

  // Validate clips against the cloned scene (so node names match)
  useMemo(() => {
    if (!cloned) {
      animDataRef.current = { status: 'missing', usable: [] };
      return;
    }
    const result = validateClips(cloned, gltf.animations ?? []);
    animDataRef.current = result;
    logClipsOnce(String(modelKey), sourceUrl, result.status, gltf.animations ?? []);

    if (result.status === 'valid') {
      mixerRef.current = new THREE.AnimationMixer(cloned);
    } else {
      mixerRef.current = null;
    }
    currentActionRef.current = null;
    currentClipNameRef.current = result.status === 'valid' ? 'pending' : 'procedural';
    lastAnimStateRef.current = null;
  }, [cloned, gltf.animations, modelKey, sourceUrl]);

  useEffect(() => {
    if (!debugRef) return;
    const status = animDataRef.current.status;
    debugRef.current = {
      clip: currentClipNameRef.current,
      usingFallback: false,
      hasAnimations: (gltf.animations?.length ?? 0) > 0,
      animationStatus: status === 'valid' ? 'valid' : status,
      glbLoaded: true,
      sourceUrl,
    };
  }, [debugRef, gltf.animations, sourceUrl, cloned]);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;

    const t = state.clock.getElapsedTime();
    const sinceShot = (Date.now() - (lastShot ?? 0)) / 1000;
    const desired: AnimState = hp <= 0 ? 'death' : (animState ?? (sinceShot < 0.18 ? 'attack' : 'move'));

    const useReal = animDataRef.current.status === 'valid' && mixerRef.current;

    if (useReal) {
      // Drive AnimationMixer
      if (lastAnimStateRef.current !== desired) {
        const clip = pickClip(animDataRef.current.usable, def.animationMap, desired, String(modelKey));
        if (clip) {
          const next = mixerRef.current!.clipAction(clip);
          next.reset();
          next.setLoop(desired === 'death' ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
          next.clampWhenFinished = desired === 'death';
          next.fadeIn(0.18);
          next.play();
          const prev = currentActionRef.current;
          if (prev && prev !== next) prev.fadeOut(0.18);
          currentActionRef.current = next;
          currentClipNameRef.current = clip.name || '(unnamed)';
          if (debugRef) {
            debugRef.current = {
              ...debugRef.current,
              clip: currentClipNameRef.current,
              animationStatus: 'valid',
              usingFallback: false,
              hasAnimations: true,
              glbLoaded: true,
              sourceUrl,
            };
          }
        }
        lastAnimStateRef.current = desired;
      }
      mixerRef.current!.update(delta);
      // Keep transform neutral — real anim drives the rig
      g.position.set(0, 0, 0);
      g.rotation.set(0, 0, 0);
      g.scale.set(1, 1, 1);
    } else {
      // Procedural fallback
      const p = getMotionProfile(String(modelKey));
      g.position.set(0, 0, 0);
      g.rotation.set(0, 0, 0);
      g.scale.set(1, 1, 1);

      if (desired === 'death') {
        g.position.y = -cellSize * 0.08;
        g.rotation.x = -0.85;
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

      if (currentClipNameRef.current !== 'procedural') {
        currentClipNameRef.current = 'procedural';
        if (debugRef) {
          debugRef.current = {
            ...debugRef.current,
            clip: 'procedural',
            animationStatus: animDataRef.current.status === 'missing' ? 'missing' : (animDataRef.current.status === 'broken' ? 'broken' : 'procedural'),
            usingFallback: false,
            hasAnimations: (gltf.animations?.length ?? 0) > 0,
            glbLoaded: true,
            sourceUrl,
          };
        }
      }
    }

    // Emissive pulse (always)
    let glow = 0.16 + Math.sin(t * 3.2) * 0.04;
    if (sinceShot < 0.12) glow = 0.65;
    else if (sinceShot < 0.45) glow = 0.36;
    for (const m of pulseMatsRef.current) {
      if ('emissiveIntensity' in m) m.emissiveIntensity = glow;
    }
  });

  useEffect(() => () => {
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
      mixerRef.current.uncacheRoot(mixerRef.current.getRoot() as any);
      mixerRef.current = null;
    }
  }, []);

  if (!cloned) {
    if (debugRef) debugRef.current = {
      clip: 'fallback', usingFallback: true, hasAnimations: false,
      animationStatus: 'procedural', glbLoaded: false, sourceUrl,
    };
    return Fallback ? <Fallback cellSize={cellSize} color={def.color} /> : null;
  }

  return <group ref={groupRef}><primitive object={cloned} /></group>;
}

export function EnemyModel(props: EnemyModelProps) {
  const def = ENEMY_MODELS[props.modelKey];
  const F = props.Fallback;
  const resolvedUrl = useResolvedUrl(def);

  if (!resolvedUrl) {
    return F ? <F cellSize={props.cellSize} color={def.color} /> : null;
  }

  return (
    <EnemyModelBoundary modelKey={props.modelKey} cellSize={props.cellSize} Fallback={F}>
      <Suspense fallback={F ? <F cellSize={props.cellSize} color={def.color} /> : null}>
        <Model {...props} sourceUrl={resolvedUrl} />
      </Suspense>
    </EnemyModelBoundary>
  );
}
