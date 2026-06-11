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
  type: 'rusher' | 'rifleman' | 'sniper' | 'titan';
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
  diedAt?: number;
  /** Earliest timestamp this enemy may fire its first shot. */
  nextShotAt?: number;
}

export interface Pickup {
  id: number;
  x: number;
  y: number;
  type: 'health' | 'ammo';
  rotation: number;
}

export interface Particle {
  id: number;
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

export interface WallDecal {
  id: number;
  x: number;
  y: number;
  nx: number; // wall normal x
  ny: number; // wall normal y
  born: number; // ms timestamp
  size: number;
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

export type WaveObjectiveKind = 'eliminate' | 'hack' | 'defend' | 'extract';

export interface ObjectiveZone {
  x: number;
  y: number;
  radius: number;
}

export interface WaveObjective {
  kind: WaveObjectiveKind;
  label: string;
  zone?: ObjectiveZone;
  durationMs?: number;     // hack / defend
  killThreshold?: number;  // extract
  timeLimitMs?: number;    // extract
  coreMaxHp?: number;      // defend
}

export interface ObjectiveRuntime {
  kind: WaveObjectiveKind;
  label: string;
  zone?: ObjectiveZone;
  progress: number;        // 0..1
  timer: number;           // ms remaining (countdown) or 0
  inZone: boolean;
  killCount: number;
  killTarget?: number;
  coreHp?: number;
  coreMaxHp?: number;
  extractActive: boolean;  // true once extract zone is open
  status: 'active' | 'complete' | 'failed';
  startedAt: number;
}
