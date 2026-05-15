// @ts-nocheck
import { useEffect } from 'react';
import { WEAPONS } from '../constants';
import { clamp } from '../utils';
import type { WeaponType } from '../types';

interface UseInputSystemArgs {
  gameState: string;
  gameContainerRef: React.RefObject<HTMLDivElement>;
  pointerLockCooldownRef: React.MutableRefObject<number>;
  keys: React.MutableRefObject<Record<string, boolean>>;
  player: React.MutableRefObject<{ angle: number; pitch: number; isAds: boolean }>;
  ammoRef: React.MutableRefObject<{ mag: number; reserve: number }>;
  currentWeapon: WeaponType;
  weaponMags: Record<WeaponType, number>;
  reloadTimeoutRef: React.MutableRefObject<number | null>;
  setWeaponMags: (fn: (prev: Record<WeaponType, number>) => Record<WeaponType, number>) => void;
  setCurrentWeapon: (w: WeaponType) => void;
  setAmmo: (fn: (prev: { mag: number; reserve: number }) => { mag: number; reserve: number }) => void;
  setIsReloading: (b: boolean) => void;
  reload: () => void;
  handleShoot: () => void;
  togglePointerLock: () => void;
  mobileMode: boolean;
}

/**
 * Centraliza input de teclado, mouse e pointer lock.
 * Comportamento idêntico ao bloco original em GameApp.tsx.
 */
export function useInputSystem(args: UseInputSystemArgs) {
  const {
    gameState, gameContainerRef, pointerLockCooldownRef,
    keys, player, ammoRef, currentWeapon, weaponMags, reloadTimeoutRef,
    setWeaponMags, setCurrentWeapon, setAmmo, setIsReloading,
    reload, handleShoot, togglePointerLock,
  } = args;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (e.key === 'r') reload();
      if (['1', '2', '3', '4'].includes(e.key)) {
        const weaponMap: Record<string, WeaponType> = { '1': 'pistol', '2': 'rifle', '3': 'shotgun', '4': 'sniper' };
        const next = weaponMap[e.key];
        if (next === currentWeapon) return;

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
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    const handleMouseDown = (e: MouseEvent) => {
      if (gameState !== 'playing') return;
      if (document.pointerLockElement !== gameContainerRef.current) {
        togglePointerLock();
        return;
      }
      if (e.button === 2) keys.current['m_right'] = true;
      if (e.button === 0) {
        keys.current['m_left'] = true;
        handleShoot();
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
      player.current.pitch = clamp(player.current.pitch + e.movementY * 0.1, -25, 25);
    };

    const handlePointerLockChange = () => {
      if (document.pointerLockElement === null) {
        pointerLockCooldownRef.current = Date.now();
      }
    };
    const handlePointerLockError = () => {
      console.warn('Pointer lock error event caught');
      pointerLockCooldownRef.current = 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
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
}

// Suppress unused import warning for WEAPONS — kept for future extension
void WEAPONS;
