// @ts-nocheck
import { useCallback } from 'react';
import { getWaveObjective, createRuntime } from '../objectives';
import type { ArenaDef } from '../../data/arenas';
import type { ObjectiveRuntime } from '../types';

interface UseWaveSystemArgs {
  // Refs
  waveRef: React.MutableRefObject<number>;
  isWaveTransitionRef: React.MutableRefObject<boolean>;
  isSpawningRef: React.MutableRefObject<boolean>;
  spawnIntervalRef: React.MutableRefObject<number | null>;
  waveTransitionTimeoutRef: React.MutableRefObject<number | null>;
  bossSpawnTimeoutRef: React.MutableRefObject<number | null>;
  objectiveRef: React.MutableRefObject<ObjectiveRuntime | null>;
  currentArenaRef: React.MutableRefObject<ArenaDef>;
  gameStateRef: React.MutableRefObject<string>;
  // Setters
  setObjectiveSnapshot: (s: ObjectiveRuntime | null) => void;
  setWaveMessage: (m: string) => void;
  setEnemiesRemaining: (fn: (n: number) => number) => void;
  // Spawn callback
  spawnEnemies: (count: number, currentWave?: number, isBoss?: boolean) => void;
}

/**
 * Encapsula a lógica de spawn por onda + timers + objetivo.
 * Comportamento idêntico ao `spawnWave` original em GameApp.tsx.
 */
export function useWaveSystem(args: UseWaveSystemArgs) {
  const {
    waveRef, isWaveTransitionRef, isSpawningRef,
    spawnIntervalRef, waveTransitionTimeoutRef, bossSpawnTimeoutRef,
    objectiveRef, currentArenaRef, gameStateRef,
    setObjectiveSnapshot, setWaveMessage, setEnemiesRemaining,
    spawnEnemies,
  } = args;

  const spawnWave = useCallback((waveNum: number) => {
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current);
      spawnIntervalRef.current = null;
    }
    if (waveTransitionTimeoutRef.current) {
      clearTimeout(waveTransitionTimeoutRef.current);
      waveTransitionTimeoutRef.current = null;
    }

    isWaveTransitionRef.current = true;

    waveTransitionTimeoutRef.current = setTimeout(() => {
      setWaveMessage('');
      isWaveTransitionRef.current = false;
      waveTransitionTimeoutRef.current = null;
    }, 3000) as unknown as number;

    waveRef.current = waveNum;
    isSpawningRef.current = true;

    // Initialize objective for this wave
    const objDef = getWaveObjective(waveNum, currentArenaRef.current);
    const objRuntime = createRuntime(objDef);
    objectiveRef.current = objRuntime;
    setObjectiveSnapshot({ ...objRuntime });
    setWaveMessage(`WAVE ${waveNum} · ${objDef.label.toUpperCase()}`);

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
  }, [
    spawnIntervalRef, waveTransitionTimeoutRef, bossSpawnTimeoutRef,
    isWaveTransitionRef, isSpawningRef, waveRef, objectiveRef,
    currentArenaRef, gameStateRef,
    setObjectiveSnapshot, setWaveMessage, setEnemiesRemaining,
    spawnEnemies,
  ]);

  return { spawnWave };
}
