import { AnimatePresence, motion } from "motion/react";
import { WEAPONS, type WeaponType } from "@/game-app/game/constants";

const ORDER: WeaponType[] = ["pistol", "rifle", "shotgun", "sniper"];

export function WeaponSwitcherToast({
  currentWeapon,
  visible,
}: {
  currentWeapon: WeaponType;
  visible: boolean;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-slate-950/80 backdrop-blur-md border border-cyan-500/25 rounded-md px-3 py-1.5 font-mono text-[10px] tracking-widest"
        >
          {ORDER.map((w, i) => (
            <div key={w} className="flex items-center gap-1">
              {i > 0 && <span className="text-slate-600 mx-1">|</span>}
              <span
                className={`px-1.5 py-0.5 rounded-sm ${
                  w === currentWeapon ? "bg-cyan-400 text-slate-950 font-black" : "text-slate-400"
                }`}
              >
                {i + 1} {WEAPONS[w].name}
              </span>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
