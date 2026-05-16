import { motion } from 'motion/react';

interface Props {
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export function PauseMenu({ onResume, onRestart, onExit }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[120] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md"
    >
      <div className="text-[10px] tracking-[0.5em] text-cyan-400/80 uppercase mb-2">
        Protocol Suspended
      </div>
      <h2 className="text-5xl font-black tracking-tighter text-white mb-10 uppercase italic">
        Paused
      </h2>
      <div className="flex flex-col gap-2 w-64">
        <button
          onClick={onResume}
          className="py-3 rounded-md bg-cyan-400 text-slate-950 font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition-transform"
        >
          Resume
        </button>
        <button
          onClick={onRestart}
          className="py-3 rounded-md bg-slate-800/70 border border-cyan-500/20 text-white font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-colors"
        >
          Restart Mission
        </button>
        <button
          disabled
          className="py-3 rounded-md bg-slate-900/50 border border-slate-700/50 text-slate-600 font-black uppercase tracking-widest text-xs cursor-not-allowed"
        >
          Settings
        </button>
        <button
          onClick={onExit}
          className="py-3 rounded-md bg-slate-900/50 border border-red-500/30 text-red-400 font-black uppercase tracking-widest text-xs hover:bg-red-500/10 transition-colors"
        >
          Exit to Menu
        </button>
      </div>
      <div className="mt-8 text-[10px] text-slate-500 tracking-widest uppercase">
        Press ESC to resume
      </div>
    </motion.div>
  );
}
