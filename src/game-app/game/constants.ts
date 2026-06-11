// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type WeaponType = 'pistol' | 'rifle' | 'shotgun' | 'sniper';

export interface Upgrade {
  name: string;
  description: string;
  costs: number[];
  maxLevel: number;
}

export const UPGRADES: Record<string, Upgrade> = {
  armorPlating: { 
    name: 'Armor Plating', 
    description: '+5 Max HP per level', 
    costs: [100, 200, 350, 500, 750], 
    maxLevel: 5 
  },
  ammoReserve: { 
    name: 'Ammo Reserve', 
    description: '+20 Initial Reserve Ammo per level', 
    costs: [100, 200, 350, 500, 750], 
    maxLevel: 5 
  },
  quickReload: { 
    name: 'Quick Reload', 
    description: '-5% Reload Time per level', 
    costs: [150, 300, 500, 800, 1200], 
    maxLevel: 5 
  },
  scavenger: { 
    name: 'Scavenger', 
    description: '+5% Pickup Drop Chance per level', 
    costs: [150, 300, 500, 800, 1200], 
    maxLevel: 5 
  }
};

export const WEAPON_UPGRADE_COSTS = [150, 300, 500, 800, 1200];
export const MAX_WEAPON_LEVEL = 5;

export const DIFFICULTIES = {
  recruit: { name: 'Recruit', hpMult: 0.75, dmgMult: 0.75, creditMult: 0.9, color: '#312e81' },
  normal: { name: 'Normal', hpMult: 1.0, dmgMult: 1.0, creditMult: 1.15, color: '#22d3ee' },
  veteran: { name: 'Veteran', hpMult: 1.25, dmgMult: 1.15, creditMult: 1.6, color: '#fbbf24' },
  nightmare: { name: 'Nightmare', hpMult: 1.6, dmgMult: 1.4, creditMult: 2.4, color: '#f43f5e' }
};

export type DifficultyKey = keyof typeof DIFFICULTIES;

export interface Weapon {
  name: string;
  type: WeaponType;
  damage: number;
  fireRate: number; // ms
  reloadTime: number; // ms
  magSize: number;
  recoil: number;
  spread: number;
  range: number;
  isScoped: boolean;
  isAuto: boolean;
  color: string;
}

export const WEAPONS: Record<WeaponType, Weapon> = {
  pistol: { name: 'P-99', type: 'pistol', damage: 20, fireRate: 250, reloadTime: 1200, magSize: 12, recoil: 5, spread: 0.05, range: 600, isScoped: false, isAuto: false, color: '#94a3b8' },
  rifle: { name: 'M4-A1', type: 'rifle', damage: 15, fireRate: 100, reloadTime: 2000, magSize: 30, recoil: 3, spread: 0.1, range: 800, isScoped: false, isAuto: true, color: '#1e293b' },
  shotgun: { name: 'KRM-262', type: 'shotgun', damage: 60, fireRate: 800, reloadTime: 2500, magSize: 6, recoil: 20, spread: 0.5, range: 300, isScoped: false, isAuto: false, color: '#334155' },
  sniper: { name: 'DL-Q33', type: 'sniper', damage: 100, fireRate: 1500, reloadTime: 3000, magSize: 5, recoil: 40, spread: 0.01, range: 1500, isScoped: true, isAuto: false, color: '#0f172a' },
};

// Wave structure: waves 1-4 build up, wave 5 is the Titan boss,
// wave 6 is the final extraction run.
export const BOSS_WAVE = 5;
export const FINAL_WAVE = 6;

export const CELL_SIZE = 64;
export const TICK_RATE = 1000 / 60;
export const FOV = Math.PI / 3;
export const RESOLUTION = 400; // Rays
export const MAX_DEPTH = 1200;