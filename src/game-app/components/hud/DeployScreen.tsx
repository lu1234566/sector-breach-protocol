import { motion } from 'motion/react';

export function DeployScreen({ onDeploy }: { onDeploy: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDeploy}
      className="absolute inset-0 z-[110] flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm cursor-pointer select-none"
    >
      <div className="text-center">
        <div className="text-[10px] tracking-[0.5em] text-cyan-400/80 uppercase mb-3">
          Arena Combat Protocol
        </div>
        <div className="text-5xl md:text-6xl font-black tracking-tighter mb-2">
          <span className="text-white">PROTOCOL</span>
          <span className="ml-2 bg-gradient-to-r from-cyan-300 to-fuchsia-400 bg-clip-text text-transparent">
            DOC
          </span>
        </div>
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="mt-6 text-cyan-300 font-black text-xs tracking-[0.4em] uppercase"
        >
          Click to Deploy
        </motion.div>
      </div>

      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl px-6 text-[10px] uppercase tracking-widest">
        {[
          ['WASD', 'Move'],
          ['Mouse', 'Aim'],
          ['LMB', 'Fire'],
          ['RMB / C', 'ADS'],
          ['R', 'Reload'],
          ['Shift', 'Sprint'],
          ['1-4', 'Weapons'],
          ['ESC', 'Pause'],
        ].map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between gap-2 bg-slate-900/60 border border-cyan-500/15 rounded px-3 py-2"
          >
            <span className="font-mono font-bold text-cyan-300">{k}</span>
            <span className="text-slate-400">{v}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
