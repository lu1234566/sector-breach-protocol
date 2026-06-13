import { motion } from "motion/react";
import { WeaponType } from "@/game-app/game/constants";
import type { DamageIndicator, KillfeedItem, ObjectiveRuntime } from "@/game-app/game/types";
import type { DifficultyKey } from "@/game-app/game/constants";
import { ObjectivePanel } from "./ObjectivePanel";
import { WavePanel } from "./WavePanel";
import { ScorePanel } from "./ScorePanel";
import { HealthPanel } from "./HealthPanel";
import { WeaponPanel } from "./WeaponPanel";
import { Crosshair } from "./Crosshair";
import { Killfeed } from "./Killfeed";
import { DamageOverlay } from "./DamageOverlay";
import { WeaponSwitcherToast } from "./WeaponSwitcherToast";
import { BossHealthBar } from "./BossHealthBar";

interface GameHUDProps {
  wave: number;
  endless?: boolean;
  difficulty: DifficultyKey;
  score: number;
  kills: number;
  hp: number;
  maxHp: number;
  currentWeapon: WeaponType;
  ammo: { mag: number; reserve: number };
  isReloading: boolean;
  playerRef: React.MutableRefObject<{ isAds: boolean }>;
  lastShotTimeRef: React.MutableRefObject<number>;
  killfeed: KillfeedItem[];
  damageIndicators: DamageIndicator[];
  lastDamageTime: number;
  hitMarker: { time: number; killed: boolean };
  objectiveSnapshot: ObjectiveRuntime | null;
  enemiesRemaining: number;
  weaponSwitcherVisible: boolean;
  waveMessage: string;
  bossHp: { current: number; max: number } | null;
}

export function GameHUD({
  wave,
  endless,
  difficulty,
  score,
  kills,
  hp,
  maxHp,
  currentWeapon,
  ammo,
  isReloading,
  playerRef,
  lastShotTimeRef,
  killfeed,
  damageIndicators,
  lastDamageTime,
  hitMarker,
  objectiveSnapshot,
  enemiesRemaining,
  weaponSwitcherVisible,
  waveMessage,
  bossHp,
}: GameHUDProps) {
  return (
    <>
      <ObjectivePanel runtime={objectiveSnapshot} enemiesRemaining={enemiesRemaining} />
      <WavePanel wave={wave} endless={endless} difficulty={difficulty} />
      <ScorePanel score={score} kills={kills} />
      <HealthPanel hp={hp} maxHp={maxHp} />
      <WeaponPanel currentWeapon={currentWeapon} ammo={ammo} isReloading={isReloading} />
      <Crosshair playerRef={playerRef} lastShotTimeRef={lastShotTimeRef} />
      <Killfeed items={killfeed} />
      <DamageOverlay
        indicators={damageIndicators}
        hp={hp}
        lastDamageTime={lastDamageTime}
        hitMarker={hitMarker}
      />
      <WeaponSwitcherToast currentWeapon={currentWeapon} visible={weaponSwitcherVisible} />

      {bossHp && <BossHealthBar bossHp={bossHp} />}

      {waveMessage && (
        <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 text-center px-4">
          <motion.h2
            initial={{ opacity: 0, letterSpacing: "0.8em" }}
            animate={{ opacity: 1, letterSpacing: "0.1em" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="text-[clamp(2rem,8vw,4rem)] font-black text-white italic tracking-tighter uppercase drop-shadow-[0_0_24px_rgba(34,211,238,0.4)]"
          >
            {waveMessage}
          </motion.h2>
          <div className="h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent w-full mt-3" />
        </div>
      )}
    </>
  );
}
