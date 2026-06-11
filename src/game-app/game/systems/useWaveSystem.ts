// @ts-nocheck
import { useCallback } from 'react';
import { BOSS_WAVE } from '../constants';
import { sounds } from '../SoundEngine';
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
    setObjectiveSnapshot, setWaveMessage,
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
    sounds.playWaveStart();

    // Gradual spawning
    const count = waveNum === 1 ? 3 : 3 + waveNum * 2;
    let spawnedCount = 0;

    const scheduleBoss = () => {
      isSpawningRef.current = true;
      if (bossSpawnTimeoutRef.current) clearTimeout(bossSpawnTimeoutRef.current);
      bossSpawnTimeoutRef.current = setTimeout(() => {
        bossSpawnTimeoutRef.current = null;
        // If paused (or still on the deploy screen) when the timer fires,
        // retry instead of silently dropping the boss — otherwise the wave
        // would complete without the Titan ever appearing.
        if (gameStateRef.current === 'paused' || gameStateRef.current === 'deploy') {
          scheduleBoss();
          return;
        }
        if (gameStateRef.current === 'playing' && waveRef.current === BOSS_WAVE) {
          spawnEnemies(1, BOSS_WAVE, true);
          sounds.playBossRoar();
        }
        isSpawningRef.current = false;
      }, 4000) as unknown as number;
    };

    spawnIntervalRef.current = setInterval(() => {
      const state = gameStateRef.current;
      // While paused/deploying, just hold the spawn schedule. Clearing the
      // interval here would soft-lock the wave on resume.
      if (state === 'paused' || state === 'deploy') return;
      if (state !== 'playing') {
        if (spawnIntervalRef.current) {
          clearInterval(spawnIntervalRef.current);
          spawnIntervalRef.current = null;
        }
        isSpawningRef.current = false;
        return;
      }

      if (spawnedCount >= count) {
        if (spawnIntervalRef.current) {
          clearInterval(spawnIntervalRef.current);
          spawnIntervalRef.current = null;
        }

        if (waveNum === BOSS_WAVE) scheduleBoss();
        else isSpawningRef.current = false;
        return;
      }
      spawnEnemies(1, waveNum);
      spawnedCount++;
    }, 800) as unknown as number;
  }, [
    spawnIntervalRef, waveTransitionTimeoutRef, bossSpawnTimeoutRef,
    isWaveTransitionRef, isSpawningRef, waveRef, objectiveRef,
    currentArenaRef, gameStateRef,
    setObjectiveSnapshot, setWaveMessage,
    spawnEnemies,
  ]);

  return { spawnWave };
}
