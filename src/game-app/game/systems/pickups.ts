// @ts-nocheck
import { sounds } from "../SoundEngine";
import type { Pickup, Player, KillfeedItem } from "../types";

interface PickupDeps {
  pickups: React.MutableRefObject<Pickup[]>;
  player: React.MutableRefObject<Player>;
  upgradeLevels: Record<string, number>;
  nextKillfeedId: React.MutableRefObject<number>;
  setHp: (fn: (prev: number) => number) => void;
  setAmmo: (
    fn: (prev: { mag: number; reserve: number }) => { mag: number; reserve: number },
  ) => void;
  setKillfeed: (fn: (prev: KillfeedItem[]) => KillfeedItem[]) => void;
}

/**
 * Per-frame pickup pickup-collision + rotation. Pure function.
 * Comportamento idêntico ao bloco original em GameApp.tsx (`pickups.current = pickups.current.filter...`).
 */
export function tickPickups(deps: PickupDeps): void {
  const { pickups, player, upgradeLevels, nextKillfeedId, setHp, setAmmo, setKillfeed } = deps;

  pickups.current = pickups.current.filter((p) => {
    const dist = Math.hypot(p.x - player.current.x, p.y - player.current.y);
    if (dist < 32) {
      if (p.type === "health") {
        const maxHp = 100 + upgradeLevels.armorPlating * 5;
        setHp((prev) => Math.min(maxHp, prev + 25));
      } else {
        const maxReserve = 120 + upgradeLevels.ammoReserve * 20;
        setAmmo((prev) => ({ ...prev, reserve: Math.min(maxReserve, prev.reserve + 60) }));
      }
      sounds.playPickup(p.type);
      setKillfeed((prev) =>
        [
          { id: nextKillfeedId.current++, text: `+ ${p.type.toUpperCase()} SECURED` },
          ...prev,
        ].slice(0, 5),
      );
      return false;
    }
    p.rotation += 0.05;
    return true;
  });
}
