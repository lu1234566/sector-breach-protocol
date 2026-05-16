import { RefreshCcw } from 'lucide-react';
import { WEAPONS, WeaponType } from '@/game-app/game/constants';

interface Props {
  currentWeapon: WeaponType;
  ammo: { mag: number; reserve: number };
  isReloading: boolean;
}

export function WeaponPanel({ currentWeapon, ammo, isReloading }: Props) {
  const weapon = WEAPONS[currentWeapon];
  const low = ammo.mag <= Math.max(1, Math.floor(weapon.magSize * 0.25));
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-40 min-w-[180px]">
      <div className="bg-slate-950/70 backdrop-blur-md border border-cyan-500/20 rounded-md px-3 py-2">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-white font-black text-sm tracking-tighter uppercase">
            {weapon.name}
          </span>
          {isReloading ? (
            <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-amber-400">
              <RefreshCcw size={9} className="animate-spin" />
              Reload
            </span>
          ) : (
            <span className="font-mono text-xs">
              <span className={`font-bold ${low ? 'text-red-400 animate-pulse' : 'text-cyan-300'}`}>
                {ammo.mag}
              </span>
              <span className="text-slate-500"> / {ammo.reserve}</span>
            </span>
          )}
        </div>
        <div className="flex gap-[2px] h-1">
          {Array.from({ length: weapon.magSize }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 rounded-[1px] transition-all ${
                isReloading
                  ? 'bg-slate-800'
                  : i < ammo.mag
                    ? low
                      ? 'bg-red-400/80'
                      : 'bg-cyan-400/80'
                    : 'bg-slate-800'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
