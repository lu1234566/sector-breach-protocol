import { useEffect, useState } from 'react';

export type QualityTier = 'auto' | 'low' | 'medium' | 'high';
export type EnemyVisualMode = 'auto' | 'rig' | 'glb';

export interface GameSettings {
  mouseSensX: number; // multiplier, 1.0 = default
  mouseSensY: number;
  invertX: boolean;
  invertY: boolean;
  quality: QualityTier;
  // Controls how enemies are rendered in Medium/High. Low still uses EnemyLite.
  // auto: stable default, currently uses the procedural part-rig.
  // rig: force procedural part-rig enemies.
  // glb: force EnemyModel/GLB enemies for testing animation/positioning.
  enemyVisualMode: EnemyVisualMode;
  /** Music volume, 0..1. */
  musicVolume: number;
  /** Sound-effects volume, 0..1. */
  sfxVolume: number;
}

const KEY = 'protocol_settings';

export const DEFAULT_SETTINGS: GameSettings = {
  mouseSensX: 1.0,
  mouseSensY: 1.0,
  invertX: false,
  invertY: false,
  quality: 'auto',
  enemyVisualMode: 'auto',
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    const q = parsed.quality;
    const enemyVisualMode = parsed.enemyVisualMode;
    return {
      mouseSensX: clampNum(parsed.mouseSensX, 0.1, 5, DEFAULT_SETTINGS.mouseSensX),
      mouseSensY: clampNum(parsed.mouseSensY, 0.1, 5, DEFAULT_SETTINGS.mouseSensY),
      invertX: Boolean(parsed.invertX),
      invertY: Boolean(parsed.invertY),
      quality: (['auto', 'low', 'medium', 'high'] as const).includes(q) ? q : 'auto',
      enemyVisualMode: (['auto', 'rig', 'glb'] as const).includes(enemyVisualMode) ? enemyVisualMode : 'auto',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: GameSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

function clampNum(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

const listeners = new Set<(s: GameSettings) => void>();
let current: GameSettings | null = null;

export function getSettings(): GameSettings {
  if (!current) current = loadSettings();
  return current;
}

export function updateSettings(patch: Partial<GameSettings>) {
  current = { ...getSettings(), ...patch };
  saveSettings(current);
  listeners.forEach((l) => l(current!));
}

export function useSettings(): [GameSettings, (patch: Partial<GameSettings>) => void] {
  const [s, setS] = useState<GameSettings>(() => getSettings());
  useEffect(() => {
    const l = (next: GameSettings) => setS(next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return [s, updateSettings];
}
