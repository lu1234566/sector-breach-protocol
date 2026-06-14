import { motion } from "motion/react";

interface Props {
  bossHp: { current: number; max: number };
}

export function BossHealthBar({ bossHp }: Props) {
  const pct = Math.max(0, Math.min(100, (bossHp.current / Math.max(1, bossHp.max)) * 100));
  return (
    <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 w-72 z-40">
      <div className="flex justify-between items-end mb-1">
        <span className="text-red-400 font-black text-[10px] uppercase tracking-widest">
          Sector Guardian
        </span>
        <span className="text-white/80 font-mono text-[9px]">
          {Math.max(0, Math.ceil(bossHp.current))} / {bossHp.max}
        </span>
      </div>
      <div className="h-1.5 bg-slate-900/80 rounded-sm border border-red-500/30 overflow-hidden">
        <motion.div
          animate={{ width: `${pct}%` }}
          className="h-full bg-gradient-to-r from-red-600 to-rose-400 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
        />
      </div>
    </div>
  );
}
