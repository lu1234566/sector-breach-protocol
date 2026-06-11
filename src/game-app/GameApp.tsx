// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Target, Coins, ChevronLeft } from "lucide-react";
import { GameScene } from "./components/game/GameScene";
import { MainMenu } from "./components/menu/MainMenu";

import {
  WeaponType,
  DifficultyKey,
  UPGRADES,
  WEAPONS,
  CELL_SIZE,
  TICK_RATE,
  WEAPON_UPGRADE_COSTS,
  MAX_WEAPON_LEVEL,
  DIFFICULTIES,
  FINAL_WAVE,
} from "./game/constants";
import { getArenaById, ARENAS, DEFAULT_ARENA_ID, type ArenaDef } from "./data/arenas";
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
  WeaponUpgradeLevels,
  ObjectiveRuntime,
  WallDecal,
} from "./game/types";
import { SniperScope } from "./components/hud/SniperScope";
import { getWaveObjective, createRuntime } from "./game/objectives";
import { GameHUD } from "./components/hud/GameHUD";
import { DeployScreen } from "./components/hud/DeployScreen";
import { PauseMenu } from "./components/hud/PauseMenu";
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
  saveLifetimeStats,
} from "./game/persistence";
import { clamp } from "./game/helpers";
import { sounds } from "./game/SoundEngine";
import { useInputSystem } from "./game/systems/useInputSystem";
import { useWaveSystem } from "./game/systems/useWaveSystem";
import { tickEnemyAI } from "./game/systems/enemyAI";
import { createHandleShoot, createReload } from "./game/systems/combat";
import { tickPickups } from "./game/systems/pickups";
import splashMissionComplete from "@/assets/splash_mission_complete.jpg";
import splashMissionFailed from "@/assets/splash_mission_failed.jpg";

const PLAYER_RADIUS = 30;
const DEBUG_MODE =
  typeof window !== "undefined" &&
  (new URLSearchParams(window.location.search).get("debug") === "1" ||
    (typeof localStorage !== "undefined" && localStorage.getItem("sbp_debug") === "1"));
const DEBUG_SAFE_MODE = false;

const isBulletBlocking = (cell: number) => cell === 1 || cell === 2 || cell === 3;
const isMovementBlockingCell = (cell: number) => cell === 1 || cell === 2 || cell === 3;

const WAVE_1_DAMAGE_MULT = 0.5;
const INITIAL_GRACE_PERIOD = 5000;

const checkLineOfSight = (x1: number, y1: number, x2: number, y2: number, mapData: number[][]) =>
  checkLineOfSightInfo(x1, y1, x2, y2, mapData).hasLOS;

const checkLineOfSightInfo = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  mapData: number[][],
) => {
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

    if (ty < 0 || ty >= mapData.length || tx < 0 || tx >= mapData[0].length)
      return { hasLOS: false, blockedBy: -1 };
    const cell = mapData[ty][tx];
    if (isBulletBlocking(cell)) return { hasLOS: false, blockedBy: cell };
  }
  return { hasLOS: true };
};

const getArenaPlayerStart = (arena: ArenaDef) => ({ ...arena.playerSpawn });

export default function App() {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const pointerLockCooldownRef = useRef(0);
  const [gameState, setGameState] = useState<
    "start" | "deploy" | "playing" | "paused" | "dead" | "win" | "upgrades"
  >("start");
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

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
  const [waveMessage, setWaveMessage] = useState("");
  const objectiveRef = useRef<ObjectiveRuntime | null>(null);
  const [objectiveSnapshot, setObjectiveSnapshot] = useState<ObjectiveRuntime | null>(null);
  const objectiveLastSyncRef = useRef(0);
  const [stats, setStats] = useState<RunStats>({ kills: 0, deaths: 0, shotsFired: 0, shotsHit: 0 });
  const [lifetimeStats, setLifetimeStats] = useState<LifetimeStats>({
    totalKills: 0,
    totalDeaths: 0,
    totalCredits: 0,
    bestWave: 0,
    totalWins: 0,
    totalGames: 0,
  });
  // Synchronous mirrors so end-of-run credit math never reads a stale closure
  // (the killing blow and the win check can land in the same tick).
  const statsRef = useRef<RunStats>({ kills: 0, deaths: 0, shotsFired: 0, shotsHit: 0 });
  const scoreRef = useRef(0);
  const lifetimeStatsRef = useRef<LifetimeStats>(lifetimeStats);
  const isRunEndingRef = useRef(false);

  const setStatsSynced = (fn: (prev: RunStats) => RunStats) => {
    statsRef.current = fn(statsRef.current);
    setStats(statsRef.current);
  };
  const setScoreSynced = (fn: (prev: number) => number) => {
    scoreRef.current = fn(scoreRef.current);
    setScore(scoreRef.current);
  };

  // --- Meta Progression State ---
  const [tacticalCredits, setTacticalCredits] = useState(0);
  const [upgradeLevels, setUpgradeLevels] = useState<Record<string, number>>({
    armorPlating: 0,
    ammoReserve: 0,
    quickReload: 0,
    scavenger: 0,
  });
  const [weaponUpgradeLevels, setWeaponUpgradeLevels] = useState<
    Record<WeaponType, { damage: number; reload: number; stability: number }>
  >({
    pistol: { damage: 0, reload: 0, stability: 0 },
    rifle: { damage: 0, reload: 0, stability: 0 },
    shotgun: { damage: 0, reload: 0, stability: 0 },
    sniper: { damage: 0, reload: 0, stability: 0 },
  });
  const [weaponMags, setWeaponMags] = useState<Record<WeaponType, number>>({
    pistol: WEAPONS.pistol.magSize,
    rifle: WEAPONS.rifle.magSize,
    shotgun: WEAPONS.shotgun.magSize,
    sniper: WEAPONS.sniper.magSize,
  });
  const [earnedCredits, setEarnedCredits] = useState(0);
  const [difficulty, setDifficulty] = useState<DifficultyKey>("normal");
  const [upgradeTab, setUpgradeTab] = useState<"biological" | "weapon">("biological");
  const [selectedLabWeapon, setSelectedLabWeapon] = useState<WeaponType>("pistol");
  const [menuView, setMenuView] = useState<
    "main" | "armory" | "difficulty" | "profile" | "arena" | "settings"
  >("main");
  const [selectedArenaId, setSelectedArenaId] = useState<string>(DEFAULT_ARENA_ID);
  const currentArenaRef = useRef<ArenaDef>(getArenaById(DEFAULT_ARENA_ID));

  // Load Meta Data
  useEffect(() => {
    const credits = loadCredits();
    if (credits !== null) setTacticalCredits(credits);
    const upgrades = loadUpgrades();
    if (upgrades) setUpgradeLevels((prev) => ({ ...prev, ...upgrades }));
    const weaponUpgrades = loadWeaponUpgrades();
    if (weaponUpgrades) setWeaponUpgradeLevels((prev) => ({ ...prev, ...weaponUpgrades }));
    const diff = loadDifficulty();
    if (diff) setDifficulty(diff);
    const ls = loadLifetimeStats();
    if (ls) {
      setLifetimeStats((prev) => {
        const next = { ...prev, ...ls };
        lifetimeStatsRef.current = next;
        return next;
      });
    }
    const arenaId = loadArena();
    if (arenaId) {
      setSelectedArenaId(arenaId);
      currentArenaRef.current = getArenaById(arenaId);
    }
  }, []);

  useEffect(() => {
    currentArenaRef.current = getArenaById(selectedArenaId);
    saveArena(selectedArenaId);
  }, [selectedArenaId]);

  const saveMeta = (
    credits: number,
    upgrades: UpgradeLevels | Record<string, number>,
    weaponUpgrades?: WeaponUpgradeLevels,
    lStats?: LifetimeStats,
  ) => {
    saveCredits(credits);
    saveUpgrades(upgrades);
    if (weaponUpgrades) saveWeaponUpgrades(weaponUpgrades);
    if (lStats) saveLifetimeStats(lStats);
  };

  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>("rifle");
  const [ammo, setAmmo] = useState({ mag: WEAPONS.rifle.magSize, reserve: 120 });
  const ammoRef = useRef(ammo);
  const [hp, setHp] = useState(100);
  const [isReloading, setIsReloading] = useState(false);
  const isReloadingRef = useRef(false);
  const [hitMarker, setHitMarker] = useState({ time: 0, killed: false });
  const [bossHp, setBossHp] = useState<{ current: number; max: number } | null>(null);
  const pickups = useRef<Pickup[]>([]);
  const lastDamageTaken = useRef(0);
  const gameStartTime = useRef(0);
  const screenShake = useRef(0);

  // Weapon switcher toast
  const [weaponSwitcherUntil, setWeaponSwitcherUntil] = useState(0);
  const [, setSwitcherTick] = useState(0);
  useEffect(() => {
    if (weaponSwitcherUntil === 0) return;
    const t = window.setTimeout(() => setSwitcherTick((n) => n + 1), 2200);
    return () => clearTimeout(t);
  }, [weaponSwitcherUntil]);

  useEffect(() => {
    ammoRef.current = ammo;
  }, [ammo]);

  // Soundtrack: menu theme on menus, combat loop in-game, boss theme from
  // the Titan wave onward. The tracks ship in /public/audio but were never
  // wired up.
  useEffect(() => {
    if (gameState === "start" || gameState === "upgrades") {
      sounds.playMusic("menu_theme");
    } else if (gameState === "playing" || gameState === "paused" || gameState === "deploy") {
      sounds.playMusic(wave >= 5 ? "boss_theme" : "combat_loop");
    } else {
      sounds.stopMusic();
    }
  }, [gameState, wave]);

  // Game Engine Refs
  const safeStart = getArenaPlayerStart(currentArenaRef.current);
  const player = useRef<Player>({
    x: safeStart.x,
    y: safeStart.y,
    angle: safeStart.angle,
    velX: 0,
    velY: 0,
    rotVel: 0,
    pitch: 0,
    radius: 16,
    isAds: false,
    adsProgress: 0,
  });

  const [killfeed, setKillfeed] = useState<KillfeedItem[]>([]);
  const [damageIndicators, setDamageIndicators] = useState<DamageIndicator[]>([]);
  const nextKillfeedId = useRef(0);
  const nextDamageId = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const enemies = useRef<Enemy[]>([]);
  const particles = useRef<Particle[]>([]);
  const nextParticleId = useRef(0);
  const navGridRef = useRef<number[][]>([]);
  const mapData = useRef(currentArenaRef.current.mapData.map((row) => [...row]));
  const [mapDataState, setMapDataState] = useState(
    currentArenaRef.current.mapData.map((row) => [...row]),
  );
  const getSafePlayerStart = () => getArenaPlayerStart(currentArenaRef.current);
  const lastShotTime = useRef(0);
  const lastEnemyShotTimeGlobal = useRef(0);
  const recoilOffset = useRef(0);
  const lastDamageSource = useRef<any>(null);

  const [enemiesState, setEnemiesState] = useState<Enemy[]>([]);
  const renderTick = useRef(0);

  const initGame = () => {
    gameStartTime.current = Date.now();
    isRunEndingRef.current = false;
    setGameState("deploy");
    setCurrentWeapon("pistol");
    const maxHp = 100 + upgradeLevels.armorPlating * 5;
    setHp(maxHp);
    setStats({ kills: 0, deaths: 0, shotsFired: 0, shotsHit: 0 });

    const initialReserve = 120 + upgradeLevels.ammoReserve * 20;
    const initialAmmo = { mag: WEAPONS.pistol.magSize, reserve: initialReserve };
    setAmmo(initialAmmo);
    ammoRef.current = initialAmmo;
    statsRef.current = { kills: 0, deaths: 0, shotsFired: 0, shotsHit: 0 };
    scoreRef.current = 0;
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
    setIsReloading(false);
    isReloadingRef.current = false;
    setEnemiesRemaining(0);
    setBossHp(null);
    setWaveMessage("");
    objectiveRef.current = null;
    setObjectiveSnapshot(null);
    setWeaponMags({
      pistol: WEAPONS.pistol.magSize,
      rifle: WEAPONS.rifle.magSize,
      shotgun: WEAPONS.shotgun.magSize,
      sniper: WEAPONS.sniper.magSize,
    });
    pickups.current = [];
    const s = getSafePlayerStart();
    player.current = {
      x: s.x,
      y: s.y,
      angle: s.angle,
      velX: 0,
      velY: 0,
      rotVel: 0,
      pitch: 0,
      radius: 16,
      isAds: false,
      adsProgress: 0,
    };
    enemies.current = [];
    setEnemiesState([]);
    particles.current = [];
    tracers.current = [];
    decals.current = [];
    setDamageIndicators([]);
    setHitMarker({ time: 0, killed: false });
    recoilOffset.current = 0;
    screenShake.current = 0;
    lastShotTime.current = 0;
    lastEnemyShotTimeGlobal.current = 0;
    lastDamageTaken.current = 0;
    const arenaMap = currentArenaRef.current.mapData;
    navGridRef.current = arenaMap.map((row) => row.map(() => 999));
    graveyard.current = [];
    setKillfeed([]);
    keys.current = {};
    const newMap = arenaMap.map((row) => [...row]);
    mapData.current = newMap;
    setMapDataState(newMap.map((row) => [...row]));
    sounds.init();
  };

  const startDeployedMatch = () => {
    // Grace period counts from when gameplay actually starts, not from the
    // moment the deploy screen appeared.
    gameStartTime.current = Date.now();
    setGameState("playing");
    spawnWave(1);
    // Request pointer lock on next tick (after state flush)
    setTimeout(() => requestPointerLockSafe(), 50);
  };

  useEffect(() => {
    const updateNav = () => {
      if (gameStateRef.current !== "playing") return;
      const activeMap = mapData.current;
      const rows = activeMap.length;
      const cols = activeMap[0].length;
      const distMap = activeMap.map((row) => row.map(() => 999));
      const px = Math.floor(player.current.x / CELL_SIZE);
      const py = Math.floor(player.current.y / CELL_SIZE);
      if (px < 0 || px >= cols || py < 0 || py >= rows) return;
      const queue: [number, number, number][] = [[px, py, 0]];
      distMap[py][px] = 0;
      let head = 0;
      while (head < queue.length) {
        const [x, y, d] = queue[head++];
        const neighbors = [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ];
        for (const [dx, dy] of neighbors) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
            if (activeMap[ny][nx] === 0 || activeMap[ny][nx] === 2) {
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
  const decals = useRef<WallDecal[]>([]);
  const nextDecalId = useRef(0);

  const { spawnWave } = useWaveSystem({
    waveRef,
    isWaveTransitionRef,
    isSpawningRef,
    spawnIntervalRef,
    waveTransitionTimeoutRef,
    bossSpawnTimeoutRef,
    objectiveRef,
    currentArenaRef,
    gameStateRef,
    setObjectiveSnapshot,
    setWaveMessage,
    spawnEnemies: (...args) => spawnEnemies(...args),
  });

  const pickSpawnPosition = (currentWave: number): { x: number; y: number } | null => {
    const activeMap = mapData.current;
    const minDist = currentWave === 1 ? 600 : 500;

    // Prefer the arena's hand-placed spawn points when one is far enough away
    // (and, on wave 1, out of sight).
    const candidates = currentArenaRef.current.spawnPoints.filter((sp) => {
      const mapX = Math.floor(sp.x / CELL_SIZE);
      const mapY = Math.floor(sp.y / CELL_SIZE);
      if (activeMap[mapY]?.[mapX] !== 0) return false;
      if (Math.hypot(sp.x - player.current.x, sp.y - player.current.y) <= minDist) return false;
      if (
        currentWave === 1 &&
        checkLineOfSight(sp.x, sp.y, player.current.x, player.current.y, activeMap)
      )
        return false;
      return true;
    });
    if (candidates.length > 0) {
      const sp = candidates[Math.floor(Math.random() * candidates.length)];
      // Jitter so simultaneous spawns at the same point don't stack exactly.
      return {
        x: sp.x + (Math.random() - 0.5) * CELL_SIZE * 0.5,
        y: sp.y + (Math.random() - 0.5) * CELL_SIZE * 0.5,
      };
    }

    // Fallback: random free cell sampling (relaxes LOS rule after many tries).
    for (let attempts = 0; attempts < 100; attempts++) {
      const rx = Math.random() * (activeMap[0].length * CELL_SIZE);
      const ry = Math.random() * (activeMap.length * CELL_SIZE);
      const mapX = Math.floor(rx / CELL_SIZE);
      const mapY = Math.floor(ry / CELL_SIZE);
      if (activeMap[mapY]?.[mapX] !== 0) continue;
      if (Math.hypot(rx - player.current.x, ry - player.current.y) <= minDist) continue;
      if (
        currentWave === 1 &&
        attempts < 80 &&
        checkLineOfSight(rx, ry, player.current.x, player.current.y, activeMap)
      )
        continue;
      return { x: rx, y: ry };
    }
    return null;
  };

  const spawnEnemies = (count: number, currentWave: number = 1, isBoss: boolean = false) => {
    const types: ("rusher" | "rifleman" | "sniper")[] = ["rusher", "rifleman", "sniper"];
    for (let i = 0; i < count; i++) {
      const pos = pickSpawnPosition(currentWave);
      if (!pos) break;
      const rx = pos.x;
      const ry = pos.y;
      {
        let type: "rusher" | "rifleman" | "sniper" = "rifleman";
        if (isBoss) type = "rifleman";
        else if (currentWave === 1) type = Math.random() > 0.4 ? "rifleman" : "rusher";
        else type = types[Math.floor(Math.random() * types.length)];
        const diffMult = DIFFICULTIES[difficulty].hpMult;
        const hpBuff = 1 + (currentWave - 1) * 0.15;
        const speedBuff = 1 + (currentWave - 1) * 0.04;
        const finalHp =
          (type === "rusher" ? 60 : type === "rifleman" ? 100 : 80) *
          hpBuff *
          (isBoss ? 20 : 1) *
          diffMult;
        const newEnemy = {
          id: Math.random(),
          x: rx,
          y: ry,
          type,
          isBoss,
          hp: finalHp,
          maxHp: finalHp,
          // lastShot must stay in the past — renderers derive the attack pose
          // from it. The initial stagger lives in nextShotAt instead.
          lastShot: 0,
          nextShotAt: Date.now() + Math.random() * 2000,
          speed:
            (type === "rusher" ? 3.5 : type === "rifleman" ? 2 : 1.5) *
            speedBuff *
            (isBoss ? 0.7 : 1),
          color: isBoss
            ? "#f43f5e"
            : type === "rusher"
              ? "#f87171"
              : type === "rifleman"
                ? "#fbbf24"
                : "#38bdf8",
          stuckFrames: 0,
          lastX: rx,
          lastY: ry,
          targetAngle: 0,
          spawnTime: Date.now(),
        };
        if (isBoss) setBossHp({ current: finalHp, max: finalHp });
        enemies.current.push(newEnemy);
      }
    }
    setEnemiesState([...enemies.current]);
    setEnemiesRemaining(enemies.current.filter((e) => !e.dead).length);
  };

  // Debug-only: spawn one of each enemy type next to the player so each model
  // (rusher / rifleman / sniper / titan) can be inspected individually without
  // depending on wave randomness. Activated via ?debug=1 or localStorage.
  const spawnDebugEnemy = (type: "rusher" | "rifleman" | "sniper" | "titan") => {
    const baseHp =
      type === "rusher" ? 60 : type === "rifleman" ? 100 : type === "sniper" ? 80 : 400;
    const speed = type === "rusher" ? 3.5 : type === "rifleman" ? 2 : type === "sniper" ? 1.5 : 1.2;
    const color =
      type === "rusher"
        ? "#f87171"
        : type === "rifleman"
          ? "#fbbf24"
          : type === "sniper"
            ? "#38bdf8"
            : "#0ea5e9";
    const offX = Math.cos(player.current.angle) * CELL_SIZE * 3;
    const offY = Math.sin(player.current.angle) * CELL_SIZE * 3;
    enemies.current.push({
      id: Math.random(),
      x: player.current.x + offX,
      y: player.current.y + offY,
      type,
      isBoss: false,
      hp: baseHp,
      maxHp: baseHp,
      lastShot: 0,
      speed,
      color,
      stuckFrames: 0,
      lastX: player.current.x + offX,
      lastY: player.current.y + offY,
      targetAngle: 0,
      spawnTime: Date.now(),
    } as any);
    setEnemiesState([...enemies.current]);
    setEnemiesRemaining(enemies.current.length);
    console.log("[DEBUG] spawned", type);
  };

  useEffect(() => {
    if (!DEBUG_MODE) return;
    const onKey = (e: KeyboardEvent) => {
      if (gameStateRef.current !== "playing") return;
      if (e.key === "1") spawnDebugEnemy("rusher");
      else if (e.key === "2") spawnDebugEnemy("rifleman");
      else if (e.key === "3") spawnDebugEnemy("sniper");
      else if (e.key === "4") spawnDebugEnemy("titan");
      else if (e.key === "5") {
        enemies.current = [];
        setEnemiesState([]);
        setEnemiesRemaining(0);
        console.log("[DEBUG] cleared enemies");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const graveyard = useRef<{ x: number; y: number; color: string; type: string }[]>([]);

  /**
   * Single end-of-run path for win, death and objective failure. Awards
   * credits, records lifetime stats, stops every timer and releases input.
   */
  const endRun = (won: boolean, message?: string) => {
    if (isRunEndingRef.current) return;
    isRunEndingRef.current = true;

    if (message) {
      setKillfeed((prev) => [{ id: nextKillfeedId.current++, text: message }, ...prev].slice(0, 5));
    }

    const diffMult = DIFFICULTIES[difficulty].creditMult;
    const kills = statsRef.current.kills;
    const runScore = scoreRef.current;
    const finalCredits = won
      ? Math.floor((kills * 15 + waveRef.current * 100 + runScore / 5 + 1500) * diffMult)
      : Math.floor((kills * 10 + waveRef.current * 50 + runScore / 10) * diffMult);
    setEarnedCredits(finalCredits);

    const prevL = lifetimeStatsRef.current;
    const nextLStats = {
      ...prevL,
      totalKills: prevL.totalKills + kills,
      bestWave: Math.max(prevL.bestWave, waveRef.current),
      totalWins: prevL.totalWins + (won ? 1 : 0),
      totalDeaths: prevL.totalDeaths + (won ? 0 : 1),
      totalGames: prevL.totalGames + 1,
      totalCredits: prevL.totalCredits + finalCredits,
    };
    lifetimeStatsRef.current = nextLStats;
    setLifetimeStats(nextLStats);
    setTacticalCredits((prev) => {
      const total = prev + finalCredits;
      saveMeta(total, upgradeLevels, weaponUpgradeLevels, nextLStats);
      return total;
    });

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
    isReloadingRef.current = false;
    setWaveMessage("");
    isWaveTransitionRef.current = false;
    isSpawningRef.current = false;
    keys.current = {};
    if (document.pointerLockElement) document.exitPointerLock();
    setGameState(won ? "win" : "dead");
  };

  const combatDeps: any = {
    gameStateRef,
    isReloadingRef,
    ammoRef,
    lastShotTime,
    player,
    enemies,
    mapData,
    particles,
    pickups,
    graveyard,
    tracers,
    nextTracerId,
    decals,
    nextDecalId,
    recoilOffset,
    screenShake,
    objectiveRef,
    reloadTimeoutRef,
    nextKillfeedId,
    currentWeapon,
    weaponUpgradeLevels,
    upgradeLevels,
    setAmmo,
    setStats: setStatsSynced,
    setMapDataState,
    setBossHp,
    setHitMarker,
    setScore: setScoreSynced,
    setKillfeed,
    setIsReloading,
    setWeaponMags,
    checkLineOfSight,
    spawnParticles: (x: number, y: number, t: any) => spawnParticles(x, y, t),
  };
  const reload = createReload(combatDeps);
  combatDeps.reload = reload;
  const handleShoot = createHandleShoot(combatDeps);

  const spawnParticles = (x: number, y: number, type: "blood" | "explosion" | "shell") => {
    const count = type === "explosion" ? 20 : 5;
    for (let i = 0; i < count; i++) {
      particles.current.push({
        id: nextParticleId.current++,
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0,
        color: type === "blood" ? "#ef4444" : type === "shell" ? "#eab308" : "#fb923c",
        size: Math.random() * 4 + 2,
      });
    }
  };

  const update = () => {
    if (gameStateRef.current !== "playing") return;

    // Player Movement
    let dx = 0;
    let dy = 0;
    const isW = keys.current["w"];
    const isS = keys.current["s"];
    const isA = keys.current["a"];
    const isD = keys.current["d"];
    const isShift = keys.current["shift"];

    if (isW) {
      dx += Math.cos(player.current.angle);
      dy += Math.sin(player.current.angle);
    }
    if (isS) {
      dx -= Math.cos(player.current.angle);
      dy -= Math.sin(player.current.angle);
    }
    if (isA) {
      dx += Math.sin(player.current.angle);
      dy -= Math.cos(player.current.angle);
    }
    if (isD) {
      dx -= Math.sin(player.current.angle);
      dy += Math.cos(player.current.angle);
    }

    // ADS Hold (Right click or C)
    player.current.isAds = keys.current["c"] || keys.current["m_right"];
    if (player.current.isAds) {
      player.current.adsProgress = Math.min(1, player.current.adsProgress + 0.1);
    } else {
      player.current.adsProgress = Math.max(0, player.current.adsProgress - 0.1);
    }

    const moveSpeed = (isShift ? 6 : 4) * (1 - player.current.adsProgress * 0.5);
    const nx = player.current.x + dx * moveSpeed;
    const ny = player.current.y + dy * moveSpeed;

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
        if (ty < 0 || ty >= mapData.current.length || tx < 0 || tx >= mapData.current[0].length)
          return true;
        const cell = mapData.current[ty][tx];
        if (isMovementBlockingCell(cell)) {
          if (cell === 2) {
            mapData.current[ty][tx] = 0;
            setMapDataState([...mapData.current.map((row) => [...row])]);
            sounds.playReload();
          }
          return true;
        }
      }
      return false;
    };

    if (!checkCollision(nx, player.current.y)) player.current.x = nx;
    if (!checkCollision(player.current.x, ny)) player.current.y = ny;

    tickPickups({
      pickups,
      player,
      upgradeLevels,
      nextKillfeedId,
      setHp,
      setAmmo,
      setKillfeed,
    });

    recoilOffset.current *= 0.85;
    screenShake.current *= 0.9;

    if (keys.current["m_left"] && WEAPONS[currentWeapon].isAuto) handleShoot();

    // Enemy AI / objectives
    const now = Date.now();
    // Keep corpses around briefly so the death animations can play.
    enemies.current = enemies.current.filter((e) => !e.dead || now - (e.diedAt ?? 0) < 700);
    const aliveEnemies = enemies.current.filter((e) => !e.dead);

    const obj = objectiveRef.current;
    if (obj && obj.status === "active" && !isWaveTransitionRef.current) {
      const dtMs = TICK_RATE;
      const px = player.current.x;
      const py = player.current.y;
      if (obj.zone) {
        const dz = Math.hypot(px - obj.zone.x, py - obj.zone.y);
        obj.inZone = dz <= obj.zone.radius;
      }
      if (obj.kind === "hack" && obj.zone) {
        if (obj.inZone) obj.timer = Math.max(0, obj.timer - dtMs);
        obj.progress = obj.timer === 0 ? 1 : 1 - obj.timer / 12000;
        if (obj.timer <= 0) obj.status = "complete";
      } else if (obj.kind === "defend" && obj.zone) {
        const drainRadius = obj.zone.radius * 2.4;
        let drainers = 0;
        for (const e of aliveEnemies)
          if (Math.hypot(e.x - obj.zone.x, e.y - obj.zone.y) < drainRadius) drainers++;
        const drain = drainers * 18 * (dtMs / 1000);
        obj.coreHp = Math.max(0, (obj.coreHp ?? 0) - drain);
        obj.timer = Math.max(0, obj.timer - dtMs);
        obj.progress = 1 - obj.timer / 30000;
        if ((obj.coreHp ?? 0) <= 0) {
          obj.status = "failed";
          endRun(false, "CORE LOST · MISSION FAILED");
        } else if (obj.timer <= 0) obj.status = "complete";
      } else if (obj.kind === "extract" && obj.zone) {
        if (!obj.extractActive) {
          if (obj.killCount >= (obj.killTarget ?? 0)) {
            obj.extractActive = true;
            obj.timer = 25000;
            setKillfeed((prev) =>
              [{ id: nextKillfeedId.current++, text: "EXTRACT ZONE ACTIVE" }, ...prev].slice(0, 5),
            );
          }
          obj.progress = Math.min(1, obj.killCount / Math.max(1, obj.killTarget ?? 1)) * 0.5;
        } else {
          obj.timer = Math.max(0, obj.timer - dtMs);
          obj.progress = 0.5 + 0.5 * (1 - obj.timer / 25000);
          if (obj.inZone) obj.status = "complete";
          else if (obj.timer <= 0) {
            obj.status = "failed";
            endRun(false, "EXTRACT FAILED · MISSION ABORT");
          }
        }
      }
      if (now - objectiveLastSyncRef.current > 200) {
        objectiveLastSyncRef.current = now;
        setObjectiveSnapshot({ ...obj });
      }
    }

    // Wave Management
    const objCompleteForWave = (() => {
      const o = objectiveRef.current;
      if (!o) return aliveEnemies.length === 0;
      if (o.kind === "eliminate") return aliveEnemies.length === 0;
      return o.status === "complete";
    })();
    if (objCompleteForWave && !isSpawningRef.current && !isWaveTransitionRef.current) {
      if (waveRef.current >= FINAL_WAVE) {
        endRun(true);
      } else {
        const nextWave = waveRef.current + 1;
        setWave(nextWave);
        spawnWave(nextWave);
      }
    }

    tickEnemyAI({
      now,
      gameStartTime,
      enemies,
      player,
      mapData,
      navGridRef,
      setMapDataState,
      lastDamageTaken,
      lastDamageSource,
      lastEnemyShotTimeGlobal,
      tracers,
      nextTracerId,
      nextDamageId,
      screenShake,
      waveRef,
      gameStateRef,
      isRunEndingRef,
      difficulty,
      setHp,
      setDamageIndicators,
      endRun,
      checkLineOfSightInfo,
      spawnParticles,
      WAVE_1_DAMAGE_MULT,
      INITIAL_GRACE_PERIOD,
      DEBUG_SAFE_MODE,
    });

    renderTick.current++;
    if (renderTick.current % 2 === 0) {
      setEnemiesState([...enemies.current]);
      setEnemiesRemaining(aliveEnemies.length);
      setDamageIndicators((prev) =>
        prev.map((ind) => ({ ...ind, opacity: ind.opacity - 0.02 })).filter((i) => i.opacity > 0),
      );
    }

    tracers.current.forEach((t) => (t.alpha -= 0.05));
    tracers.current = tracers.current.filter((t) => t.alpha > 0);

    const decalNow = Date.now();
    decals.current = decals.current.filter((d) => decalNow - d.born < 6000);
    particles.current.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
    });
    particles.current = particles.current.filter((p) => p.life > 0);
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
      sounds.playPickup("health");
    } else sounds.playError();
  };

  const buyWeaponUpgrade = (weapon: WeaponType, attribute: "damage" | "reload" | "stability") => {
    const currentLevels = weaponUpgradeLevels[weapon];
    const currentLevel = currentLevels[attribute];
    if (currentLevel >= MAX_WEAPON_LEVEL) return;
    const cost = WEAPON_UPGRADE_COSTS[currentLevel];
    if (tacticalCredits >= cost) {
      const nextCredits = tacticalCredits - cost;
      const nextWeaponUpgrades = {
        ...weaponUpgradeLevels,
        [weapon]: { ...currentLevels, [attribute]: currentLevel + 1 },
      };
      setTacticalCredits(nextCredits);
      setWeaponUpgradeLevels(nextWeaponUpgrades);
      saveMeta(nextCredits, upgradeLevels, nextWeaponUpgrades);
      sounds.playPickup("ammo");
    } else sounds.playError();
  };

  // Single stable interval; the ref always points at the latest render's
  // update closure, so state stays fresh without tearing the loop down.
  const updateRef = useRef(update);
  updateRef.current = update;
  useEffect(() => {
    const loop = setInterval(() => updateRef.current(), TICK_RATE);
    return () => clearInterval(loop);
  }, []);

  const requestPointerLockSafe = () => {
    if (!gameContainerRef.current) return;
    if (document.pointerLockElement === gameContainerRef.current) return;
    const now = Date.now();
    if (now - pointerLockCooldownRef.current < 1200) return;
    pointerLockCooldownRef.current = now;
    try {
      const promise = gameContainerRef.current.requestPointerLock();
      if (promise && typeof (promise as any).catch === "function") {
        (promise as any).catch(() => {});
      }
    } catch {
      // pointer lock can fail outside a user gesture; safe to ignore
    }
  };

  const togglePointerLock = () => {
    if (gameStateRef.current !== "playing") return;
    requestPointerLockSafe();
  };

  const pauseStartRef = useRef(0);

  const handlePauseToggle = () => {
    const s = gameStateRef.current;
    if (s === "playing") {
      pauseStartRef.current = Date.now();
      setGameState("paused");
      if (document.pointerLockElement) document.exitPointerLock();
    } else if (s === "paused") {
      // Shift every wall-clock timestamp by the pause duration, otherwise all
      // enemy cooldowns expire during the pause and the whole map opens fire
      // the instant the game resumes.
      const delta = Date.now() - pauseStartRef.current;
      if (delta > 0) {
        gameStartTime.current += delta;
        lastDamageTaken.current += delta;
        lastEnemyShotTimeGlobal.current += delta;
        lastShotTime.current += delta;
        enemies.current.forEach((e) => {
          e.lastShot += delta;
          e.spawnTime += delta;
          if (e.nextShotAt) e.nextShotAt += delta;
          if (e.diedAt) e.diedAt += delta;
        });
        decals.current.forEach((d) => {
          d.born += delta;
        });
      }
      setGameState("playing");
      setTimeout(() => requestPointerLockSafe(), 50);
    }
  };

  // Wrap weapon switching to trigger toast
  const setCurrentWeaponWithToast = (w: WeaponType) => {
    setCurrentWeapon(w);
    setWeaponSwitcherUntil(Date.now() + 2000);
  };

  useInputSystem({
    gameState,
    gameContainerRef,
    pointerLockCooldownRef,
    keys,
    player,
    ammoRef,
    isReloadingRef,
    currentWeapon,
    weaponMags,
    reloadTimeoutRef,
    setWeaponMags,
    setCurrentWeapon: setCurrentWeaponWithToast,
    setAmmo,
    setIsReloading,
    reload,
    handleShoot,
    togglePointerLock,
    onPauseToggle: handlePauseToggle,
  });

  const switcherVisible = Date.now() < weaponSwitcherUntil;

  return (
    <div className="relative w-full h-[100dvh] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-sans select-none">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(30,58,138,0.2),transparent)]" />
      </div>

      {/* Main Game Container — desktop only */}
      <div
        ref={gameContainerRef}
        className="relative group bg-black cursor-crosshair overflow-hidden shadow-2xl shadow-blue-900/20 border-4 border-slate-800 rounded-xl aspect-[16/9] max-w-[1400px] w-full"
        onClick={togglePointerLock}
      >
        {(gameState === "playing" || gameState === "paused" || gameState === "deploy") && (
          <>
            <GameScene
              player={player}
              enemies={enemiesState}
              particles={particles.current}
              tracers={tracers.current}
              decals={decals.current}
              objective={objectiveSnapshot}
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
            {currentWeapon === "sniper" && gameState === "playing" && (
              <SniperScope progress={player.current.adsProgress} />
            )}
          </>
        )}

        {gameState === "playing" && (
          <GameHUD
            wave={wave}
            difficulty={difficulty}
            score={score}
            kills={stats.kills}
            hp={hp}
            maxHp={100 + upgradeLevels.armorPlating * 5}
            currentWeapon={currentWeapon}
            ammo={ammo}
            isReloading={isReloading}
            isAds={player.current.isAds}
            lastShotTime={lastShotTime.current}
            killfeed={killfeed}
            damageIndicators={damageIndicators}
            lastDamageTime={lastDamageTaken.current}
            hitMarker={hitMarker}
            objectiveSnapshot={objectiveSnapshot}
            enemiesRemaining={enemiesRemaining}
            weaponSwitcherVisible={switcherVisible}
            waveMessage={waveMessage}
            bossHp={bossHp}
          />
        )}

        <AnimatePresence>
          {gameState === "deploy" && <DeployScreen onDeploy={startDeployedMatch} />}
        </AnimatePresence>

        <AnimatePresence>
          {gameState === "paused" && (
            <PauseMenu
              onResume={handlePauseToggle}
              onRestart={() => {
                if (document.pointerLockElement) document.exitPointerLock();
                initGame();
              }}
              onExit={() => {
                if (document.pointerLockElement) document.exitPointerLock();
                setMenuView("main");
                setGameState("start");
              }}
            />
          )}
        </AnimatePresence>

        {/* Start / Dead / Win / Upgrades Overlays */}
        <AnimatePresence>
          {(gameState === "start" ||
            gameState === "dead" ||
            gameState === "win" ||
            gameState === "upgrades") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center z-[100]"
              style={
                gameState === "win"
                  ? {
                      backgroundImage: `linear-gradient(rgba(2,6,23,0.78), rgba(2,6,23,0.92)), url(${splashMissionComplete})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : gameState === "dead"
                    ? {
                        backgroundImage: `linear-gradient(rgba(2,6,23,0.78), rgba(2,6,23,0.92)), url(${splashMissionFailed})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
              }
            >
              {gameState === "upgrades" ? (
                <div className="w-full max-w-2xl bg-zinc-900/90 rounded-3xl border border-white/10 p-6 md:p-10 max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 text-left">
                    <div>
                      <h2 className="text-3xl md:text-5xl font-black text-white italic uppercase tracking-tighter">
                        Command Center
                      </h2>
                      <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-[0.3em] mt-2 bg-cyan-500/10 px-3 py-1 rounded w-fit">
                        Arena Augments
                      </p>
                    </div>
                    <div className="w-full sm:w-auto bg-slate-950 p-1 rounded-2xl border border-white/10 shadow-inner flex shrink-0">
                      <div className="bg-yellow-500 text-slate-950 px-5 py-3 rounded-xl flex items-center gap-3">
                        <Coins size={20} className="shrink-0" />
                        <span className="font-black text-xl leading-none">
                          {tacticalCredits.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-8 bg-slate-950/50 p-1 rounded-2xl border border-white/5">
                    <button
                      onClick={() => {
                        sounds.playUiClick();
                        setUpgradeTab("biological");
                      }}
                      className={`flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${upgradeTab === "biological" ? "bg-white text-slate-950 shadow-lg" : "text-slate-500 hover:text-white"}`}
                    >
                      Biological
                    </button>
                    <button
                      onClick={() => {
                        sounds.playUiClick();
                        setUpgradeTab("weapon");
                      }}
                      className={`flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${upgradeTab === "weapon" ? "bg-white text-slate-950 shadow-lg" : "text-slate-500 hover:text-white"}`}
                    >
                      Weapon Lab
                    </button>
                  </div>

                  {upgradeTab === "biological" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                      {Object.entries(UPGRADES).map(([key, upgrade]) => {
                        const level = upgradeLevels[key];
                        const isMax = level >= upgrade.maxLevel;
                        const cost = isMax ? 0 : upgrade.costs[level];
                        const canAfford = tacticalCredits >= cost;
                        return (
                          <div
                            key={key}
                            className="bg-slate-950/50 p-5 rounded-2xl border border-white/5 text-left flex flex-col"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-white font-black uppercase text-sm">
                                {upgrade.name}
                              </span>
                              <div className="flex gap-1">
                                {[...Array(upgrade.maxLevel)].map((_, i) => (
                                  <div
                                    key={i}
                                    className={`w-1.5 h-1.5 rounded-full ${i < level ? "bg-blue-500 shadow-[0_0_5px_#3b82f6]" : "bg-slate-800"}`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-slate-500 text-[10px] uppercase font-bold mb-4">
                              {upgrade.description}
                            </p>
                            <button
                              disabled={isMax || !canAfford}
                              onClick={() => buyUpgrade(key)}
                              className={`mt-auto py-2 rounded-xl flex items-center justify-center gap-2 font-black uppercase text-xs transition-all ${
                                isMax
                                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                  : canAfford
                                    ? "bg-white text-slate-950 hover:scale-105 active:scale-95"
                                    : "bg-red-500/10 text-red-500 border border-red-500/20"
                              }`}
                            >
                              {isMax ? (
                                "MAXED"
                              ) : !canAfford ? (
                                "CREDITS NEEDED"
                              ) : (
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
                              className={`px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest border transition-all ${isSelected ? "bg-blue-500 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]" : "bg-slate-950/50 border-white/5 text-slate-500 hover:border-white/20"}`}
                            >
                              {weapon.name}
                            </button>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {(["damage", "reload", "stability"] as const).map((attr) => {
                          const level = weaponUpgradeLevels[selectedLabWeapon][attr];
                          const isMax = level >= MAX_WEAPON_LEVEL;
                          const cost = isMax ? 0 : WEAPON_UPGRADE_COSTS[level];
                          const canAfford = tacticalCredits >= cost;
                          const descriptions = {
                            damage: "+5% Firepower per level",
                            reload: "-4% Reload time per level",
                            stability: "-5% Recoil/Spread per level",
                          };
                          return (
                            <div
                              key={attr}
                              className="bg-slate-950/50 p-5 rounded-2xl border border-white/5 text-left flex items-center justify-between"
                            >
                              <div>
                                <span className="text-white font-black uppercase text-sm block mb-1">
                                  {attr}
                                </span>
                                <p className="text-slate-500 text-[9px] uppercase font-bold mb-3">
                                  {descriptions[attr]}
                                </p>
                                <div className="flex gap-1">
                                  {[...Array(MAX_WEAPON_LEVEL)].map((_, i) => (
                                    <div
                                      key={i}
                                      className={`w-3 h-1 rounded-full ${i < level ? "bg-blue-500 shadow-[0_0_5px_#3b82f6]" : "bg-slate-800"}`}
                                    />
                                  ))}
                                </div>
                              </div>
                              <button
                                disabled={isMax || !canAfford}
                                onClick={() => buyWeaponUpgrade(selectedLabWeapon, attr)}
                                className={`py-2 px-6 rounded-xl flex items-center justify-center gap-2 font-black uppercase text-xs transition-all ${
                                  isMax
                                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                    : canAfford
                                      ? "bg-white text-slate-950 hover:scale-105 active:scale-95"
                                      : "bg-red-500/10 text-red-500 border border-red-500/20"
                                }`}
                              >
                                {isMax ? (
                                  "MAX"
                                ) : !canAfford ? (
                                  "CREDITS NEEDED"
                                ) : (
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
                      setMenuView("main");
                      setGameState("start");
                    }}
                    className="flex items-center justify-center gap-2 text-slate-500 hover:text-white transition-colors font-black uppercase text-[10px] tracking-widest w-full py-4 border-t border-white/5 mt-4"
                  >
                    <ChevronLeft size={16} /> Return to Operations
                  </button>
                </div>
              ) : gameState === "start" ? (
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
                  arenas={ARENAS}
                  selectedArenaId={selectedArenaId}
                  setSelectedArenaId={setSelectedArenaId}
                />
              ) : (
                <div
                  className={`p-8 md:p-12 rounded-[2.5rem] bg-slate-900/90 border-4 backdrop-blur-2xl ${gameState === "win" ? "border-yellow-500 shadow-[0_0_60px_rgba(234,179,8,0.2)]" : "border-red-600 shadow-[0_0_60px_rgba(220,38,38,0.2)]"} w-full max-w-2xl relative overflow-hidden`}
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                  <div className="relative z-10 flex flex-col items-center">
                    <div
                      className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/50 border border-white/10 text-[10px] font-black uppercase tracking-[0.3em]"
                      style={{ color: DIFFICULTIES[difficulty].color }}
                    >
                      <Target size={14} />
                      {DIFFICULTIES[difficulty].name} PROTOCOL{" "}
                      {gameState === "win" ? "COMPLETE" : "FAILED"}
                    </div>
                    <h2
                      className={`text-6xl md:text-8xl font-black italic tracking-tighter mb-4 text-center ${gameState === "win" ? "text-yellow-500" : "text-red-600"}`}
                    >
                      {gameState === "win" ? "SUCCESS" : "SYSTEM FAILURE"}
                    </h2>
                    <p className="text-white/60 font-medium uppercase tracking-[0.2em] mb-12 text-center text-[10px] md:text-sm max-w-md mx-auto leading-relaxed">
                      {gameState === "win"
                        ? "Strategic objective achieved. Sector secured for extraction."
                        : "Critical integrity loss detected. Mission aborted."}
                    </p>
                    <div className="w-full bg-black/40 p-1 rounded-[2rem] border border-white/10 shadow-2xl mb-8 relative overflow-hidden">
                      <div className="relative z-10 flex flex-col md:flex-row justify-between items-center px-8 py-6 gap-6">
                        <div className="flex flex-col items-center md:items-start">
                          <span className="text-yellow-500 text-[10px] font-black mb-1 uppercase tracking-[0.4em]">
                            Resource Salvage
                          </span>
                          <div className="flex items-center gap-3">
                            <Coins className="text-yellow-500" size={32} />
                            <span className="text-5xl md:text-6xl font-black text-white tabular-nums tracking-tighter">
                              +{earnedCredits.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-center md:text-right border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-8">
                          <span className="block text-white/30 text-[9px] uppercase font-bold mb-1 tracking-widest leading-none">
                            Account Balance
                          </span>
                          <span className="text-2xl font-black text-white/60 tabular-nums leading-none tracking-tight">
                            {tacticalCredits.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full mb-12">
                      {[
                        { label: "Score", value: score.toLocaleString(), color: "text-white" },
                        { label: "Max Wave", value: wave, color: "text-cyan-400" },
                        { label: "Kills", value: stats.kills, color: "text-red-500" },
                        {
                          label: "Accuracy",
                          value: `${stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0}%`,
                          color: "text-green-500",
                        },
                      ].map((stat, i) => (
                        <div
                          key={i}
                          className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col items-center gap-1"
                        >
                          <span className="text-[8px] text-white/30 uppercase font-bold tracking-widest">
                            {stat.label}
                          </span>
                          <span className={`text-xl font-black ${stat.color} tracking-tight`}>
                            {stat.value}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 w-full">
                      <button
                        onClick={initGame}
                        className={`flex-1 py-5 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group ${gameState === "win" ? "bg-yellow-500 text-slate-950 font-black" : "bg-red-600 text-white font-black"}`}
                      >
                        <Target className="group-hover:rotate-12 transition-transform" />
                        <span className="text-xl uppercase tracking-tighter italic">Re-Deploy</span>
                      </button>
                      <button
                        onClick={() => {
                          sounds.playUiClick();
                          setMenuView("main");
                          setGameState("start");
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
    </div>
  );
}
