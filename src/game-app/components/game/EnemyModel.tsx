// @ts-nocheck
import React, { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ENEMY_MODELS, type EnemyModelDef } from '../../game/modelAssets';

type AnimState = 'idle' | 'move' | 'attack' | 'shoot' | 'death';
type AnimStatus = 'valid' | 'missing' | 'broken' | 'procedural';
type RootMotionMode = 'strip' | 'lockXZ' | 'keep';

interface DebugRefShape {
  current: {
    clip: string;
    usingFallback: boolean;
    hasAnimations: boolean;
    animationStatus?: AnimStatus;
    glbLoaded?: boolean;
    sourceUrl?: string;
    rootMotion?: RootMotionMode;
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

// ---------- animatedUrl probe ----------
const animatedProbeCache = new Map<string, Promise<boolean>>();
function probeAnimatedUrl(url: string): Promise<boolean> {
  if (animatedProbeCache.has(url)) return animatedProbeCache.get(url)!;
  const p = fetch(url, { method: 'HEAD' })
    .then((r) => {
      if (!r.ok) return false;
      // SPA hosts often rewrite missing paths to index.html with a 200;
      // treat an HTML response as "file does not exist".
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      return !ct.includes('text/html');
    })
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

// ---------- root identification ----------
const ROOT_NAME_RE = /^(scene|root|armature|hips|mixamorig:hips|mixamorig:root)$/i;

function identifyRootNodes(scene: THREE.Object3D): Set<string> {
  const roots = new Set<string>();
  if (scene.name) roots.add(scene.name);
  scene.traverse((o: any) => {
    if (!o.name) return;
    if (ROOT_NAME_RE.test(o.name)) roots.add(o.name);
  });
  // Also include the topmost named child of the scene (often "Armature" wrapper)
  if (scene.children && scene.children.length > 0) {
    const first = scene.children[0];
    if (first && first.name) roots.add(first.name);
  }
  return roots;
}

// ---------- sanitize clip (strip root motion) ----------
function sanitizeClip(
  clip: THREE.AnimationClip,
  rootNames: Set<string>,
  mode: RootMotionMode,
): THREE.AnimationClip {
  if (mode === 'keep') return clip;
  const kept = clip.tracks.filter((track) => {
    const dot = track.name.indexOf('.');
    if (dot < 0) return true;
    const nodeName = track.name.slice(0, dot);
    const prop = track.name.slice(dot + 1);
    if (!rootNames.has(nodeName)) return true;

    if (mode === 'strip') {
      // remove position/quaternion/rotation/scale from root nodes
      if (/^(position|quaternion|rotation|scale)/.test(prop)) return false;
    } else if (mode === 'lockXZ') {
      // remove only position tracks from root nodes (lock XZ drift but also Y to avoid sinking)
      if (/^position/.test(prop)) return false;
    }
    return true;
  });
  if (kept.length === clip.tracks.length) return clip;
  const c = new THREE.AnimationClip(clip.name, clip.duration, kept, clip.blendMode);
  return c;
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
  const target = cellSize * def.targetSize * (def.scaleMultiplier ?? 1);
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
  if (def.positionOffset) {
    root.position.x += def.positionOffset[0];
    root.position.y += def.positionOffset[1];
    root.position.z += def.positionOffset[2];
  }
  return true;
}

// ---------- animation validation ----------
function validateClips(
  scene: THREE.Object3D,
  clips: THREE.AnimationClip[],
): { status: AnimStatus; usable: THREE.AnimationClip[] } {
  if (!clips || clips.length === 0) return { status: 'missing', usable: [] };
  const nodeNames = new Set<string>();
  scene.traverse((o: any) => { if (o.name) nodeNames.add(o.name); });

  const usable: THREE.AnimationClip[] = [];
  for (const clip of clips) {
    if (!clip || !clip.tracks || clip.tracks.length === 0) continue;
    if (!Number.isFinite(clip.duration) || clip.duration <= 0.01) continue;
    let validTracks = 0;
    let usefulTracks = 0;
    for (const track of clip.tracks) {
      const dot = track.name.indexOf('.');
      if (dot < 0) continue;
      const nodeName = track.name.slice(0, dot);
      const prop = track.name.slice(dot + 1);
      if (!nodeNames.has(nodeName)) continue;
      validTracks++;
      if (/position|quaternion|rotation|scale|morphTarget/.test(prop)) {
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
  else if (desired === 'attack' || desired === 'shoot') {
    if (modelKey === 'rifleman' || modelKey === 'sniper') candidates.push('shoot', 'fire', 'attack');
    else candidates.push('attack', 'bite', 'punch', 'slam', 'shoot');
  } else if (desired === 'move') candidates.push('run', 'walk', 'move');
  else candidates.push('idle', 'breathe', 'pose');

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
    if (clips.length > 0 && typeof console !== 'undefined' && console.table) {
      console.info(`[EnemyModel] ${modelKey} clips from ${sourceUrl} (status=${status})`);
      console.table(clips.map((c, i) => ({ index: i, name: c.name, duration: +c.duration.toFixed(3), tracks: c.tracks.length })));
    } else {
      console.info(`[EnemyModel] ${modelKey} animations status=${status}`);
    }
  } catch {}
}

// ---------- procedural fallback ----------
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

  // Three-tier groups: outer (no anim), normalization (scale/rot/center), modelRoot (anim)
  const normalizationRef = useRef<THREE.Group>(null);
  const modelRootRef = useRef<THREE.Group>(null);

  const pulseMatsRef = useRef<any[]>([]);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const currentClipNameRef = useRef<string>('none');
  const animDataRef = useRef<{ status: AnimStatus; usable: THREE.AnimationClip[] }>({ status: 'missing', usable: [] });
  const lastAnimStateRef = useRef<AnimState | null>(null);
  const attackLockRef = useRef<number>(0);
  const rootMotionMode: RootMotionMode = (def.rootMotion ?? 'lockXZ') as RootMotionMode;

  const cloned = useMemo(() => {
    try {
      const c = cloneSkinned(gltf.scene);
      pulseMatsRef.current = prepareMaterials(c, def.color);
      if (!fitToCell(c, def, cellSize, centerVertically)) return null;
      return c;
    } catch (e) {
      console.warn('[EnemyModel] clone failed', modelKey, e);
      return null;
    }
  }, [gltf.scene, modelKey, cellSize, def, centerVertically]);

  // Validate + sanitize clips, build mixer attached to the cloned scene
  const sanitizedUsable = useMemo(() => {
    if (!cloned) {
      animDataRef.current = { status: 'missing', usable: [] };
      return [] as THREE.AnimationClip[];
    }
    const result = validateClips(cloned, gltf.animations ?? []);
    logClipsOnce(String(modelKey), sourceUrl, result.status, gltf.animations ?? []);
    if (result.status !== 'valid') {
      animDataRef.current = result;
      mixerRef.current = null;
      return [];
    }
    const rootNames = identifyRootNodes(cloned);
    const sanitized = result.usable.map((c) => sanitizeClip(c, rootNames, rootMotionMode));
    animDataRef.current = { status: 'valid', usable: sanitized };
    mixerRef.current = new THREE.AnimationMixer(cloned);
    currentActionRef.current = null;
    currentClipNameRef.current = 'pending';
    lastAnimStateRef.current = null;
    return sanitized;
  }, [cloned, gltf.animations, modelKey, sourceUrl, rootMotionMode]);

  useEffect(() => {
    if (!debugRef) return;
    const status = animDataRef.current.status;
    debugRef.current = {
      clip: currentClipNameRef.current,
      usingFallback: false,
      hasAnimations: (gltf.animations?.length ?? 0) > 0,
      animationStatus: status,
      glbLoaded: true,
      sourceUrl,
      rootMotion: rootMotionMode,
    };
  }, [debugRef, gltf.animations, sourceUrl, cloned, rootMotionMode, sanitizedUsable]);

  useFrame((state, delta) => {
    const normalization = normalizationRef.current;
    const modelRoot = modelRootRef.current;
    if (!normalization || !modelRoot) return;

    const t = state.clock.getElapsedTime();
    const sinceShot = (Date.now() - (lastShot ?? 0)) / 1000;
    const desired: AnimState = hp <= 0 ? 'death' : (animState ?? (sinceShot < 0.18 ? 'attack' : 'move'));

    const useReal = animDataRef.current.status === 'valid' && mixerRef.current;

    if (useReal) {
      // attack/shoot lock: don't restart inside lock window
      const now = performance.now();
      const isAttack = desired === 'attack' || desired === 'shoot';
      const isLocked = isAttack && now < attackLockRef.current;

      if (lastAnimStateRef.current !== desired && !isLocked) {
        const clip = pickClip(animDataRef.current.usable, def.animationMap, desired, String(modelKey));
        if (clip) {
          const next = mixerRef.current!.clipAction(clip);
          next.reset();
          const loopOnce = isAttack || desired === 'death';
          next.setLoop(loopOnce ? THREE.LoopOnce : THREE.LoopRepeat, loopOnce ? 1 : Infinity);
          next.clampWhenFinished = loopOnce;
          next.fadeIn(0.15);
          next.play();
          const prev = currentActionRef.current;
          if (prev && prev !== next) prev.fadeOut(0.15);
          currentActionRef.current = next;
          currentClipNameRef.current = clip.name || '(unnamed)';
          if (isAttack) attackLockRef.current = now + 320;
          if (debugRef) {
            debugRef.current = {
              ...debugRef.current,
              clip: currentClipNameRef.current,
              animationStatus: 'valid',
              usingFallback: false,
              hasAnimations: true,
              glbLoaded: true,
              sourceUrl,
              rootMotion: rootMotionMode,
            };
          }
        }
        lastAnimStateRef.current = desired;
      }
      mixerRef.current!.update(delta);

      // Re-lock XZ position of the modelRoot wrapper so animation can't drift
      // it away from the spawn-fitted center. We do NOT touch scale/rotation
      // here — those belong to the normalization group / model rig itself.
      if (rootMotionMode === 'lockXZ' || rootMotionMode === 'strip') {
        modelRoot.position.x = 0;
        modelRoot.position.z = 0;
        if (modelRoot.position.y < -cellSize * 0.05) modelRoot.position.y = 0;
      }
    } else {
      // Procedural fallback — applied to the modelRoot wrapper only
      const p = getMotionProfile(String(modelKey));
      modelRoot.position.set(0, 0, 0);
      modelRoot.rotation.set(0, 0, 0);
      modelRoot.scale.set(1, 1, 1);

      if (desired === 'death') {
        modelRoot.position.y = -cellSize * 0.08;
        modelRoot.rotation.x = -0.85;
        modelRoot.rotation.z = Math.sin(t * 5) * 0.08;
        modelRoot.scale.setScalar(0.92);
      } else if (desired === 'attack' || desired === 'shoot') {
        const pulse = Math.max(0, 1 - Math.min(1, sinceShot / 0.22));
        modelRoot.position.y = Math.abs(Math.sin(t * p.moveFreq)) * cellSize * p.idleBob;
        modelRoot.rotation.x = -p.attack * pulse;
        modelRoot.rotation.z = Math.sin(t * 18) * 0.012;
      } else if (desired === 'move') {
        modelRoot.position.y = Math.abs(Math.sin(t * p.moveFreq)) * cellSize * p.moveBob;
        modelRoot.rotation.z = Math.sin(t * p.moveFreq * 0.5) * p.sway;
        modelRoot.rotation.x = Math.cos(t * p.moveFreq) * p.sway * 0.35;
      } else {
        modelRoot.position.y = Math.sin(t * 2.2) * cellSize * p.idleBob;
        modelRoot.rotation.z = Math.sin(t * 1.6) * p.sway * 0.18;
      }

      if (currentClipNameRef.current !== 'procedural') {
        currentClipNameRef.current = 'procedural';
        if (debugRef) {
          debugRef.current = {
            ...debugRef.current,
            clip: 'procedural',
            animationStatus: animDataRef.current.status,
            usingFallback: false,
            hasAnimations: (gltf.animations?.length ?? 0) > 0,
            glbLoaded: true,
            sourceUrl,
            rootMotion: rootMotionMode,
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
      try { mixerRef.current.uncacheRoot(mixerRef.current.getRoot() as any); } catch {}
      mixerRef.current = null;
    }
  }, []);

  if (!cloned) {
    if (debugRef) debugRef.current = {
      clip: 'fallback', usingFallback: true, hasAnimations: false,
      animationStatus: 'procedural', glbLoaded: false, sourceUrl,
      rootMotion: rootMotionMode,
    };
    return Fallback ? <Fallback cellSize={cellSize} color={def.color} /> : null;
  }

  // Normalization group applies base rotation (per modelAssets) ONCE; never
  // mutated per-frame. The animated modelRoot wraps the GLB scene and is the
  // only thing the mixer (or procedural fallback) may write to.
  return (
    <group ref={normalizationRef} rotation={[def.rotation[0], def.rotation[1], def.rotation[2]]}>
      <group ref={modelRootRef}>
        <primitive object={cloned} />
      </group>
    </group>
  );
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
