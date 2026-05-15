// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Shield, Zap, Skull, RefreshCcw, Terminal, Move, Users, Coins, ChevronLeft } from 'lucide-react';
import { GameScene } from './components/game/GameScene';
import { MainMenu } from './components/menu/MainMenu';

import { 
  WeaponType, 
  DifficultyKey, 
  UPGRADES, 
  WEAPONS, 
  MAP, 
  CELL_SIZE, 
  TICK_RATE,
  WEAPON_UPGRADE_COSTS,
  MAX_WEAPON_LEVEL,
  DIFFICULTIES
} from './game/constants';
import { getArenaById, ARENAS, DEFAULT_ARENA_ID, type ArenaDef } from './data/arenas';
import { 
  Player, 
  Enemy, 
  Pickup, 
  Particle, 
  Tracer, 
  DamageIndicator, 
  KillfeedItem, 
  LifetimeStats, 
  RunStats,
  UpgradeLevels,
  WeaponUpgradeLevels
} from './game/types';
import { 
  loadCredits, 
  loadUpgrades, 
  loadWeaponUpgrades, 
  loadDifficulty, 
  loadLifetimeStats,
  loadArena,
  saveArena,
  saveCredits,
  saveUpgrades,
  saveWeaponUpgrades,
  saveLifetimeStats
} from './game/persistence';
import { clamp } from './game/helpers';
import { sounds } from './game/SoundEngine';


// --- Main Component ---
const PLAYER_RADIUS = 30;
// @ts-ignore
const DEBUG_MODE = false;
const DEBUG_SAFE_MODE = false; 

const isBulletBlocking = (cell: number) => cell === 1 || cell === 2 || cell === 3;
const isMovementBlockingCell = (cell: number) => cell === 1 || cell === 2 || cell === 3;

const WAVE_1_DAMAGE_MULT = 0.5;
const INITIAL_GRACE_PERIOD = 5000; // 5 seconds

/**
 * Checks if there is a clear line of sight between two points.
 * Returns true if the path is clear of bullet-blocking obstacles.
 */
const checkLineOfSight = (x1: number, y1: number, x2: number, y2: number, mapData: number[][]) => {
  const result = checkLineOfSightInfo(x1, y1, x2, y2, mapData);
  return result.hasLOS;
};

const checkLineOfSightInfo = (x1: number, y1: number, x2: number, y2: number, mapData: number[][]) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return { hasLOS: true };
  
  const steps = Math.ceil(dist / 8); 
  const cos = dx / dist;
  const sin = dy / dist;

  for (let i = 1; i <= steps; i++) {
    const checkDist = i * 8;
    if (checkDist >= dist) break;
    const tx = Math.floor((x1 + cos * checkDist) / CELL_SIZE);
    const ty = Math.floor((y1 + sin * checkDist) / CELL_SIZE);
    
    if (ty < 0 || ty >= mapData.length || tx < 0 || tx >= mapData[0].length) return { hasLOS: false, blockedBy: -1 };
    const cell = mapData[ty][tx];
    if (isBulletBlocking(cell)) return { hasLOS: false, blockedBy: cell };
  }
  return { hasLOS: true };
};

const getSafePlayerStart = () => {
    let px = 12 * CELL_SIZE + CELL_SIZE / 2;
    let py = 6 * CELL_SIZE + CELL_SIZE / 2;
    // Initial angle pointing towards an open area (East/Right in this map layout)
    const initialAngle = -Math.PI / 2; 

    if (MAP[6]?.[12] === 0) return { x: px, y: py, angle: initialAngle };
    
    // Fallback
    for (let y = 1; y < MAP.length - 1; y++) {
        for (let x = 1; x < MAP[0].length - 1; x++) {
            if (MAP[y][x] === 0) {
                return { x: x * CELL_SIZE + CELL_SIZE / 2, y: y * CELL_SIZE + CELL_SIZE / 2, angle: initialAngle };
            }
        }
    }
    return { x: 128, y: 128, angle: initialAngle };
};

export default function App() {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const pointerLockCooldownRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'dead' | 'win' | 'upgrades'>('start');
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  const [wave, setWave] = useState(1);
  const waveRef = useRef(1);
  const isWaveTransitionRef = useRef(false);
  const isSpawningRef = useRef(false);
  const spawnIntervalRef = useRef<number | null>(null);
  const reloadTimeoutRef = useRef<number | null>(null);
  const waveTransitionTimeoutRef = useRef<number | null>(null);
  const bossSpawnTimeoutRef = useRef<number | null>(null);
  const [enemiesRemaining, setEnemiesRemaining] = useState(0);
  const [score, setScore] = useState(0);
  const [waveMessage, setWaveMessage] = useState('');
  const [mobileMode, setMobileMode] = useState(false);
  const [stats, setStats] = useState<RunStats>({ kills: 0, deaths: 0, shotsFired: 0, shotsHit: 0 });
  const [lifetimeStats, setLifetimeStats] = useState<LifetimeStats>({
    totalKills: 0,
    totalDeaths: 0,
    totalCredits: 0,
    bestWave: 0,
    totalWins: 0,
    totalGames: 0
  });
  const isRunEndingRef = useRef(false);

  // --- Debug State ---
  const [debugData, setDebugData] = useState<any>({});
  
  // --- Meta Progression State ---
  const [tacticalCredits, setTacticalCredits] = useState(0);
  const [upgradeLevels, setUpgradeLevels] = useState<Record<string, number>>({
    armorPlating: 0,
    ammoReserve: 0,
    quickReload: 0,
    scavenger: 0
  });
  const [weaponUpgradeLevels, setWeaponUpgradeLevels] = useState<Record<WeaponType, { damage: number, reload: number, stability: number }>>({
    pistol: { damage: 0, reload: 0, stability: 0 },
    rifle: { damage: 0, reload: 0, stability: 0 },
    shotgun: { damage: 0, reload: 0, stability: 0 },
    sniper: { damage: 0, reload: 0, stability: 0 }
  });
  const [weaponMags, setWeaponMags] = useState<Record<WeaponType, number>>({
    pistol: WEAPONS.pistol.magSize,
    rifle: WEAPONS.rifle.magSize,
    shotgun: WEAPONS.shotgun.magSize,
    sniper: WEAPONS.sniper.magSize
  });
  const [earnedCredits, setEarnedCredits] = useState(0);
  const [difficulty, setDifficulty] = useState<DifficultyKey>('normal');
  const [upgradeTab, setUpgradeTab] = useState<'biological' | 'weapon'>('biological');
  const [selectedLabWeapon, setSelectedLabWeapon] = useState<WeaponType>('pistol');
  const [menuView, setMenuView] = useState<'main' | 'armory' | 'difficulty' | 'profile'>('main');

  // Load Meta Data
  useEffect(() => {
    const credits = loadCredits();
    if (credits !== null) setTacticalCredits(credits);

    const upgrades = loadUpgrades();
    if (upgrades) setUpgradeLevels(prev => ({ ...prev, ...upgrades }));

    const weaponUpgrades = loadWeaponUpgrades();
    if (weaponUpgrades) setWeaponUpgradeLevels(prev => ({ ...prev, ...weaponUpgrades }));

    const diff = loadDifficulty();
    if (diff) setDifficulty(diff);

    const stats = loadLifetimeStats();
    if (stats) setLifetimeStats(prev => ({ ...prev, ...stats }));
  }, []);

  const saveMeta = (credits: number, upgrades: UpgradeLevels | Record<string, number>, weaponUpgrades?: WeaponUpgradeLevels, lStats?: LifetimeStats) => {
    saveCredits(credits);
    saveUpgrades(upgrades);
    if (weaponUpgrades) saveWeaponUpgrades(weaponUpgrades);
    if (lStats) saveLifetimeStats(lStats);
  };

  useEffect(() => {
    const checkMobile = () => {
      const isTouch = window.matchMedia("(pointer: coarse)").matches;
      const isSmall = window.innerWidth < 1024;
      setMobileMode(isTouch || isSmall);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>('rifle');
  const [ammo, setAmmo] = useState({ mag: WEAPONS.rifle.magSize, reserve: 120 });
  const ammoRef = useRef(ammo);
  const [hp, setHp] = useState(100);
  const [isReloading, setIsReloading] = useState(false);
  const isReloadingRef = useRef(false);
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);
  const lastFpsTime = useRef(Date.now());
  const [hitMarker, setHitMarker] = useState({ time: 0, killed: false });
  const [bossHp, setBossHp] = useState<{ current: number, max: number } | null>(null);
  const pickups = useRef<Pickup[]>([]);
  const lastDamageTaken = useRef(0);
  const gameStartTime = useRef(0);
  const screenShake = useRef(0);

  useEffect(() => { ammoRef.current = ammo; }, [ammo]);

  // Game Engine Refs
  const safeStart = getSafePlayerStart();
  const player = useRef<Player>({
    x: safeStart.x, y: safeStart.y, angle: safeStart.angle, 
    velX: 0, velY: 0, 
    rotVel: 0, pitch: 0,
    radius: 16,
    isAds: false,
    adsProgress: 0
  });

  const [killfeed, setKillfeed] = useState<KillfeedItem[]>([]);
  const [damageIndicators, setDamageIndicators] = useState<DamageIndicator[]>([]);
  const nextKillfeedId = useRef(0);
  const nextDamageId = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const enemies = useRef<Enemy[]>([]);
  const particles = useRef<Particle[]>([]);
  const navGridRef = useRef<number[][]>([]);
  const mapData = useRef([...MAP.map(row => [...row])]);
  const [mapDataState, setMapDataState] = useState([...MAP.map(row => [...row])]);
  const lastShotTime = useRef(0);
  const lastEnemyShotTimeGlobal = useRef(0);
  const recoilOffset = useRef(0);
  const lastDamageSource = useRef<any>(null);

  // Mobile Control Refs
  const joystick = useRef({ active: false, startX: 0, startY: 0, curX: 0, curY: 0 });
  const touchLook = useRef({ active: false, lastX: 0, lastY: 0 });

  const [enemiesState, setEnemiesState] = useState<Enemy[]>([]);
  const renderTick = useRef(0);

  const initGame = () => {
    gameStartTime.current = Date.now();
    isRunEndingRef.current = false;
    setGameState('playing');
    setCurrentWeapon('pistol');
    const maxHp = 100 + (upgradeLevels.armorPlating * 5);
    setHp(maxHp);
    setStats({ kills: 0, deaths: 0, shotsFired: 0, shotsHit: 0 });
    
    const initialReserve = 120 + (upgradeLevels.ammoReserve * 20);
    const initialAmmo = { mag: WEAPONS.pistol.magSize, reserve: initialReserve };
    setAmmo(initialAmmo);
    ammoRef.current = initialAmmo;
    setScore(0);
    setWave(1);
    setEarnedCredits(0);
    waveRef.current = 1;
    isWaveTransitionRef.current = false;
    isSpawningRef.current = false;
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current);
      spawnIntervalRef.current = null;
    }
    if (reloadTimeoutRef.current) {
      clearTimeout(reloadTimeoutRef.current);
      reloadTimeoutRef.current = null;
    }
    if (waveTransitionTimeoutRef.current) {
      clearTimeout(waveTransitionTimeoutRef.current);
      waveTransitionTimeoutRef.current = null;
    }
    if (bossSpawnTimeoutRef.current) {
      clearTimeout(bossSpawnTimeoutRef.current);
      bossSpawnTimeoutRef.current = null;
    }
    if (reloadTimeoutRef.current) {
      clearTimeout(reloadTimeoutRef.current);
      reloadTimeoutRef.current = null;
    }
    setIsReloading(false);
    isReloadingRef.current = false;
    setEnemiesRemaining(0);
    setBossHp(null);
    setWaveMessage('');
    setWeaponMags({
      pistol: WEAPONS.pistol.magSize,
      rifle: WEAPONS.rifle.magSize,
      shotgun: WEAPONS.shotgun.magSize,
      sniper: WEAPONS.sniper.magSize
    });
    pickups.current = [];
    const safeStartUpdate = getSafePlayerStart();
    player.current = { x: safeStartUpdate.x, y: safeStartUpdate.y, angle: safeStartUpdate.angle, velX: 0, velY: 0, rotVel: 0, pitch: 0, radius: 16, isAds: false, adsProgress: 0 };
    enemies.current = [];
    setEnemiesState([]);
    particles.current = [];
    navGridRef.current = MAP.map(row => row.map(() => 999));
    graveyard.current = [];
    killfeed.length = 0;
    setKillfeed([]);
    keys.current = {};
    joystick.current.active = false;
    touchLook.current.active = false;
    const newMap = [...MAP.map(row => [...row])];
    mapData.current = newMap;
    setMapDataState([...newMap]);
    spawnWave(1);
    sounds.init();
  };

  useEffect(() => {
    const updateNav = () => {
      if (gameStateRef.current !== 'playing') return;
      
      const rows = MAP.length;
      const cols = MAP[0].length;
      const distMap = MAP.map(row => row.map(() => 999));
      
      const px = Math.floor(player.current.x / CELL_SIZE);
      const py = Math.floor(player.current.y / CELL_SIZE);
      
      if (px < 0 || px >= cols || py < 0 || py >= rows) return;
      
      const queue: [number, number, number][] = [[px, py, 0]];
      distMap[py][px] = 0;
      
      let head = 0;
      while (head < queue.length) {
        const [x, y, d] = queue[head++];
        
        const neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dx, dy] of neighbors) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
            // Treat doors (2) as walkable for pathfinding logic so enemies wait outside or approach
            if (MAP[ny][nx] === 0 || MAP[ny][nx] === 2) {
              if (distMap[ny][nx] > d + 1) {
                distMap[ny][nx] = d + 1;
                queue.push([nx, ny, d + 1]);
              }
            }
          }
        }
      }
      navGridRef.current = distMap;
    };

    const interval = setInterval(updateNav, 500);
    return () => clearInterval(interval);
  }, []);

  const tracers = useRef<Tracer[]>([]);
  const nextTracerId = useRef(0);

  const spawnWave = (waveNum: number) => {
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current);
      spawnIntervalRef.current = null;
    }
    if (waveTransitionTimeoutRef.current) {
      clearTimeout(waveTransitionTimeoutRef.current);
      waveTransitionTimeoutRef.current = null;
    }
    
    isWaveTransitionRef.current = true;
    setWaveMessage(`WAVE ${waveNum}`);
    
    waveTransitionTimeoutRef.current = setTimeout(() => {
      setWaveMessage('');
      isWaveTransitionRef.current = false;
      waveTransitionTimeoutRef.current = null;
    }, 3000) as unknown as number;
    
    waveRef.current = waveNum;
    isSpawningRef.current = true;
    
    // Gradual spawning
    const count = waveNum === 1 ? 3 : 3 + waveNum * 2;
    let spawnedCount = 0;
    spawnIntervalRef.current = setInterval(() => {
        if (gameStateRef.current !== 'playing') {
            if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
            return;
        }

        if (spawnedCount >= count) {
            if (spawnIntervalRef.current) {
              clearInterval(spawnIntervalRef.current);
              spawnIntervalRef.current = null;
            }
            
            if (waveNum === 5) {
              isSpawningRef.current = true;
              if (bossSpawnTimeoutRef.current) clearTimeout(bossSpawnTimeoutRef.current);
              bossSpawnTimeoutRef.current = setTimeout(() => {
                if (gameStateRef.current === 'playing' && waveRef.current === 5) {
                  spawnEnemies(1, 5, true);
                  setEnemiesRemaining(prev => prev + 1);
                }
                isSpawningRef.current = false;
                bossSpawnTimeoutRef.current = null;
              }, 4000) as unknown as number;
            } else {
              isSpawningRef.current = false;
            }
            return;
        }
        spawnEnemies(1, waveNum);
        spawnedCount++;
    }, 800) as unknown as number;
  };

  const spawnEnemies = (count: number, currentWave: number = 1, isBoss: boolean = false) => {
    const types: ('rusher' | 'rifleman' | 'sniper')[] = ['rusher', 'rifleman', 'sniper'];
    let spawned = 0;
    let attempts = 0;
    
    // Fallback: collect all empty cells
    const emptyCells: {x: number, y: number}[] = [];
    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[0].length; x++) {
        if (MAP[y][x] === 0) {
          emptyCells.push({ x: x * CELL_SIZE + CELL_SIZE/2, y: y * CELL_SIZE + CELL_SIZE/2 });
        }
      }
    }
    
    while (spawned < count && attempts < 100) {
        attempts++;
        let rx = Math.random() * (MAP[0].length * CELL_SIZE);
        let ry = Math.random() * (MAP.length * CELL_SIZE);
        
        const distToPlayer = Math.hypot(rx - player.current.x, ry - player.current.y);
        const mapX = Math.floor(rx / CELL_SIZE);
        const mapY = Math.floor(ry / CELL_SIZE);
        
        let validSpawn = distToPlayer > (currentWave === 1 ? 600 : 500) && MAP[mapY]?.[mapX] === 0;
        
        // Safe spawn check for Wave 1: Avoid direct LOS
        if (validSpawn && currentWave === 1 && attempts < 80) {
            const hasLOS = checkLineOfSight(rx, ry, player.current.x, player.current.y, MAP);
            if (hasLOS) validSpawn = false;
        }

        if (validSpawn) {
            let type: 'rusher' | 'rifleman' | 'sniper' = 'rifleman';
            if (isBoss) {
                type = 'rifleman';
            } else if (currentWave === 1) {
                type = Math.random() > 0.4 ? 'rifleman' : 'rusher'; // No snipers in wave 1 or very rare
            } else {
                type = types[Math.floor(Math.random() * types.length)];
            }
            const diffMult = DIFFICULTIES[difficulty].hpMult;
            const hpBuff = 1 + (currentWave - 1) * 0.15;
            const speedBuff = 1 + (currentWave - 1) * 0.04;
            const finalHp = (type === 'rusher' ? 60 : type === 'rifleman' ? 100 : 80) * hpBuff * (isBoss ? 20 : 1) * diffMult;

            const newEnemy = {
                id: Math.random(),
                x: rx, y: ry,
                type,
                isBoss,
                hp: finalHp,
                maxHp: finalHp,
                lastShot: Date.now() + Math.random() * 2000,
                speed: (type === 'rusher' ? 3.5 : type === 'rifleman' ? 2 : 1.5) * speedBuff * (isBoss ? 0.7 : 1),
                color: isBoss ? '#f43f5e' : (type === 'rusher' ? '#f87171' : type === 'rifleman' ? '#fbbf24' : '#38bdf8'),
                stuckFrames: 0,
                lastX: rx,
                lastY: ry,
                targetAngle: 0,
                spawnTime: Date.now()
            };
            
            if (isBoss) {
              setBossHp({ current: finalHp, max: finalHp });
            }

            enemies.current.push(newEnemy);
            spawned++;
        }
    }
    setEnemiesState([...enemies.current]);
    setEnemiesRemaining(enemies.current.length);
  };

  const graveyard = useRef<{ x: number, y: number, color: string, type: string }[]>([]);

  const handleShoot = () => {
    if (gameStateRef.current !== 'playing' || isReloadingRef.current) return;
    const now = Date.now();
    const weapon = WEAPONS[currentWeapon];
    if (now - lastShotTime.current < weapon.fireRate) return;
    
    // Check ammo
    if (ammoRef.current.mag <= 0) {
      if (!isReloadingRef.current && ammoRef.current.reserve > 0) reload();
      return;
    }

    lastShotTime.current = now;
    setAmmo(prev => ({ ...prev, mag: Math.max(0, prev.mag - 1) }));
    setStats(prev => ({ ...prev, shotsFired: prev.shotsFired + 1 }));
    sounds.playShot(currentWeapon);

    // Apply Recoil & Shake
    const weaponLevels = weaponUpgradeLevels[currentWeapon];
    const stabilityMult = 1 - (weaponLevels.stability * 0.05);
    const recoilForce = weapon.recoil * (1 - player.current.adsProgress * 0.6) * stabilityMult;
    recoilOffset.current += recoilForce / 40;
    screenShake.current = Math.min(15, screenShake.current + recoilForce / 4);

    // Raycast for Hit Detection
    const spreadMult = 1 - (weaponLevels.stability * 0.05);
    const spread = (Math.random() - 0.5) * weapon.spread * (1 - player.current.adsProgress * 0.8) * spreadMult;
    const shotAngle = player.current.angle + spread;
    const cos = Math.cos(shotAngle);
    const sin = Math.sin(shotAngle);
    
    let hitDist = weapon.range;
    let hitSomething = false;
    
    // Raycast for barrels/walls/crates
    for (let d = 0; d < weapon.range; d += 8) {
        const tx = Math.floor((player.current.x + cos * d) / CELL_SIZE);
        const ty = Math.floor((player.current.y + sin * d) / CELL_SIZE);
        if (tx >= 0 && tx < MAP[0].length && ty >= 0 && ty < MAP.length) {
            const cell = mapData.current[ty][tx];
            if (cell === 3) { // Barrel
                if (mapData.current[ty]) mapData.current[ty][tx] = 0; // Explode!
                setMapDataState([...mapData.current.map(row => [...row])]);
                spawnParticles(player.current.x + cos * d, player.current.y + sin * d, 'explosion');
                sounds.playShot('sniper'); // Loud explosion sound
                hitDist = d;
                hitSomething = true;
                break;
            } else if (cell === 1 || cell === 2) { // Wall or Crate/Door
                hitDist = d;
                break;
            }
        }
    }
    
    // Check enemies
    enemies.current.forEach(enemy => {
        if (enemy.dead) return;
        const dx = enemy.x - player.current.x;
        const dy = enemy.y - player.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > hitDist) return;
        
        const angleToEnemy = Math.atan2(dy, dx);
        const angleDiff = Math.atan2(Math.sin(angleToEnemy - shotAngle), Math.cos(angleToEnemy - shotAngle));
        
        if (Math.abs(angleDiff) < 0.15 * (weapon.type === 'shotgun' ? 3 : 1)) {
            // Check if bullet path to enemy is clear of static obstacles
            if (!checkLineOfSight(player.current.x, player.current.y, enemy.x, enemy.y, mapData.current)) return;

            const damageMult = 1 + (weaponUpgradeLevels[currentWeapon].damage * 0.05);
            enemy.hp -= weapon.damage * damageMult;
            hitSomething = true;
            
            if (enemy.isBoss) {
              setBossHp({ current: Math.max(0, enemy.hp), max: enemy.maxHp });
            }

            sounds.playHit();
            spawnParticles(enemy.x, enemy.y, 'blood');
            if (enemy.hp <= 0) {
              enemy.dead = true;
              setHitMarker({ time: Date.now(), killed: true });
              sounds.playKill();
              setStats(prev => ({ ...prev, kills: prev.kills + 1 }));
              const killScore = enemy.isBoss ? 5000 : (enemy.type === 'sniper' ? 500 : enemy.type === 'rifleman' ? 200 : 100);
              setScore(prev => prev + killScore);
              setKillfeed(prev => [{ id: nextKillfeedId.current++, text: `${enemy.isBoss ? 'TITAN' : enemy.type.toUpperCase()} NEUTRALIZED (+${killScore})` }, ...prev].slice(0, 5));
              graveyard.current.push({ x: enemy.x, y: enemy.y, color: enemy.color, type: enemy.type });
              spawnParticles(enemy.x, enemy.y, 'explosion');

              // Chance for pickup
              const baseDropChance = 0.35;
              const dropChance = baseDropChance + (upgradeLevels.scavenger * 0.05);
              if (Math.random() < dropChance || enemy.isBoss) {
                 const type = Math.random() > 0.5 ? 'health' : 'ammo';
                 pickups.current.push({
                   id: Math.random(),
                   x: enemy.x,
                   y: enemy.y,
                   type,
                   rotation: 0
                 });
              }

              if (enemy.isBoss) setBossHp(null);
            } else {
              setHitMarker({ time: Date.now(), killed: false });
            }
        }
    });

    if (hitSomething) {
      setStats(prev => ({ ...prev, shotsHit: prev.shotsHit + 1 }));
    }

    // Spawn Shell Casing and Muzzle Flash
    spawnParticles(player.current.x, player.current.y, 'shell');

    // Player Shot Tracer
    tracers.current.push({
      id: nextTracerId.current++,
      x1: player.current.x,
      y1: player.current.y,
      x2: player.current.x + cos * hitDist,
      y2: player.current.y + sin * hitDist,
      alpha: 1
    });
  };

  const reload = () => {
    // Prevent double reload and check conditions
    if (isReloadingRef.current || ammoRef.current.mag >= WEAPONS[currentWeapon].magSize || ammoRef.current.reserve <= 0 || gameStateRef.current !== 'playing') return;

    setIsReloading(true);
    isReloadingRef.current = true;
    sounds.playReload();

    const reloadingWeapon = currentWeapon;
    if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
    const reloadReduction = upgradeLevels.quickReload * 0.05;
    const weaponReloadReduction = weaponUpgradeLevels[currentWeapon].reload * 0.04;
    const finalReloadTime = WEAPONS[currentWeapon].reloadTime * (1 - reloadReduction) * (1 - weaponReloadReduction);
    
    reloadTimeoutRef.current = setTimeout(() => {
      setAmmo(prev => {
        const weaponStats = WEAPONS[reloadingWeapon];
        const needed = weaponStats.magSize - prev.mag;
        const taken = Math.min(needed, prev.reserve);
        const newMag = prev.mag + taken;
        // Also update the stored mag for this weapon
        setWeaponMags(mags => ({ ...mags, [reloadingWeapon]: newMag }));
        const newAmmo = {
          mag: newMag,
          reserve: prev.reserve - taken
        };
        ammoRef.current = newAmmo;
        return newAmmo;
      });
      setIsReloading(false);
      isReloadingRef.current = false;
      reloadTimeoutRef.current = null;
    }, finalReloadTime) as unknown as number;
  };

  const spawnParticles = (x: number, y: number, type: 'blood' | 'explosion' | 'shell') => {
    const count = type === 'explosion' ? 20 : 5;
    for (let i = 0; i < count; i++) {
      particles.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0,
        color: type === 'blood' ? '#ef4444' : type === 'shell' ? '#eab308' : '#fb923c',
        size: Math.random() * 4 + 2
      });
    }
  };

  const update = () => {
    frameCount.current++;
    const nowTime = Date.now();
    if (nowTime - lastFpsTime.current >= 1000) {
        setFps(frameCount.current);
        frameCount.current = 0;
        lastFpsTime.current = nowTime;
    }

    if (gameStateRef.current !== 'playing') return;

    // Player Movement
    let dx = 0; let dy = 0;
    const isW = keys.current['w'];
    const isS = keys.current['s'];
    const isA = keys.current['a'];
    const isD = keys.current['d'];
    const isShift = keys.current['shift'];

    // joystick input
    if (joystick.current.active) {
      const jDx = joystick.current.curX - joystick.current.startX;
      const jDy = joystick.current.curY - joystick.current.startY;
      const jDist = Math.sqrt(jDx * jDx + jDy * jDy);
      const jAngle = Math.atan2(jDy, jDx);
      const limitedDist = Math.min(50, jDist);
      const intensity = limitedDist / 50;

      // Adjust relative to player angle
      const moveAngle = player.current.angle + jAngle + Math.PI / 2;
      dx = Math.cos(moveAngle) * intensity;
      dy = Math.sin(moveAngle) * intensity;
    }

    if (isW) { dx += Math.cos(player.current.angle); dy += Math.sin(player.current.angle); }
    if (isS) { dx -= Math.cos(player.current.angle); dy -= Math.sin(player.current.angle); }
    if (isA) { dx += Math.sin(player.current.angle); dy -= Math.cos(player.current.angle); }
    if (isD) { dx -= Math.sin(player.current.angle); dy += Math.cos(player.current.angle); }

    // ADS Toggle/Hold (Right click or C)
    player.current.isAds = keys.current['c'] || keys.current['m_right'];
    if (player.current.isAds) {
      player.current.adsProgress = Math.min(1, player.current.adsProgress + 0.1);
    } else {
      player.current.adsProgress = Math.max(0, player.current.adsProgress - 0.1);
    }

    const moveSpeed = (isShift ? 6 : 4) * (1 - player.current.adsProgress * 0.5);
    const nx = player.current.x + dx * moveSpeed;
    const ny = player.current.y + dy * moveSpeed;

    // Movement Collision with Radius
    const checkCollision = (px: number, py: number) => {
      const radius = PLAYER_RADIUS;
      const points = [
        { x: px + radius, y: py },
        { x: px - radius, y: py },
        { x: px, y: py + radius },
        { x: px, y: py - radius },
        { x: px + radius * 0.7, y: py + radius * 0.7 },
        { x: px - radius * 0.7, y: py + radius * 0.7 },
        { x: px + radius * 0.7, y: py - radius * 0.7 },
        { x: px - radius * 0.7, y: py - radius * 0.7 },
      ];

      for (const p of points) {
        const tx = Math.floor(p.x / CELL_SIZE);
        const ty = Math.floor(p.y / CELL_SIZE);
        if (ty < 0 || ty >= mapData.current.length || tx < 0 || tx >= mapData.current[0].length) return true;
        const cell = mapData.current[ty][tx];
        
        if (isMovementBlockingCell(cell)) {
          // Auto-Interaction for Doors (was cell 2)
          if (cell === 2) {
             mapData.current[ty][tx] = 0;
             setMapDataState([...mapData.current.map(row => [...row])]);
             sounds.playReload();
          }
          return true;
        }
      }
      return false;
    };

    // Slide along walls
    if (!checkCollision(nx, player.current.y)) {
      player.current.x = nx;
    }
    if (!checkCollision(player.current.x, ny)) {
      player.current.y = ny;
    }

    // Pickup Collection
    pickups.current = pickups.current.filter((p) => {
      const dist = Math.hypot(p.x - player.current.x, p.y - player.current.y);
      if (dist < 32) {
        if (p.type === 'health') {
           const maxHp = 100 + (upgradeLevels.armorPlating * 5);
           setHp(prev => Math.min(maxHp, prev + 25));
        } else {
           const maxReserve = 120 + (upgradeLevels.ammoReserve * 20);
           setAmmo(prev => ({ ...prev, reserve: Math.min(maxReserve, prev.reserve + 60) }));
        }
        sounds.playPickup(p.type);
        setKillfeed(prev => [{ id: nextKillfeedId.current++, text: `+ ${p.type.toUpperCase()} SECURED` }, ...prev].slice(0, 5));
        return false;
      }
      p.rotation += 0.05;
      return true;
    });

    // Apply Recoil Decay & Shake
    recoilOffset.current *= 0.85;
    screenShake.current *= 0.9;
    
    if (keys.current['m_left'] && WEAPONS[currentWeapon].isAuto) {
      handleShoot();
    }

    // Enemy AI
    const now = Date.now();
    enemies.current = enemies.current.filter(e => !e.dead);
    
    // Wave Management
    if (gameStateRef.current === 'playing' && enemies.current.length === 0 && !isSpawningRef.current && !isWaveTransitionRef.current) {
       if (waveRef.current >= 5) {
         if (!isRunEndingRef.current) {
           isRunEndingRef.current = true;
           const diffMult = DIFFICULTIES[difficulty].creditMult;
           const finalCredits = Math.floor((stats.kills * 15 + waveRef.current * 100 + score / 5 + 1500) * diffMult);
           setEarnedCredits(finalCredits);
           
           const nextLStats = {
             ...lifetimeStats,
             totalKills: lifetimeStats.totalKills + stats.kills,
             bestWave: Math.max(lifetimeStats.bestWave, waveRef.current),
             totalWins: lifetimeStats.totalWins + 1,
             totalGames: lifetimeStats.totalGames + 1,
             totalCredits: lifetimeStats.totalCredits + finalCredits
           };
           setLifetimeStats(nextLStats);
           setTacticalCredits(prev => {
             const total = prev + finalCredits;
             saveMeta(total, upgradeLevels, weaponUpgradeLevels, nextLStats);
             return total;
           });
           setGameState('win');
         }
         if (spawnIntervalRef.current) {
           clearInterval(spawnIntervalRef.current);
           spawnIntervalRef.current = null;
         }
         if (reloadTimeoutRef.current) {
           clearTimeout(reloadTimeoutRef.current);
           reloadTimeoutRef.current = null;
         }
         if (waveTransitionTimeoutRef.current) {
           clearTimeout(waveTransitionTimeoutRef.current);
           waveTransitionTimeoutRef.current = null;
         }
         if (bossSpawnTimeoutRef.current) {
           clearTimeout(bossSpawnTimeoutRef.current);
           bossSpawnTimeoutRef.current = null;
         }
         setIsReloading(false);
         setWaveMessage('');
         isWaveTransitionRef.current = false;
         keys.current = {};
         joystick.current.active = false;
         touchLook.current.active = false;
       } else {
         const nextWave = waveRef.current + 1;
         setWave(nextWave);
         spawnWave(nextWave);
       }
    }

    enemies.current.forEach(e => {
      const pDx = player.current.x - e.x;
      const pDy = player.current.y - e.y;
      const dist = Math.sqrt(pDx * pDx + pDy * pDy);

      // Line of Sight Check 
      const angleToPlayer = Math.atan2(pDy, pDx);
      const cos = Math.cos(angleToPlayer);
      const sin = Math.sin(angleToPlayer);

      const losInfo = checkLineOfSightInfo(e.x, e.y, player.current.x, player.current.y, mapData.current);
      e.hasLineOfSight = losInfo.hasLOS;
      e.blockedBy = losInfo.blockedBy; // Store for debug

      // Behavioral logic
      let targetDist = 0;
      if (e.type === 'rusher') targetDist = 80;
      else if (e.type === 'rifleman') targetDist = 320;
      else if (e.type === 'sniper') targetDist = 600;

      let moveX = 0;
      let moveY = 0;

      if (e.hasLineOfSight) {
          if (dist > targetDist + 16) {
              moveX = cos * e.speed;
              moveY = sin * e.speed;
          } else if (dist < targetDist - 32) {
              moveX = -cos * e.speed;
              moveY = -sin * e.speed;
          }
          
          // Strafe if very close to player to avoid clipping (increased distance)
          if (dist < 150) {
            moveX += -sin * e.speed * 0.7;
            moveY += cos * e.speed * 0.7;
          }
          
          // Anti-Stuck: if trying to move but distance doesn't change
          const dMoved = Math.hypot(e.x - e.lastX, e.y - e.lastY);
          if ((moveX !== 0 || moveY !== 0) && dMoved < 0.1) {
            e.stuckFrames++;
          } else {
            e.stuckFrames = Math.max(0, e.stuckFrames - 2);
          }

          if (e.stuckFrames > 60) {
            // Strafe to break block
            moveX = -sin * e.speed;
            moveY = cos * e.speed;
            if (e.stuckFrames > 120) e.stuckFrames = 0; 
          }

          // Shoot Logic
          const fireRateBase = e.isBoss ? 600 : (e.type === 'sniper' ? 3000 : e.type === 'rifleman' ? 900 : 1800);
          const wave1FireRateBuffer = waveRef.current === 1 ? 1.5 : 1.0;
          const fireRate = fireRateBase * wave1FireRateBuffer;

          const isGracePeriod = now - gameStartTime.current < INITIAL_GRACE_PERIOD;
          const canShoot = !isGracePeriod && now - e.spawnTime > (waveRef.current === 1 ? 3000 : 1500);
          
          // Wave 1 Restriction: Only one enemy can shoot at a time
          const globalShootCooldown = waveRef.current === 1 ? now - lastEnemyShotTimeGlobal.current < 1000 : false;

          if (canShoot && !globalShootCooldown && now - e.lastShot > fireRate && dist < 1200) {
              // FINAL REAL-TIME LOS VALIDATION AT DAMAGE MOMENT
              const shotLOS = checkLineOfSightInfo(e.x, e.y, player.current.x, player.current.y, mapData.current);
              e.hasLineOfSight = shotLOS.hasLOS;
              e.blockedBy = shotLOS.blockedBy;

              if (shotLOS.hasLOS) {
                  e.lastShot = now;
                  lastEnemyShotTimeGlobal.current = now;
                  
                  if (!DEBUG_SAFE_MODE && now - lastDamageTaken.current > 600) { 
                      const baseDamage = e.type === 'sniper' ? 35 : e.type === 'rifleman' ? 12 : 8;
                      const wave1Mult = waveRef.current === 1 ? WAVE_1_DAMAGE_MULT : 1.0;
                      const damage = (e.isBoss ? baseDamage * 2.5 : baseDamage) * DIFFICULTIES[difficulty].dmgMult * wave1Mult;
                      
                      // Debug Data Storage
                      lastDamageSource.current = {
                        id: e.id,
                        type: e.type,
                        dist: Math.round(dist),
                        hasLOS: shotLOS.hasLOS,
                        blockedBy: shotLOS.blockedBy
                      };

                      setHp(prev => {
                          const newHp = Math.max(0, prev - damage);
                      if (newHp === 0 && gameStateRef.current === 'playing' && !isRunEndingRef.current) {
                        isRunEndingRef.current = true;
                        const diffMult = DIFFICULTIES[difficulty].creditMult;
                        const runCredits = Math.floor((stats.kills * 10 + waveRef.current * 50 + score / 10) * diffMult);
                        setEarnedCredits(runCredits);
                        
                        const nextLStats = {
                          ...lifetimeStats,
                          totalKills: lifetimeStats.totalKills + stats.kills,
                          bestWave: Math.max(lifetimeStats.bestWave, waveRef.current),
                          totalDeaths: lifetimeStats.totalDeaths + 1,
                          totalGames: lifetimeStats.totalGames + 1,
                          totalCredits: lifetimeStats.totalCredits + runCredits
                        };
                        setLifetimeStats(nextLStats);
                        setTacticalCredits(prevCred => {
                          const total = prevCred + runCredits;
                          saveMeta(total, upgradeLevels, weaponUpgradeLevels, nextLStats);
                          return total;
                        });
                        setGameState('dead');
                        if (spawnIntervalRef.current) {
                          clearInterval(spawnIntervalRef.current);
                          spawnIntervalRef.current = null;
                        }
                        if (reloadTimeoutRef.current) {
                          clearTimeout(reloadTimeoutRef.current);
                          reloadTimeoutRef.current = null;
                        }
                        if (waveTransitionTimeoutRef.current) {
                          clearTimeout(waveTransitionTimeoutRef.current);
                          waveTransitionTimeoutRef.current = null;
                        }
                        if (bossSpawnTimeoutRef.current) {
                          clearTimeout(bossSpawnTimeoutRef.current);
                          bossSpawnTimeoutRef.current = null;
                        }
                        setIsReloading(false);
                        setWaveMessage('');
                        isWaveTransitionRef.current = false;
                        keys.current = {};
                        joystick.current.active = false;
                        touchLook.current.active = false;
                      }
                      return newHp;
                  });
                  lastDamageTaken.current = now;
                  screenShake.current = Math.min(20, screenShake.current + damage / 2);
                  setDamageIndicators(prev => [...prev, { id: nextDamageId.current++, angle: angleToPlayer - player.current.angle + Math.PI, opacity: 1.2 }].slice(-5));
                  spawnParticles(player.current.x, player.current.y, 'blood');
                  sounds.playShot(e.type === 'sniper' ? 'sniper' : 'pistol');
              }
              tracers.current.push({ id: nextTracerId.current++, x1: e.x, y1: e.y, x2: player.current.x, y2: player.current.y, alpha: 1 });
            }
          }
      } else {
          // Pathfinding: No LOS
          const curGridX = Math.floor(e.x / CELL_SIZE);
          const curGridY = Math.floor(e.y / CELL_SIZE);
          
          if (navGridRef.current[curGridY]) {
            let bestD = navGridRef.current[curGridY][curGridX] || 999;
            let bestDir = { dx: 0, dy: 0 };
            
            const neighbors = [[0,1], [0,-1], [1,0], [-1,0], [1,1], [-1,-1], [1,-1], [-1,1]];
            for (const [dx, dy] of neighbors) {
              const nx = curGridX + dx;
              const ny = curGridY + dy;
              if (navGridRef.current[ny] && navGridRef.current[ny][nx] !== undefined) {
                const d = navGridRef.current[ny][nx];
                if (d < bestD) {
                  bestD = d;
                  bestDir = { dx, dy };
                }
              }
            }
            
            if (bestDir.dx !== 0 || bestDir.dy !== 0) {
               // Smooth movement towards the target cell
               const targetX = (curGridX + bestDir.dx) * CELL_SIZE + CELL_SIZE/2;
               const targetY = (curGridY + bestDir.dy) * CELL_SIZE + CELL_SIZE/2;
               const angleToGrid = Math.atan2(targetY - e.y, targetX - e.x);
               moveX = Math.cos(angleToGrid) * e.speed;
               moveY = Math.sin(angleToGrid) * e.speed;
            } else {
               // Fallback: move toward player
               moveX = cos * e.speed;
               moveY = sin * e.speed;
            }
          }
      }

      e.lastX = e.x;
      e.lastY = e.y;

      const nx = e.x + moveX;
      const ny = e.y + moveY;
      const txX = Math.floor(nx / CELL_SIZE);
      const tyY = Math.floor(ny / CELL_SIZE);
      const curTx = Math.floor(e.x / CELL_SIZE);
      const curTy = Math.floor(e.y / CELL_SIZE);

      const tryEnemyMove = (tx: number, ty: number) => {
        if (tx < 0 || tx >= MAP[0].length || ty < 0 || ty >= MAP.length) return false;
        const cell = mapData.current[ty][tx];
        if (cell === 0) return true;
        if (cell === 2) {
          if (mapData.current[ty]) mapData.current[ty][tx] = 0;
          setMapDataState([...mapData.current.map(row => [...row])]);
          return true;
        }
        return false;
      };

      if (tryEnemyMove(txX, curTy)) e.x = nx;
      else if (txX !== curTx) e.stuckFrames++;

      if (tryEnemyMove(curTx, tyY)) e.y = ny;
      else if (tyY !== curTy) e.stuckFrames++;
    });

    // Debug Data Calculation
    if (DEBUG_MODE) {
      let nearestDist = 9999;
      let nearestEnemy: any = null;
      let enemiesWithLOS = 0;
      enemies.current.forEach(e => {
        const dist = Math.hypot(e.x - player.current.x, e.y - player.current.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = e;
        }
        if (e.hasLineOfSight) enemiesWithLOS++;
      });

      const dmg = lastDamageSource.current;

      setDebugData({
        fps,
        gameState: gameStateRef.current,
        currentWeapon,
        ammo: `${ammo.mag}/${ammo.reserve}`,
        hp, 
        px: player.current.x.toFixed(0),
        py: player.current.y.toFixed(0),
        angle: (player.current.angle % (Math.PI * 2)).toFixed(2),
        pitch: player.current.pitch.toFixed(1),
        wave: waveRef.current,
        enemiesTotal: enemies.current.length,
        enemiesRemaining,
        enemiesWithLOS,
        gracePeriodRemaining: Math.max(0, INITIAL_GRACE_PERIOD - (now - gameStartTime.current)),
        wave1DamageMult: waveRef.current === 1 ? 'ACTIVE (0.5x)' : 'INACTIVE (1.0x)',
        nearestDist: nearestDist.toFixed(1),
        nearestType: nearestEnemy?.type || 'none',
        nearestLOS: nearestEnemy ? `${nearestEnemy.hasLineOfSight} (Blocked by: ${nearestEnemy.blockedBy ?? 'None'})` : 'none',
        lastDmgInfo: dmg ? `ID:${dmg.id.toString()} | ${dmg.type} | Dist:${dmg.dist} | LOS:${dmg.hasLOS} | BBy:${dmg.blockedBy}` : 'none'
      });
    }

    // Sync internal state for 3D rendering (Throttle to ~30fps for UI/Render sync)
    renderTick.current++;
    if (renderTick.current % 2 === 0) {
      setEnemiesState([...enemies.current]);
      setEnemiesRemaining(Math.max(0, enemies.current.length));
      setDamageIndicators(prev => prev.map(ind => ({ ...ind, opacity: ind.opacity - 0.02 })).filter(ind => ind.opacity > 0));
    }

    // Update Tracers
    tracers.current.forEach(t => t.alpha -= 0.05);
    tracers.current = tracers.current.filter(t => t.alpha > 0);
    particles.current.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.life -= 0.02;
    });
    particles.current = particles.current.filter(p => p.life > 0);
  };

  const buyUpgrade = (key: string) => {
    const upgrade = UPGRADES[key];
    const currentLevel = upgradeLevels[key];
    if (currentLevel >= upgrade.maxLevel) return;
    
    const cost = upgrade.costs[currentLevel];
    if (tacticalCredits >= cost) {
      const nextCredits = tacticalCredits - cost;
      const nextUpgrades = { ...upgradeLevels, [key]: currentLevel + 1 };
      setTacticalCredits(nextCredits);
      setUpgradeLevels(nextUpgrades);
      saveMeta(nextCredits, nextUpgrades, weaponUpgradeLevels);
      sounds.playPickup('health'); // Generic positive sound
    } else {
      sounds.playError();
    }
  };

  const buyWeaponUpgrade = (weapon: WeaponType, attribute: 'damage' | 'reload' | 'stability') => {
    const currentLevels = weaponUpgradeLevels[weapon];
    const currentLevel = currentLevels[attribute];
    if (currentLevel >= MAX_WEAPON_LEVEL) return;

    const cost = WEAPON_UPGRADE_COSTS[currentLevel];
    if (tacticalCredits >= cost) {
      const nextCredits = tacticalCredits - cost;
      const nextWeaponUpgrades = {
        ...weaponUpgradeLevels,
        [weapon]: { ...currentLevels, [attribute]: currentLevel + 1 }
      };
      setTacticalCredits(nextCredits);
      setWeaponUpgradeLevels(nextWeaponUpgrades);
      saveMeta(nextCredits, upgradeLevels, nextWeaponUpgrades);
      sounds.playPickup('ammo'); // Generic positive sound
    } else {
      sounds.playError();
    }
  };

  useEffect(() => {
    const loop = setInterval(() => {
      update();
    }, TICK_RATE);
    return () => {
      clearInterval(loop);
    };
  }, [gameState, currentWeapon, hp, ammo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (e.key === 'r') reload();
      if (['1','2','3','4'].includes(e.key)) {
        const weaponMap: Record<string, WeaponType> = { '1': 'pistol', '2': 'rifle', '3': 'shotgun', '4': 'sniper' };
        const next = weaponMap[e.key];
        if (next === currentWeapon) return;
        
        // Sync current mag before swap
        const currentMag = ammoRef.current.mag;
        setWeaponMags(prev => ({ ...prev, [currentWeapon]: currentMag }));
        
        setCurrentWeapon(next);
        setAmmo(prev => ({ ...prev, mag: weaponMags[next] }));
        
        setIsReloading(false);
        if (reloadTimeoutRef.current) {
          clearTimeout(reloadTimeoutRef.current);
          reloadTimeoutRef.current = null;
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => keys.current[e.key.toLowerCase()] = false;
    const handleMouseDown = (e: MouseEvent) => {
      if (gameState !== 'playing') return;
      if (document.pointerLockElement !== gameContainerRef.current) {
        togglePointerLock();
        return;
      }
      if (e.button === 2) keys.current['m_right'] = true;
      if (e.button === 0) {
        keys.current['m_left'] = true;
        handleShoot(); // Initial shot for semi and auto
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) keys.current['m_right'] = false;
      if (e.button === 0) keys.current['m_left'] = false;
    };
    const handleMouseMove = (e: MouseEvent) => {
        if (gameState !== 'playing' || document.pointerLockElement !== gameContainerRef.current) return;
        const speed = player.current.isAds ? 0.001 : 0.002;
        player.current.angle += e.movementX * speed;
        // Standard non-inverted look: movementY > 0 (down) -> Pitch increases -> Camera rotates X positive -> Looks Down
        player.current.pitch = clamp(player.current.pitch + e.movementY * 0.1, -25, 25);
    };

    const handlePointerLockChange = () => {
      if (document.pointerLockElement === null) {
        // When user exits lock, set the cooldown to prevent immediate re-entry failing
        pointerLockCooldownRef.current = Date.now();
      }
    };
    const handlePointerLockError = () => {
      console.warn('Pointer lock error event caught');
      // On error, reset cooldown so they can try again if the browser allows it
      pointerLockCooldownRef.current = 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    // Bind mouse events to window to capture even if out of container during drag/lock
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('pointerlockerror', handlePointerLockError);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('pointerlockerror', handlePointerLockError);
    };
  }, [gameState, currentWeapon]);

  const togglePointerLock = () => {
    if (mobileMode) return;
    if (gameContainerRef.current) {
        if (document.pointerLockElement === gameContainerRef.current) return;
        
        const now = Date.now();
        if (now - pointerLockCooldownRef.current < 1200) return; // Standard cooldown ~1.2s to be safe
        pointerLockCooldownRef.current = now;

        try {
            const promise = gameContainerRef.current.requestPointerLock();
            // Handle browsers that return a promise
            if (promise && typeof (promise as any).catch === 'function') {
                (promise as any).catch((e: Error) => {
                    console.warn('Pointer lock request failed:', e.message);
                });
            }
        } catch (err) {
            console.warn('Pointer lock initiation error:', err);
        }
    }
  };

  return (
    <div className="relative w-full h-[100dvh] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans select-none pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(30,58,138,0.2),transparent)]" />
      </div>

      {DEBUG_MODE && (
        <div className="absolute top-2 left-2 z-[999] pointer-events-none bg-black/90 text-yellow-400 font-mono text-[9px] p-2 rounded whitespace-pre border border-yellow-500/30 flex flex-col gap-0.5 backdrop-blur-sm">
          <div className="text-white font-bold mb-1 border-b border-white/20 pb-0.5 flex justify-between">
             <span>DIAGNOSTIC OVERLAY</span>
             <span className={debugData.fps < 45 ? 'text-red-500' : 'text-green-500'}>{debugData.fps} FPS</span>
          </div>
          <div>STATE | {debugData.gameState}</div>
          <div>WAVE  | {debugData.wave} ({debugData.enemiesRemaining} left)</div>
          <div>WEAP  | {debugData.currentWeapon} ({debugData.ammo})</div>
          <div>HP    | {debugData.hp}% (Grace: {Math.ceil(debugData.gracePeriodRemaining/1000)}s)</div>
          <div>W1_DMG | {debugData.wave1DamageMult}</div>
          <div>POS   | {debugData.px}, {debugData.py}</div>
          <div>CAM   | Ang:{debugData.angle} Pit:{debugData.pitch}</div>
          <div className="text-white font-bold mt-1 border-b border-white/20 pb-0.5">ENEMY INTEL</div>
          <div>NEAR  | {debugData.nearestType} ({debugData.nearestDist}m)</div>
          <div>LOS   | {debugData.nearestLOS}</div>
          <div>WITH_LOS | {debugData.enemiesWithLOS}</div>
          <div className="text-red-400 mt-1">LAST DMG SOURCE</div>
          <div className="text-[8px]">{debugData.lastDmgInfo}</div>
          <div className="text-cyan-400 font-bold mt-1">SAFE_MODE: {String(DEBUG_SAFE_MODE)}</div>
        </div>
      )}

      {/* Main Game Container */}
      <div 
        ref={gameContainerRef}
        className={`relative group bg-black cursor-crosshair touch-none overflow-hidden ${mobileMode ? 'w-full h-full' : 'shadow-2xl shadow-blue-900/20 border-4 border-slate-800 rounded-xl aspect-[4/3] max-w-[1000px] w-full'}`}
        onClick={togglePointerLock}
      >
        {gameState === 'playing' ? (
          <>
            <GameScene 
              player={player} 
              enemies={enemiesState}
              particles={particles.current}
              tracers={tracers.current}
              mapData={mapDataState}
              cellSize={CELL_SIZE}
              currentWeapon={currentWeapon}
              isReloading={isReloading}
              recoilOffset={recoilOffset.current}
              screenShake={screenShake.current}
              lastShotTime={lastShotTime.current}
              pickups={pickups.current}
              debugMode={DEBUG_MODE}
            />

            {/* Boss Health Bar */}
            {bossHp && (
              <div className="absolute top-16 md:top-20 left-1/2 -translate-x-1/2 w-[70vw] md:w-80 z-50 pointer-events-none">
                 <div className="flex justify-between items-end mb-1">
                    <span className="text-red-500 font-black text-[10px] md:text-xs uppercase tracking-widest italic">Sector Guardian: TITAN</span>
                    <span className="text-white font-mono text-[9px]">{Math.ceil(bossHp.current)} / {bossHp.max}</span>
                 </div>
                 <div className="h-1.5 md:h-2 bg-slate-900/80 rounded-full border border-red-500/30 overflow-hidden backdrop-blur-md">
                    <motion.div 
                      initial={{ width: '100%' }}
                      animate={{ width: `${(bossHp.current / bossHp.max) * 100}%` }}
                      className="h-full bg-gradient-to-r from-red-600 to-rose-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                    />
                 </div>
              </div>
            )}
          </>
        ) : (
          <canvas 
            ref={canvasRef} 
            width={800} 
            height={600} 
            className="w-full h-full cursor-crosshair"
            onClick={togglePointerLock}
          />
        )}

        {/* Mobile Controls Overlay */}
        {mobileMode && gameState === 'playing' && (
          <div className="absolute inset-0 z-50 pointer-events-none select-none">
            {/* Joystick Area */}
            <div 
              className="absolute bottom-6 left-4 md:bottom-10 md:left-10 w-32 h-32 md:w-40 md:h-40 flex items-center justify-center pointer-events-auto rounded-full bg-white/5 border border-white/10"
              onTouchStart={(e) => {
                e.preventDefault();
                const touch = e.touches[0];
                joystick.current = { 
                  active: true, 
                  startX: touch.clientX, 
                  startY: touch.clientY,
                  curX: touch.clientX, 
                  curY: touch.clientY 
                };
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                const touch = e.touches[0];
                joystick.current.curX = touch.clientX;
                joystick.current.curY = touch.clientY;
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                joystick.current.active = false;
                joystick.current.curX = joystick.current.startX;
                joystick.current.curY = joystick.current.startY;
              }}
              onTouchCancel={(e) => {
                e.preventDefault();
                joystick.current.active = false;
              }}
            >
              {joystick.current.active && (
                <div 
                  className="absolute w-12 h-12 bg-white/20 rounded-full border border-white/30 backdrop-blur-sm shadow-lg pointer-events-none"
                  style={{
                    transform: `translate(${clamp(joystick.current.curX - joystick.current.startX, -50, 50)}px, ${clamp(joystick.current.curY - joystick.current.startY, -50, 50)}px)`
                  }}
                />
              )}
              {!joystick.current.active && <div className="w-12 h-12 bg-white/10 rounded-full border border-white/5" />}
              <Move className="absolute text-white/10 pointer-events-none" size={40} />
            </div>

            {/* Look Area */}
            <div 
              className="absolute inset-y-0 right-0 w-3/5 pointer-events-auto"
              onTouchStart={(e) => {
                e.preventDefault();
                const touch = e.touches[0];
                touchLook.current = { active: true, lastX: touch.clientX, lastY: touch.clientY };
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                if (!touchLook.current.active) return;
                const touch = e.touches[0];
                const dx = touch.clientX - touchLook.current.lastX;
                const dy = touch.clientY - touchLook.current.lastY;
                
                const sensitivity = player.current.isAds ? 0.001 : 0.003;
                player.current.angle += dx * sensitivity;
                // Standard non-inverted look: dy > 0 (down) -> Pitch increases -> Camera rotates X positive -> Looks Down
                player.current.pitch = clamp(player.current.pitch + dy * 0.2, -25, 25);
                
                touchLook.current.lastX = touch.clientX;
                touchLook.current.lastY = touch.clientY;
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                touchLook.current.active = false;
              }}
              onTouchCancel={(e) => {
                e.preventDefault();
                touchLook.current.active = false;
              }}
            />

            {/* Action Buttons */}
            <div className={`absolute right-4 md:right-10 bottom-24 md:bottom-32 flex flex-col items-end gap-3 md:gap-6 pointer-events-none z-[60] ${mobileMode ? 'scale-90 origin-bottom-right' : ''}`}>
              
              <div className="flex gap-2 md:gap-4">
                  {/* ADS Button */}
                  <button 
                  className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center border-2 backdrop-blur-md pointer-events-auto transition-transform active:scale-95 ${player.current.isAds ? 'bg-cyan-500/40 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-slate-900/60 border-slate-700 text-slate-400'}`}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    keys.current['c'] = !keys.current['c'];
                  }}
                >
                  <div className="flex flex-col items-center">
                    <Target size={24} />
                    <span className="text-[8px] font-black uppercase mt-0.5">ADS</span>
                  </div>
                </button>

                {/* Reload Button */}
                <button 
                  className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-slate-900/60 border-2 border-slate-700 text-white flex items-center justify-center backdrop-blur-md pointer-events-auto active:scale-95 transition-transform"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    reload();
                  }}
                >
                  <div className="flex flex-col items-center">
                    <RefreshCcw size={24} className={isReloading ? 'animate-spin text-yellow-500' : ''} />
                    <span className="text-[8px] font-black uppercase mt-0.5">Rel</span>
                  </div>
                </button>
              </div>

              {/* Fire Button */}
              <button 
                className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-red-600/30 border-4 border-red-500/50 text-red-500 flex items-center justify-center backdrop-blur-xl pointer-events-auto active:scale-90 transition-all shadow-[0_0_40px_rgba(239,68,68,0.3)] active:border-red-500 active:bg-red-500/50"
                onTouchStart={(e) => {
                  e.preventDefault();
                  keys.current['m_left'] = true;
                  handleShoot();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  keys.current['m_left'] = false;
                }}
                onTouchCancel={(e) => {
                  e.preventDefault();
                  keys.current['m_left'] = false;
                }}
              >
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-red-400/30 flex items-center justify-center">
                   <Zap size={32} className="md:w-10 md:h-10" />
                </div>
              </button>
            </div>
            
            {/* Weapon Selector (Mobile) */}
            <div className={`absolute left-4 md:left-10 flex flex-col gap-1 md:gap-2 pointer-events-auto z-[60] transition-all ${mobileMode ? 'top-20' : 'top-16'}`}>
              {(['pistol', 'rifle', 'shotgun', 'sniper'] as WeaponType[]).map(weapon => (
                <button
                  key={weapon}
                  onClick={() => {
                    // Sync mag before swap
                    const currentMag = ammoRef.current.mag;
                    setWeaponMags(prev => ({ ...prev, [currentWeapon]: currentMag }));
                    setCurrentWeapon(weapon);
                    setAmmo(prev => ({ ...prev, mag: weaponMags[weapon] }));
                    setIsReloading(false);
                    if (reloadTimeoutRef.current) {
                      clearTimeout(reloadTimeoutRef.current);
                      reloadTimeoutRef.current = null;
                    }
                  }}
                  className={`px-3 md:px-4 py-2 rounded-lg border backdrop-blur-md text-[9px] font-black uppercase tracking-widest transition-all ${currentWeapon === weapon ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-lg scale-105' : 'bg-slate-900/60 border-slate-700 text-white/40'}`}
                >
                  {WEAPONS[weapon].name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Global Damage Indicators Overlays */}
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
           {damageIndicators.map(ind => (
             <div 
              key={ind.id}
              className="absolute top-1/2 left-1/2 w-32 h-1 bg-red-600/50 blur-sm rounded-full origin-left"
              style={{ 
                transform: `translate(-50%, -50%) rotate(${ind.angle}rad) translate(100px, 0)`,
                opacity: ind.opacity 
              }}
             />
           ))}

           {hp < 30 && (
             <div className="absolute inset-0 bg-red-600/5 animate-pulse pointer-events-none z-[45]" />
           )}

           {/* Damage Flash */}
           {Date.now() - lastDamageTaken.current < 100 && (
             <div 
              className="absolute inset-0 pointer-events-none z-50 transition-opacity duration-100" 
              style={{ background: `radial-gradient(circle, transparent 40%, rgba(220, 38, 38, ${0.1 * (1 - (Date.now() - lastDamageTaken.current) / 100)}) 100%)` }}
             />
           )}

           {/* Hit Marker */}
           {Date.now() - hitMarker.time < 120 && (
             <motion.div 
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1.1, opacity: 1 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
             >
                <div className="relative w-8 h-8">
                   <div className={`absolute top-0 left-0 w-3 h-[1.5px] ${hitMarker.killed ? 'bg-red-500 shadow-[0_0_8px_red]' : 'bg-cyan-400 shadow-[0_0_8px_cyan]'} rotate-45 origin-left`} />
                   <div className={`absolute top-0 right-0 w-3 h-[1.5px] ${hitMarker.killed ? 'bg-red-500 shadow-[0_0_8px_red]' : 'bg-cyan-400 shadow-[0_0_8px_cyan]'} -rotate-45 origin-right`} />
                   <div className={`absolute bottom-0 left-0 w-3 h-[1.5px] ${hitMarker.killed ? 'bg-red-500 shadow-[0_0_8px_red]' : 'bg-cyan-400 shadow-[0_0_8px_cyan]'} -rotate-45 origin-left`} />
                   <div className={`absolute bottom-0 right-0 w-3 h-[1.5px] ${hitMarker.killed ? 'bg-red-500 shadow-[0_0_8px_red]' : 'bg-cyan-400 shadow-[0_0_8px_cyan]'} rotate-45 origin-right`} />
                </div>
             </motion.div>
           )}
 
           {/* Crosshair Overlay */}
           {gameState === 'playing' && !(currentWeapon === 'sniper' && player.current.isAds) && (
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                {/* Tactical Brackets */}
                <div className={`relative flex items-center justify-center transition-all duration-300 ${player.current.isAds ? 'scale-50 opacity-40' : 'scale-100 opacity-100'}`}>
                  {/* Center Dot */}
                  <div className="w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_4px_cyan]" />
                  
                  {/* Horizontal */}
                  <div className="absolute w-5 h-[1px] bg-cyan-400/40" />
                  <div className="absolute h-5 w-[1px] bg-cyan-400/40" />

                  {/* Outer Indicators (Tactical Style) */}
                  {!player.current.isAds && (
                    <>
                      <div className="absolute -top-4 w-1.5 h-[1.5px] bg-cyan-500/80" />
                      <div className="absolute -bottom-4 w-1.5 h-[1.5px] bg-cyan-500/80" />
                      <div className="absolute -left-4 h-1.5 w-[1.5px] bg-cyan-500/80" />
                      <div className="absolute -right-4 h-1.5 w-[1.5px] bg-cyan-500/80" />
                    </>
                  )}
                </div>
             </div>
           )}

           {/* Killfeed Overlay */}
           <div className="absolute top-20 md:top-24 right-4 md:right-6 flex flex-col items-end gap-1 md:gap-2 text-white font-mono font-bold text-xs md:text-sm pointer-events-none z-40">
              <AnimatePresence>
                {killfeed.map((kill, i) => (
                  <motion.div 
                    key={kill.id}
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 - i * 0.2 }}
                    exit={{ opacity: 0 }}
                    className="bg-slate-900/60 px-3 py-1 rounded-md border-r-2 border-red-500"
                  >
                    {kill.text}
                  </motion.div>
                ))}
              </AnimatePresence>
           </div>
        </div>

        {/* HUD Elements */}
        {gameState === 'playing' && (
          <>
            {/* Top Stats */}
            <div className={`absolute left-0 right-0 flex justify-between items-start pointer-events-none z-40 px-4 transition-all duration-300 ${mobileMode ? 'top-16 md:top-4 scale-75 origin-top' : 'top-4'}`}>
              <div className="bg-slate-900/80 backdrop-blur-md px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-slate-700 flex items-center gap-2 md:gap-4 shadow-xl">
                <div className="flex items-center gap-2 md:gap-3 pr-1 md:pr-2">
                   <div className="w-8 h-8 md:w-10 md:h-10 rounded flex items-center justify-center shadow-lg shadow-cyan-500/30 bg-gradient-to-br from-cyan-400 to-fuchsia-500">
                      <Zap className="text-slate-950 w-5 h-5 md:w-6 md:h-6" />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[10px] md:text-xs font-black text-white uppercase tracking-tighter italic leading-none">Protocol DOC</span>
                      <span className="text-[8px] md:text-[9px] font-mono text-cyan-400/80 uppercase tracking-widest leading-none mt-1 font-bold">Arena Live</span>
                   </div>
                </div>
                <div className="h-6 md:h-8 w-px bg-slate-700/50" />
                <div className="flex items-center gap-2 md:gap-4 px-1 md:px-2">
                   <div className="flex items-center gap-1 md:gap-2">
                      <Skull size={14} className="text-slate-400 md:w-[18px] md:h-[18px]" />
                      <span className="font-mono text-lg md:text-xl font-black text-white leading-none">{stats.kills}</span>
                   </div>
                   <div className="flex items-center gap-1 md:gap-2">
                      <Shield size={14} className={`md:w-[18px] md:h-[18px] ${hp < 30 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`} />
                      <span className={`font-mono text-lg md:text-xl font-black leading-none ${hp < 30 ? 'text-red-500' : 'text-white'}`}>{Math.round(hp)}%</span>
                   </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                 <div className="bg-slate-900/80 backdrop-blur-md px-2 md:px-4 py-1 md:py-2 rounded-lg border border-slate-700 text-slate-300 text-xs md:text-sm font-mono flex items-center gap-1 md:gap-2 shadow-xl">
                    <Terminal size={12} className="text-cyan-400 animate-pulse md:w-[14px] md:h-[14px]" />
                    <span className="text-[8px] md:text-[10px] tracking-wider uppercase font-bold text-slate-400">System <span className="hidden sm:inline">Integrity:</span> </span>
                    <span className="text-cyan-400 font-bold tracking-tighter">OPTIMAL</span>
                 </div>
              </div>
            </div>

            {/* Weapon & Ammo - Tactically Framed */}
            <div className={`absolute pointer-events-none z-40 transition-all duration-300 ${mobileMode ? 'top-4 right-4 scale-90 origin-top-right' : 'bottom-8 right-8'}`}>
               <div className="relative group">
                 {/* Outer Decoration */}
                 <div className="absolute -inset-1 bg-cyan-500/20 blur-[2px] rounded-2xl" />
                 
                 <div className="relative bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col min-w-[200px]">
                    {/* Header Strip */}
                    <div className="bg-cyan-500/10 border-b border-white/5 py-1.5 px-4 flex justify-between items-center">
                       <span className="text-[9px] font-black text-cyan-400 uppercase tracking-[0.3em]">Combat Module</span>
                       <div className="flex gap-0.5">
                         {[1, 2, 3].map(i => <div key={i} className={`w-1 h-1 rounded-full ${i <= (stats.kills % 3) + 1 ? 'bg-cyan-500' : 'bg-slate-700'}`} />)}
                       </div>
                    </div>

                    <div className="p-4 flex items-center justify-between gap-6">
                       <div className="flex flex-col">
                          <span className="text-lg md:text-2xl font-black text-white tracking-tighter uppercase italic leading-none">{WEAPONS[currentWeapon].name}</span>
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Status: Operational</span>
                       </div>

                       <div className="flex items-baseline gap-1 bg-black/40 px-3 py-1 rounded-lg border border-white/5">
                          <span className={`text-3xl md:text-5xl font-mono font-bold leading-none ${ammo.mag < 5 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                             {isReloading ? '--' : ammo.mag}
                          </span>
                          <span className="text-sm md:text-lg font-mono text-slate-600">/ {ammo.reserve}</span>
                       </div>
                    </div>

                    {/* Ammo Capacity Visualizer (Animated Segments) */}
                    <div className="px-4 pb-4">
                       <div className="flex gap-0.5 h-1.5">
                         {Array.from({ length: 12 }).map((_, i) => (
                           <div 
                             key={i} 
                             className={`flex-1 rounded-sm transition-all duration-300 ${
                               isReloading 
                                 ? 'bg-slate-800 animate-pulse' 
                                 : i / 12 < (ammo.mag / WEAPONS[currentWeapon].magSize) 
                                   ? 'bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.5)]' 
                                   : 'bg-slate-800'
                             }`} 
                           />
                         ))}
                       </div>
                    </div>

                    {isReloading && (
                      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                        <RefreshCcw size={20} className="text-cyan-400 animate-spin" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Reloading Module...</span>
                      </div>
                    )}
                 </div>
               </div>
            </div>

            {/* Health Bar - Tactical Integrity */}
            <div className={`absolute flex flex-col pointer-events-none z-40 transition-all ${mobileMode ? 'top-4 left-1/2 -translate-x-1/2 w-48 scale-90' : 'bottom-8 left-8 w-64'}`}>
               <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur-md px-2 py-1 rounded-t-lg border-t border-x border-cyan-500/30">
                    <Shield size={12} className={hp < 30 ? 'text-red-500 animate-pulse' : 'text-cyan-400'} />
                    <span className="text-white font-black text-[9px] uppercase tracking-widest">Integrity</span>
                 </div>
                 <span className={`font-mono text-xs font-bold ${hp < 30 ? 'text-red-500' : 'text-white'}`}>{Math.round(hp)}%</span>
               </div>
               
               <div className="relative h-4 bg-slate-900/80 rounded-sm border border-slate-700/50 overflow-hidden backdrop-blur-md overflow-hidden">
                  {/* Grid Background in Bar */}
                  <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '10% 100%' }} />
                  
                  <motion.div 
                    animate={{ width: `${hp}%` }}
                    className={`h-full relative overflow-hidden ${hp < 30 ? 'bg-red-500 shadow-[0_0_20px_red]' : 'bg-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.3)]'}`}
                  >
                    {/* Interior Scanline */}
                    <div className="absolute inset-y-0 right-0 w-2 bg-white/40 blur-[2px]" />
                  </motion.div>
               </div>

               {!mobileMode && (
                 <div className="mt-2 flex items-center justify-between bg-black/40 px-2 py-1 rounded border border-white/5">
                   <div className="flex items-center gap-2">
                      <Users size={10} className="text-red-500" />
                      <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Active Hostiles: {enemiesRemaining}</span>
                   </div>
                   <span className="text-[8px] text-cyan-600 font-bold uppercase tracking-tighter items-center hidden md:flex">Scanner Active</span>
                 </div>
               )}
            </div>

            {/* Top Stats HUD (Wave & Protocol) */}
            <div className={`absolute pointer-events-none z-50 flex gap-1 transition-all ${mobileMode ? 'top-4 left-4 scale-90 origin-top-left' : 'top-6 left-6 items-start'}`}>
               <div className="flex flex-col">
                 <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-t-lg border-t border-x border-cyan-500/30">
                   <Target size={12} className="text-cyan-400" />
                   <span className="text-cyan-400 font-bold text-[8px] uppercase tracking-[0.2em] leading-none text-nowrap">Wave</span>
                 </div>
                 <div className="bg-slate-900/40 backdrop-blur-md px-3 py-1 rounded-b-lg border-b border-x border-cyan-500/30 flex items-end gap-1">
                   <span className="text-white font-black text-2xl tracking-tighter leading-none">{wave}</span>
                   <span className="text-slate-500 text-[10px] font-bold mb-0.5">/ 5</span>
                 </div>
               </div>

               <div className="flex flex-col">
                 <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-t-lg border-t border-x border-slate-700">
                    <Zap size={12} className="text-yellow-500" />
                    <span className="text-yellow-500 font-bold text-[8px] uppercase tracking-[0.2em] leading-none text-nowrap">Protocol</span>
                 </div>
                 <div className="bg-slate-900/40 backdrop-blur-md px-3 py-1 rounded-b-lg border-b border-x border-slate-700">
                    <span className="text-white font-black text-xs italic tracking-tighter leading-none uppercase">{difficulty}</span>
                 </div>
               </div>
            </div>

            {/* Top Right Score & Global Stats */}
            <div className={`absolute pointer-events-none z-50 flex flex-col items-end gap-1 transition-all ${mobileMode ? 'top-20 right-4 scale-90 origin-top-right' : 'top-6 right-6'}`}>
               <div className="flex flex-col items-end">
                 <div className="bg-slate-900/60 backdrop-blur-md px-4 py-1 rounded-t-lg border-t border-x border-yellow-500/30">
                    <span className="text-yellow-500 font-bold text-[8px] uppercase tracking-[0.2em] leading-none">Operation Score</span>
                 </div>
                 <div className="bg-slate-900/40 backdrop-blur-md px-4 py-1.5 rounded-b-lg border-b border-x border-yellow-500/30">
                    <span className="text-white font-black text-2xl tracking-tighter leading-none">{score.toLocaleString()}</span>
                 </div>
               </div>

               {!mobileMode && (
                 <div className="flex gap-4 px-3 py-1 bg-slate-950/40 backdrop-blur-sm rounded-lg border border-white/5 text-[8px] font-bold text-slate-400 uppercase tracking-widest shadow-lg">
                    <div className="flex items-center gap-1.5">
                      <Target size={10} className="text-cyan-500/60" />
                      <span>Accuracy: {stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0}%</span>
                    </div>
                    <div className="w-px h-2 bg-white/10" />
                    <div className="flex items-center gap-1.5">
                      <Skull size={10} className="text-red-500/60" />
                      <span>Neutralized: {stats.kills}</span>
                    </div>
                 </div>
               )}
            </div>

            {/* Wave Announcement */}
            {waveMessage && (
               <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 text-center w-full px-4">
                 <motion.div
                   initial={{ opacity: 0, letterSpacing: '1em' }}
                   animate={{ opacity: 1, letterSpacing: '0.1em' }}
                   exit={{ opacity: 0, scale: 1.5 }}
                   transition={{ duration: 0.8, ease: "easeOut" }}
                 >
                   <h2 className="text-[clamp(2rem,10vw,5rem)] font-black text-white italic tracking-tighter drop-shadow-[0_0_30px_rgba(34,211,238,0.4)] leading-none uppercase">
                     {waveMessage}
                   </h2>
                   <div className="h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent w-full mt-4 blur-[1px]" />
                 </motion.div>
                 
                 <motion.p 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: 0.5 }}
                  className="text-cyan-400 font-black tracking-[0.3em] md:tracking-[0.6em] uppercase mt-4 drop-shadow-md text-[10px] md:text-sm"
                 >
                   Arena Reload // Choose An Augment
                 </motion.p>
               </div>
            )}
          </>
        )}

        {/* Start / Dead / Win / Upgrades Overlays */}
        <AnimatePresence>
          {(gameState === 'start' || gameState === 'dead' || gameState === 'win' || gameState === 'upgrades') && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center z-[100]"
            >
              {gameState === 'upgrades' ? (
                <div className="w-full max-w-2xl bg-zinc-900/90 rounded-3xl border border-white/10 p-6 md:p-10 max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 text-left">
                     <div>
                       <h2 className="text-3xl md:text-5xl font-black text-white italic uppercase tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">Command Center</h2>
                       <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-2 bg-cyan-500/10 px-3 py-1 rounded w-fit">Arena Augments</p>
                     </div>
                     <div className="w-full sm:w-auto bg-slate-950 p-1 rounded-2xl border border-white/10 shadow-inner flex shrink-0">
                        <div className="bg-yellow-500 text-slate-950 px-5 py-3 rounded-xl flex items-center gap-3">
                          <Coins size={20} className="shrink-0" />
                          <span className="font-black text-xl leading-none">{tacticalCredits.toLocaleString()}</span>
                        </div>
                     </div>
                   </div>

                   {/* Tabs */}
                   <div className="flex gap-2 mb-8 bg-slate-950/50 p-1 rounded-2xl border border-white/5">
                     <button 
                       onClick={() => {
                         sounds.playUiClick();
                         setUpgradeTab('biological');
                       }}
                       className={`flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${upgradeTab === 'biological' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}
                     >
                       Biological
                     </button>
                     <button 
                       onClick={() => {
                         sounds.playUiClick();
                         setUpgradeTab('weapon');
                       }}
                       className={`flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${upgradeTab === 'weapon' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}
                     >
                       Weapon Lab
                     </button>
                   </div>

                   {upgradeTab === 'biological' ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                       {Object.entries(UPGRADES).map(([key, upgrade]) => {
                         const level = upgradeLevels[key];
                         const isMax = level >= upgrade.maxLevel;
                         const cost = isMax ? 0 : upgrade.costs[level];
                         const canAfford = tacticalCredits >= cost;

                         return (
                           <div key={key} className="bg-slate-950/50 p-5 rounded-2xl border border-white/5 text-left flex flex-col">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-white font-black uppercase text-sm">{upgrade.name}</span>
                                <div className="flex gap-1">
                                  {[...Array(upgrade.maxLevel)].map((_, i) => (
                                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < level ? 'bg-blue-500 shadow-[0_0_5px_#3b82f6]' : 'bg-slate-800'}`} />
                                  ))}
                                </div>
                              </div>
                              <p className="text-slate-500 text-[10px] uppercase font-bold mb-4">{upgrade.description}</p>
                              
                              <button 
                                disabled={isMax || !canAfford}
                                onClick={() => buyUpgrade(key)}
                                className={`mt-auto py-2 rounded-xl flex items-center justify-center gap-2 font-black uppercase text-xs transition-all ${
                                  isMax ? 'bg-slate-800 text-slate-500 cursor-not-allowed' :
                                  canAfford ? 'bg-white text-slate-950 hover:scale-105 active:scale-95' :
                                  'bg-red-500/10 text-red-500 border border-red-500/20'
                                }`}
                              >
                                {isMax ? 'MAXED' : !canAfford ? 'CREDITS NEEDED' : (
                                  <>
                                    <Coins size={12} />
                                    <span>{cost.toLocaleString()}</span>
                                  </>
                                )}
                              </button>
                           </div>
                         );
                       })}
                     </div>
                   ) : (
                     <div className="space-y-6 mb-8">
                        {/* Weapon Selector */}
                        <div className="flex flex-wrap gap-2">
                           {Object.keys(WEAPONS).map((wKey) => {
                             const weapon = WEAPONS[wKey as WeaponType];
                             const isSelected = selectedLabWeapon === wKey;
                             return (
                               <button
                                 key={wKey}
                                 onClick={() => {
                                   sounds.playUiClick();
                                   setSelectedLabWeapon(wKey as WeaponType);
                                 }}
                                 className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all ${isSelected ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-950/50 border-white/5 text-slate-500 hover:border-white/20'}`}
                               >
                                 {weapon.name}
                               </button>
                             );
                           })}
                        </div>

                        {/* Attribute Upgrades */}
                        <div className="grid grid-cols-1 gap-3">
                           {(['damage', 'reload', 'stability'] as const).map((attr) => {
                             const level = weaponUpgradeLevels[selectedLabWeapon][attr];
                             const isMax = level >= MAX_WEAPON_LEVEL;
                             const cost = isMax ? 0 : WEAPON_UPGRADE_COSTS[level];
                             const canAfford = tacticalCredits >= cost;
                             
                             const descriptions = {
                               damage: '+5% Firepower per level',
                               reload: '-4% Reload time per level',
                               stability: '-5% Recoil/Spread per level'
                             };

                             return (
                               <div key={attr} className="bg-slate-950/50 p-5 rounded-2xl border border-white/5 text-left flex items-center justify-between">
                                  <div>
                                    <span className="text-white font-black uppercase text-sm block mb-1">{attr}</span>
                                    <p className="text-slate-500 text-[9px] uppercase font-bold mb-3">{descriptions[attr]}</p>
                                    <div className="flex gap-1">
                                      {[...Array(MAX_WEAPON_LEVEL)].map((_, i) => (
                                        <div key={i} className={`w-3 h-1 rounded-full ${i < level ? 'bg-blue-500 shadow-[0_0_5px_#3b82f6]' : 'bg-slate-800'}`} />
                                      ))}
                                    </div>
                                  </div>

                                  <button
                                    disabled={isMax || !canAfford}
                                    onClick={() => buyWeaponUpgrade(selectedLabWeapon, attr)}
                                    className={`py-2 px-6 rounded-xl flex items-center justify-center gap-2 font-black uppercase text-xs transition-all ${
                                      isMax ? 'bg-slate-800 text-slate-500 cursor-not-allowed' :
                                      canAfford ? 'bg-white text-slate-950 hover:scale-105 active:scale-95' :
                                      'bg-red-500/10 text-red-500 border border-red-500/20'
                                    }`}
                                  >
                                    {isMax ? 'MAX' : !canAfford ? 'CREDITS NEEDED' : (
                                      <>
                                        <Coins size={12} />
                                        <span>{cost.toLocaleString()}</span>
                                      </>
                                    )}
                                  </button>
                               </div>
                             );
                           })}
                        </div>
                     </div>
                   )}

                    <button 
                     onClick={() => {
                       sounds.playUiClick();
                       setMenuView('main');
                       setGameState('start');
                     }}
                     className="flex items-center justify-center gap-2 text-slate-500 hover:text-white transition-colors font-black uppercase text-[10px] tracking-widest w-full py-4 border-t border-white/5 mt-4"
                    >
                     <ChevronLeft size={16} /> Return to Operations
                    </button>
                </div>
              ) : gameState === 'start' ? (
                <MainMenu 
                  initGame={initGame}
                  setGameState={setGameState}
                  menuView={menuView}
                  setMenuView={setMenuView}
                  difficulty={difficulty}
                  setDifficulty={setDifficulty}
                  tacticalCredits={tacticalCredits}
                  lifetimeStats={lifetimeStats}
                  weaponUpgradeLevels={weaponUpgradeLevels}
                  setUpgradeTab={setUpgradeTab}
                  setSelectedLabWeapon={setSelectedLabWeapon}
                />
              ) : (
                <div className={`p-8 md:p-12 rounded-[2.5rem] bg-slate-900/90 border-4 backdrop-blur-2xl ${gameState === 'win' ? 'border-yellow-500 shadow-[0_0_60px_rgba(234,179,8,0.2)]' : 'border-red-600 shadow-[0_0_60px_rgba(220,38,38,0.2)]'} w-full max-w-2xl relative overflow-hidden`}>
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                    
                    <div className="relative z-10 flex flex-col items-center">
                      <div className={`mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/50 border border-white/10 text-[10px] font-black uppercase tracking-[0.3em]`} style={{ color: DIFFICULTIES[difficulty].color }}>
                        <Target size={14} />
                        {DIFFICULTIES[difficulty].name} PROTOCOL COMPLETE
                      </div>

                      <h2 className={`text-6xl md:text-8xl font-black italic tracking-tighter mb-4 text-center ${gameState === 'win' ? 'text-yellow-500 text-shadow-[0_0_20px_rgba(234,179,8,0.5)]' : 'text-red-600 text-shadow-[0_0_20px_rgba(220,38,38,0.5)]'}`}>
                         {gameState === 'win' ? 'SUCCESS' : 'SYSTEM FAILURE'}
                      </h2>

                      <p className="text-white/60 font-medium uppercase tracking-[0.2em] mb-12 text-center text-[10px] md:text-sm max-w-md mx-auto leading-relaxed">
                        {gameState === 'win' 
                          ? 'Strategic objective achieved. Sector successfully neutralized and secured for secondary extraction.' 
                          : 'Critical integrity loss detected. Mission protocol aborted. Biological signal terminated in active sector.'
                        }
                      </p>
                      
                      <div className="w-full bg-black/40 p-1 rounded-[2rem] border border-white/10 shadow-2xl mb-8 relative group overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-transparent opacity-50" />
                          
                          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center px-8 py-6 gap-6">
                            <div className="flex flex-col items-center md:items-start">
                               <span className="text-yellow-500 text-[10px] font-black mb-1 uppercase tracking-[0.4em]">Resource Salvage</span>
                               <motion.div className="flex items-center gap-3">
                                  <Coins className="text-yellow-500" size={32} />
                                  <span className="text-5xl md:text-6xl font-black text-white tabular-nums tracking-tighter">
                                    +{earnedCredits.toLocaleString()}
                                  </span>
                               </motion.div>
                            </div>
                            <div className="text-center md:text-right border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-8">
                               <span className="block text-white/30 text-[9px] uppercase font-bold mb-1 tracking-widest leading-none">Account Balance</span>
                               <span className="text-2xl font-black text-white/60 tabular-nums leading-none tracking-tight">{tacticalCredits.toLocaleString()}</span>
                            </div>
                          </div>
                      </div>

                      {/* Performance Data Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full mb-12">
                         {[
                           { label: 'Score', value: score.toLocaleString(), color: 'text-white' },
                           { label: 'Max Wave', value: wave, color: 'text-cyan-400' },
                           { label: 'Kills', value: stats.kills, color: 'text-red-500' },
                           { label: 'Accuracy', value: `${stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0}%`, color: 'text-green-500' }
                         ].map((stat, i) => (
                           <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col items-center gap-1 group hover:border-white/20 transition-colors">
                              <span className="text-[8px] text-white/30 uppercase font-bold tracking-widest">{stat.label}</span>
                              <span className={`text-xl font-black ${stat.color} tracking-tight`}>{stat.value}</span>
                           </div>
                         ))}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4 w-full">
                        <button 
                          onClick={initGame}
                          className={`flex-1 py-5 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group relative overflow-hidden ${gameState === 'win' ? 'bg-yellow-500 text-slate-950 font-black' : 'bg-red-600 text-white font-black'}`}
                        >
                          <Target className="group-hover:rotate-12 transition-transform" />
                          <span className="text-xl uppercase tracking-tighter italic">Re-Deploy Target</span>
                        </button>
                        <button 
                          onClick={() => {
                            sounds.playUiClick();
                            setMenuView('main');
                            setGameState('start');
                          }}
                          className="px-10 py-5 bg-white/5 text-white/60 rounded-2xl border border-white/10 hover:bg-white/10 hover:text-white transition-all font-black uppercase text-xs tracking-widest"
                        >
                          Missions
                        </button>
                      </div>
                    </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Responsive Info/Controls */}
      {gameState === 'start' && !mobileMode && (
        <div className="mt-8 flex gap-8 items-center text-slate-500 text-sm font-medium">
           <div className="flex items-center gap-2">
              <Move size={16} /> w/a/s/d to move
           </div>
           <div className="flex items-center gap-2">
              <Zap size={16} /> 1-4 switch weapon
           </div>
        </div>
      )}
    </div>
  );
}
