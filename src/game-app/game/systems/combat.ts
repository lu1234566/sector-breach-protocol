// @ts-nocheck
import { CELL_SIZE, WEAPONS } from '../constants';
import { sounds } from '../SoundEngine';
import type {
  Enemy, Player, Tracer, Pickup, KillfeedItem, ObjectiveRuntime, WeaponType,
} from '../types';

interface CombatDeps {
  // State refs
  gameStateRef: React.MutableRefObject<string>;
  isReloadingRef: React.MutableRefObject<boolean>;
  ammoRef: React.MutableRefObject<{ mag: number; reserve: number }>;
  lastShotTime: React.MutableRefObject<number>;
  player: React.MutableRefObject<Player>;
  enemies: React.MutableRefObject<Enemy[]>;
  mapData: React.MutableRefObject<number[][]>;
  particles: React.MutableRefObject<any[]>;
  pickups: React.MutableRefObject<Pickup[]>;
  graveyard: React.MutableRefObject<any[]>;
  tracers: React.MutableRefObject<Tracer[]>;
  nextTracerId: React.MutableRefObject<number>;
  decals: React.MutableRefObject<any[]>;
  nextDecalId: React.MutableRefObject<number>;
  recoilOffset: React.MutableRefObject<number>;
  screenShake: React.MutableRefObject<number>;
  objectiveRef: React.MutableRefObject<ObjectiveRuntime | null>;
  reloadTimeoutRef: React.MutableRefObject<number | null>;
  nextKillfeedId: React.MutableRefObject<number>;
  // Plain values
  currentWeapon: WeaponType;
  weaponUpgradeLevels: any;
  upgradeLevels: Record<string, number>;
  // Setters
  setAmmo: (fn: (prev: { mag: number; reserve: number }) => { mag: number; reserve: number }) => void;
  setStats: (fn: (prev: any) => any) => void;
  setMapDataState: (m: number[][]) => void;
  setBossHp: (v: { current: number; max: number } | null) => void;
  setHitMarker: (v: { time: number; killed: boolean }) => void;
  setScore: (fn: (prev: number) => number) => void;
  setKillfeed: (fn: (prev: KillfeedItem[]) => KillfeedItem[]) => void;
  setIsReloading: (b: boolean) => void;
  setWeaponMags: (fn: (prev: Record<WeaponType, number>) => Record<WeaponType, number>) => void;
  // Helpers
  checkLineOfSight: (x1: number, y1: number, x2: number, y2: number, mapData: number[][]) => boolean;
  spawnParticles: (x: number, y: number, type: 'blood' | 'explosion' | 'shell') => void;
}

export function createHandleShoot(deps: CombatDeps) {
  return function handleShoot() {
    const {
      gameStateRef, isReloadingRef, ammoRef, lastShotTime,
      player, enemies, mapData, pickups, graveyard, tracers, nextTracerId,
      decals, nextDecalId, recoilOffset, screenShake, objectiveRef,
      currentWeapon, weaponUpgradeLevels, upgradeLevels,
      setAmmo, setStats, setMapDataState, setBossHp, setHitMarker, setScore, setKillfeed,
      nextKillfeedId,
      checkLineOfSight, spawnParticles,
    } = deps;

    if (gameStateRef.current !== 'playing' || isReloadingRef.current) return;
    const now = Date.now();
    const weapon = WEAPONS[currentWeapon];
    if (now - lastShotTime.current < weapon.fireRate) return;

    if (ammoRef.current.mag <= 0) {
      if (!isReloadingRef.current && ammoRef.current.reserve > 0) deps.reload?.();
      return;
    }

    lastShotTime.current = now;
    setAmmo(prev => ({ ...prev, mag: Math.max(0, prev.mag - 1) }));
    setStats(prev => ({ ...prev, shotsFired: prev.shotsFired + 1 }));
    sounds.playShot(currentWeapon);

    const weaponLevels = weaponUpgradeLevels[currentWeapon];
    const stabilityMult = 1 - (weaponLevels.stability * 0.05);
    const recoilForce = weapon.recoil * (1 - player.current.adsProgress * 0.6) * stabilityMult;
    recoilOffset.current += recoilForce / 40;
    screenShake.current = Math.min(15, screenShake.current + recoilForce / 4);

    const spreadMult = 1 - (weaponLevels.stability * 0.05);
    const spread = (Math.random() - 0.5) * weapon.spread * (1 - player.current.adsProgress * 0.8) * spreadMult;
    const shotAngle = player.current.angle + spread;
    const cos = Math.cos(shotAngle);
    const sin = Math.sin(shotAngle);

    let hitDist = weapon.range;
    let hitSomething = false;

    for (let d = 0; d < weapon.range; d += 8) {
      const tx = Math.floor((player.current.x + cos * d) / CELL_SIZE);
      const ty = Math.floor((player.current.y + sin * d) / CELL_SIZE);
      if (tx >= 0 && tx < mapData.current[0].length && ty >= 0 && ty < mapData.current.length) {
        const cell = mapData.current[ty][tx];
        if (cell === 3) {
          if (mapData.current[ty]) mapData.current[ty][tx] = 0;
          setMapDataState([...mapData.current.map(row => [...row])]);
          spawnParticles(player.current.x + cos * d, player.current.y + sin * d, 'explosion');
          sounds.playShot('sniper');
          hitDist = d;
          hitSomething = true;
          break;
        } else if (cell === 1 || cell === 2) {
          hitDist = d;
          const hx = player.current.x + cos * d;
          const hy = player.current.y + sin * d;
          const localX = hx - (tx + 0.5) * CELL_SIZE;
          const localY = hy - (ty + 0.5) * CELL_SIZE;
          let nx = 0, ny = 0;
          if (Math.abs(localX) > Math.abs(localY)) nx = Math.sign(localX) || 1;
          else ny = Math.sign(localY) || 1;
          decals.current.push({
            id: nextDecalId.current++,
            x: hx, y: hy, nx, ny,
            born: Date.now(),
            size: weapon.type === 'shotgun' ? 7 : weapon.type === 'sniper' ? 10 : 5,
          });
          if (decals.current.length > 40) {
            decals.current.splice(0, decals.current.length - 40);
          }
          break;
        }
      }
    }

    enemies.current.forEach(enemy => {
      if (enemy.dead) return;
      const dx = enemy.x - player.current.x;
      const dy = enemy.y - player.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > hitDist) return;

      const angleToEnemy = Math.atan2(dy, dx);
      const angleDiff = Math.atan2(Math.sin(angleToEnemy - shotAngle), Math.cos(angleToEnemy - shotAngle));

      if (Math.abs(angleDiff) < 0.15 * (weapon.type === 'shotgun' ? 3 : 1)) {
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
          if (objectiveRef.current && objectiveRef.current.status === 'active') {
            objectiveRef.current.killCount += 1;
          }
          const killScore = enemy.isBoss ? 5000 : (enemy.type === 'sniper' ? 500 : enemy.type === 'rifleman' ? 200 : 100);
          setScore(prev => prev + killScore);
          setKillfeed(prev => [{ id: nextKillfeedId.current++, text: `${enemy.isBoss ? 'TITAN' : enemy.type.toUpperCase()} NEUTRALIZED (+${killScore})` }, ...prev].slice(0, 5));
          graveyard.current.push({ x: enemy.x, y: enemy.y, color: enemy.color, type: enemy.type });
          spawnParticles(enemy.x, enemy.y, 'explosion');

          const baseDropChance = 0.35;
          const dropChance = baseDropChance + (upgradeLevels.scavenger * 0.05);
          if (Math.random() < dropChance || enemy.isBoss) {
            const type = Math.random() > 0.5 ? 'health' : 'ammo';
            pickups.current.push({
              id: Math.random(),
              x: enemy.x, y: enemy.y, type, rotation: 0,
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

    spawnParticles(player.current.x, player.current.y, 'shell');

    tracers.current.push({
      id: nextTracerId.current++,
      x1: player.current.x, y1: player.current.y,
      x2: player.current.x + cos * hitDist,
      y2: player.current.y + sin * hitDist,
      alpha: 1,
    });
  };
}

interface ReloadDeps {
  isReloadingRef: React.MutableRefObject<boolean>;
  ammoRef: React.MutableRefObject<{ mag: number; reserve: number }>;
  gameStateRef: React.MutableRefObject<string>;
  reloadTimeoutRef: React.MutableRefObject<number | null>;
  currentWeapon: WeaponType;
  upgradeLevels: Record<string, number>;
  weaponUpgradeLevels: any;
  setIsReloading: (b: boolean) => void;
  setAmmo: (fn: (prev: { mag: number; reserve: number }) => { mag: number; reserve: number }) => void;
  setWeaponMags: (fn: (prev: Record<WeaponType, number>) => Record<WeaponType, number>) => void;
}

export function createReload(deps: ReloadDeps) {
  return function reload() {
    const {
      isReloadingRef, ammoRef, gameStateRef, reloadTimeoutRef,
      currentWeapon, upgradeLevels, weaponUpgradeLevels,
      setIsReloading, setAmmo, setWeaponMags,
    } = deps;

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
        setWeaponMags(mags => ({ ...mags, [reloadingWeapon]: newMag }));
        const newAmmo = { mag: newMag, reserve: prev.reserve - taken };
        ammoRef.current = newAmmo;
        return newAmmo;
      });
      setIsReloading(false);
      isReloadingRef.current = false;
      reloadTimeoutRef.current = null;
    }, finalReloadTime) as unknown as number;
  };
}
