// @ts-nocheck
import { WeaponType } from './constants';

export interface Player {
  x: number;
  y: number;
  angle: number;
  velX: number;
  velY: number;
  rotVel: number;
  pitch: number;
  radius: number;
  isAds: boolean;
  adsProgress: number; // 0 to 1
}

export interface UpgradeLevels {
  armorPlating: number;
  ammoReserve: number;
  quickReload: number;
  scavenger: number;
  [key: string]: number;
}

export interface WeaponUpgrades {
  damage: number;
  reload: number;
  stability: number;
}

export type WeaponUpgradeLevels = Record<WeaponType, WeaponUpgrades>;

export interface Enemy {
  id: number;
  x: number;
  y: number;
  type: 'rusher' | 'rifleman' | 'sniper';
  isBoss: boolean;
  hp: number;
  maxHp: number;
  lastShot: number;
  speed: number;
  color: string;
  stuckFrames: number;
  lastX: number;
  lastY: number;
  targetAngle: number;
  spawnTime: number;
  hasLineOfSight?: boolean;
  blockedBy?: number;
  dead?: boolean;
}

export interface Pickup {
  id: number;
  x: number;
  y: number;
  type: 'health' | 'ammo';
  rotation: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface Tracer {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
}

export interface DamageIndicator {
  id: number;
  angle: number;
  opacity: number;
}

export interface KillfeedItem {
  id: number;
  text: string;
}

export interface LifetimeStats {
  totalKills: number;
  totalDeaths: number;
  totalCredits: number;
  bestWave: number;
  totalWins: number;
  totalGames: number;
}

export interface RunStats {
  kills: number;
  deaths: number;
  shotsFired: number;
  shotsHit: number;
}