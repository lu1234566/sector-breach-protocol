// @ts-nocheck
import { CELL_SIZE, DIFFICULTIES } from "../constants";
import { sounds } from "../SoundEngine";
import type { Enemy, Player, Tracer, DamageIndicator } from "../types";

interface EnemyAITickDeps {
  // Time
  now: number;
  gameStartTime: React.MutableRefObject<number>;
  // World
  enemies: React.MutableRefObject<Enemy[]>;
  player: React.MutableRefObject<Player>;
  mapData: React.MutableRefObject<number[][]>;
  navGridRef: React.MutableRefObject<number[][]>;
  setMapDataState: (m: number[][]) => void;
  // Combat
  lastDamageTaken: React.MutableRefObject<number>;
  lastDamageSource: React.MutableRefObject<any>;
  lastEnemyShotTimeGlobal: React.MutableRefObject<number>;
  tracers: React.MutableRefObject<Tracer[]>;
  nextTracerId: React.MutableRefObject<number>;
  nextDamageId: React.MutableRefObject<number>;
  screenShake: React.MutableRefObject<number>;
  // Wave / state
  waveRef: React.MutableRefObject<number>;
  gameStateRef: React.MutableRefObject<string>;
  isRunEndingRef: React.MutableRefObject<boolean>;
  // Stats / setters
  difficulty: keyof typeof DIFFICULTIES;
  setHp: (fn: (prev: number) => number) => void;
  setDamageIndicators: (fn: (prev: DamageIndicator[]) => DamageIndicator[]) => void;
  endRun: (won: boolean, message?: string) => void;
  // Helpers
  checkLineOfSightInfo: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    mapData: number[][],
  ) => { hasLOS: boolean; blockedBy: any };
  spawnParticles: (x: number, y: number, type: "blood" | "explosion" | "shell") => void;
  // Tuning
  WAVE_1_DAMAGE_MULT: number;
  INITIAL_GRACE_PERIOD: number;
  DEBUG_SAFE_MODE: boolean;
}

/**
 * Per-frame enemy AI tick. Pure function — consumes refs/state via deps.
 * Comportamento idêntico ao `enemies.current.forEach` original em GameApp.tsx.
 */
export function tickEnemyAI(deps: EnemyAITickDeps): void {
  const {
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
  } = deps;

  enemies.current.forEach((e: any) => {
    if (e.dead) return;
    const pDx = player.current.x - e.x;
    const pDy = player.current.y - e.y;
    const dist = Math.sqrt(pDx * pDx + pDy * pDy);

    const angleToPlayer = Math.atan2(pDy, pDx);
    const cos = Math.cos(angleToPlayer);
    const sin = Math.sin(angleToPlayer);

    const losInfo = checkLineOfSightInfo(
      e.x,
      e.y,
      player.current.x,
      player.current.y,
      mapData.current,
    );
    e.hasLineOfSight = losInfo.hasLOS;
    e.blockedBy = losInfo.blockedBy;

    let targetDist = 0;
    if (e.type === "rusher") targetDist = 80;
    else if (e.type === "rifleman") targetDist = 320;
    else if (e.type === "sniper") targetDist = 600;

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

      if (dist < 150) {
        moveX += -sin * e.speed * 0.7;
        moveY += cos * e.speed * 0.7;
      }

      const dMoved = Math.hypot(e.x - e.lastX, e.y - e.lastY);
      if ((moveX !== 0 || moveY !== 0) && dMoved < 0.1) {
        e.stuckFrames++;
      } else {
        e.stuckFrames = Math.max(0, e.stuckFrames - 2);
      }

      if (e.stuckFrames > 60) {
        moveX = -sin * e.speed;
        moveY = cos * e.speed;
        if (e.stuckFrames > 120) e.stuckFrames = 0;
      }

      // Rushers are melee: claws only land at point-blank range, no tracer.
      const isMelee = e.type === "rusher" && !e.isBoss;
      const fireRateBase = e.isBoss
        ? 600
        : e.type === "sniper"
          ? 3000
          : e.type === "rifleman"
            ? 900
            : 1100;
      const wave1FireRateBuffer = waveRef.current === 1 ? 1.5 : 1.0;
      const fireRate = fireRateBase * wave1FireRateBuffer;

      const isGracePeriod = now - gameStartTime.current < INITIAL_GRACE_PERIOD;
      const canShoot = !isGracePeriod && now - e.spawnTime > (waveRef.current === 1 ? 3000 : 1500);

      const globalShootCooldown =
        waveRef.current === 1 ? now - lastEnemyShotTimeGlobal.current < 1000 : false;

      if (
        canShoot &&
        !globalShootCooldown &&
        now >= (e.nextShotAt ?? 0) &&
        now - e.lastShot > fireRate &&
        dist < (isMelee ? 110 : 1200)
      ) {
        const shotLOS = checkLineOfSightInfo(
          e.x,
          e.y,
          player.current.x,
          player.current.y,
          mapData.current,
        );
        e.hasLineOfSight = shotLOS.hasLOS;
        e.blockedBy = shotLOS.blockedBy;

        if (shotLOS.hasLOS) {
          e.lastShot = now;
          lastEnemyShotTimeGlobal.current = now;

          if (!DEBUG_SAFE_MODE && now - lastDamageTaken.current > 600) {
            const baseDamage = e.type === "sniper" ? 35 : e.type === "rifleman" ? 12 : 14;
            const wave1Mult = waveRef.current === 1 ? WAVE_1_DAMAGE_MULT : 1.0;
            const damage =
              (e.isBoss ? baseDamage * 2.5 : baseDamage) *
              DIFFICULTIES[difficulty].dmgMult *
              wave1Mult;

            lastDamageSource.current = {
              id: e.id,
              type: e.type,
              dist: Math.round(dist),
              hasLOS: shotLOS.hasLOS,
              blockedBy: shotLOS.blockedBy,
            };

            setHp((prev) => {
              const newHp = Math.max(0, prev - damage);
              if (newHp === 0 && gameStateRef.current === "playing" && !isRunEndingRef.current) {
                endRun(false);
              }
              return newHp;
            });
            lastDamageTaken.current = now;
            screenShake.current = Math.min(20, screenShake.current + damage / 2);
            setDamageIndicators((prev) =>
              [
                ...prev,
                {
                  id: nextDamageId.current++,
                  angle: angleToPlayer - player.current.angle + Math.PI,
                  opacity: 1.2,
                },
              ].slice(-5),
            );
            spawnParticles(player.current.x, player.current.y, "blood");
            if (isMelee) sounds.playHit();
            else sounds.playShot(e.type === "sniper" ? "sniper" : "pistol");
          }
          if (!isMelee) {
            tracers.current.push({
              id: nextTracerId.current++,
              x1: e.x,
              y1: e.y,
              x2: player.current.x,
              y2: player.current.y,
              alpha: 1,
            });
          }
        }
      }
    } else {
      const curGridX = Math.floor(e.x / CELL_SIZE);
      const curGridY = Math.floor(e.y / CELL_SIZE);

      if (navGridRef.current[curGridY]) {
        let bestD = navGridRef.current[curGridY][curGridX] || 999;
        let bestDir = { dx: 0, dy: 0 };

        const neighbors = [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
          [1, 1],
          [-1, -1],
          [1, -1],
          [-1, 1],
        ];
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
          const targetX = (curGridX + bestDir.dx) * CELL_SIZE + CELL_SIZE / 2;
          const targetY = (curGridY + bestDir.dy) * CELL_SIZE + CELL_SIZE / 2;
          const angleToGrid = Math.atan2(targetY - e.y, targetX - e.x);
          moveX = Math.cos(angleToGrid) * e.speed;
          moveY = Math.sin(angleToGrid) * e.speed;
        } else {
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
      if (tx < 0 || tx >= mapData.current[0].length || ty < 0 || ty >= mapData.current.length)
        return false;
      const cell = mapData.current[ty][tx];
      if (cell === 0) return true;
      if (cell === 2) {
        if (mapData.current[ty]) mapData.current[ty][tx] = 0;
        setMapDataState([...mapData.current.map((row) => [...row])]);
        return true;
      }
      return false;
    };

    if (tryEnemyMove(txX, curTy)) e.x = nx;
    else if (txX !== curTx) e.stuckFrames++;

    if (tryEnemyMove(curTx, tyY)) e.y = ny;
    else if (tyY !== curTy) e.stuckFrames++;
  });

  // Soft separation pass so enemies don't stack inside one another.
  const list = enemies.current;
  const isFreeCell = (x: number, y: number) => {
    const tx = Math.floor(x / CELL_SIZE);
    const ty = Math.floor(y / CELL_SIZE);
    return mapData.current[ty]?.[tx] === 0;
  };
  for (let i = 0; i < list.length; i++) {
    const a: any = list[i];
    if (a.dead) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b: any = list[j];
      if (b.dead) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minD = (a.isBoss ? 44 : 24) + (b.isBoss ? 44 : 24);
      if (d >= minD) continue;
      if (d < 0.001) {
        dx = 1;
        dy = 0;
      } else {
        dx /= d;
        dy /= d;
      }
      const push = (minD - d) * 0.25;
      const ax = a.x - dx * push;
      const ay = a.y - dy * push;
      const bx = b.x + dx * push;
      const by = b.y + dy * push;
      if (isFreeCell(ax, ay)) {
        a.x = ax;
        a.y = ay;
      }
      if (isFreeCell(bx, by)) {
        b.x = bx;
        b.y = by;
      }
    }
  }
}
