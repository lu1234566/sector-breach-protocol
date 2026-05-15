// @ts-nocheck
import { DifficultyKey, DIFFICULTIES } from './constants';
import { LifetimeStats, UpgradeLevels, WeaponUpgradeLevels } from './types';

const KEYS = {
  CREDITS: 'nano_credits',
  UPGRADES: 'nano_upgrades',
  DIFFICULTY: 'nano_difficulty',
  WEAPON_UPGRADES: 'nano_weapon_upgrades',
  STATS: 'nano_stats',
  ARENA: 'protocol_arena'
};

export const loadArena = (): string | null => {
  try {
    return localStorage.getItem(KEYS.ARENA);
  } catch {
    return null;
  }
};

export const saveArena = (arenaId: string) => {
  try {
    localStorage.setItem(KEYS.ARENA, arenaId);
  } catch {}
};

export const loadCredits = (): number | null => {
  try {
    const saved = localStorage.getItem(KEYS.CREDITS);
    if (saved) {
      const parsed = parseInt(saved);
      return isNaN(parsed) ? null : parsed;
    }
  } catch (e) {
    console.error("Failed to load credits", e);
  }
  return null;
};

export const loadUpgrades = (): Partial<UpgradeLevels> | null => {
  try {
    const saved = localStorage.getItem(KEYS.UPGRADES);
    if (saved) {
      const parsed = JSON.parse(saved);
      return (parsed && typeof parsed === 'object') ? parsed : null;
    }
  } catch (e) {
    console.error("Failed to load upgrades", e);
  }
  return null;
};

export const loadWeaponUpgrades = (): Partial<WeaponUpgradeLevels> | null => {
  try {
    const saved = localStorage.getItem(KEYS.WEAPON_UPGRADES);
    if (saved) {
      const parsed = JSON.parse(saved);
      return (parsed && typeof parsed === 'object') ? parsed : null;
    }
  } catch (e) {
    console.error("Failed to load weapon upgrades", e);
  }
  return null;
};

export const loadDifficulty = (): DifficultyKey | null => {
  try {
    const saved = localStorage.getItem(KEYS.DIFFICULTY);
    if (saved && DIFFICULTIES[saved as DifficultyKey]) {
      return saved as DifficultyKey;
    }
  } catch (e) {
    console.error("Failed to load difficulty", e);
  }
  return null;
};

export const loadLifetimeStats = (): Partial<LifetimeStats> | null => {
  try {
    const saved = localStorage.getItem(KEYS.STATS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return {
          totalKills: Number(parsed.totalKills) || 0,
          totalDeaths: Number(parsed.totalDeaths) || 0,
          totalCredits: Number(parsed.totalCredits) || 0,
          bestWave: Number(parsed.bestWave) || 0,
          totalWins: Number(parsed.totalWins) || 0,
          totalGames: Number(parsed.totalGames) || 0
        };
      }
    }
  } catch (e) {
    console.error("Failed to load stats", e);
  }
  return null;
};

export const saveCredits = (credits: number) => {
  localStorage.setItem(KEYS.CREDITS, credits.toString());
};

export const saveUpgrades = (upgrades: UpgradeLevels | Record<string, number>) => {
  localStorage.setItem(KEYS.UPGRADES, JSON.stringify(upgrades));
};

export const saveWeaponUpgrades = (weaponUpgrades: WeaponUpgradeLevels) => {
  localStorage.setItem(KEYS.WEAPON_UPGRADES, JSON.stringify(weaponUpgrades));
};

export const saveLifetimeStats = (stats: LifetimeStats) => {
  localStorage.setItem(KEYS.STATS, JSON.stringify(stats));
};

export const saveDifficulty = (difficulty: DifficultyKey) => {
  localStorage.setItem(KEYS.DIFFICULTY, difficulty);
};