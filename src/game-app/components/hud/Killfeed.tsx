import { AnimatePresence, motion } from 'motion/react';
import type { KillfeedItem } from '@/game-app/game/types';

export function Killfeed({ items }: { items: KillfeedItem[] }) {
  return (
    <div className="pointer-events-none absolute top-16 right-4 z-30 flex flex-col items-end gap-1 font-mono text-[10px] font-bold">
      <AnimatePresence>
        {items.map((kill, i) => (
          <motion.div
            key={kill.id}
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 - i * 0.18 }}
            exit={{ opacity: 0 }}
            className="bg-slate-950/70 px-2 py-0.5 rounded-sm border-r-2 border-red-500/80 text-white/90 uppercase tracking-wider"
          >
            {kill.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
