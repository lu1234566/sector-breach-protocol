import { Shield } from 'lucide-react';
import { motion } from 'motion/react';

export function HealthPanel({ hp }: { hp: number }) {
  const low = hp < 30;
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-40 w-52">
      <div className="flex items-center justify-between mb-1 text-[10px] font-bold tracking-[0.25em] uppercase">
        <div className="flex items-center gap-1.5 text-cyan-300/90">
          <Shield size={11} className={low ? 'text-red-500 animate-pulse' : ''} />
          <span>Integrity</span>
        </div>
        <span className={`font-mono ${low ? 'text-red-400' : 'text-white'}`}>
          {Math.round(hp)}%
        </span>
      </div>
      <div className="h-2 rounded-sm bg-slate-900/70 border border-cyan-500/20 overflow-hidden backdrop-blur-sm">
        <motion.div
          animate={{ width: `${Math.max(0, hp)}%` }}
          transition={{ duration: 0.2 }}
          className={`h-full ${
            low
              ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]'
              : 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]'
          }`}
        />
      </div>
    </div>
  );
}
