import { useEffect, useState } from "react";

export type QualityTier = "auto" | "low" | "medium" | "high";

export interface GameSettings {
  mouseSensX: number; // multiplier, 1.0 = default
  mouseSensY: number;
  invertX: boolean;
  invertY: boolean;
  quality: QualityTier;
  /** Music volume, 0..1. */
  musicVolume: number;
  /** Sound-effects volume, 0..1. */
  sfxVolume: number;
}

const KEY = "protocol_settings";

export const DEFAULT_SETTINGS: GameSettings = {
  mouseSensX: 1.0,
  mouseSensY: 1.0,
  invertX: false,
  invertY: false,
  quality: "auto",
  musicVolume: 0.35,
  sfxVolume: 0.7,
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    const q = parsed.quality;
    return {
      mouseSensX: clampNum(parsed.mouseSensX, 0.1, 5, DEFAULT_SETTINGS.mouseSensX),
      mouseSensY: clampNum(parsed.mouseSensY, 0.1, 5, DEFAULT_SETTINGS.mouseSensY),
      invertX: Boolean(parsed.invertX),
      invertY: Boolean(parsed.invertY),
      quality: (["auto", "low", "medium", "high"] as const).includes(q) ? q : "auto",
      musicVolume: clampNum(parsed.musicVolume, 0, 1, DEFAULT_SETTINGS.musicVolume),
      sfxVolume: clampNum(parsed.sfxVolume, 0, 1, DEFAULT_SETTINGS.sfxVolume),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: GameSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // localStorage unavailable (private mode) — settings stay in memory
  }
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

/** Non-React subscription (e.g. the sound engine reacting to volume changes). */
export function subscribeSettings(l: (s: GameSettings) => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
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
