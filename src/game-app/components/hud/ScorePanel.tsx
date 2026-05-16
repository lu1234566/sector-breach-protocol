import { Skull } from 'lucide-react';

export function ScorePanel({ score, kills }: { score: number; kills: number }) {
  return (
    <div className="pointer-events-none absolute top-4 right-4 z-40 flex items-center gap-2 bg-slate-950/70 backdrop-blur-md border border-slate-700/60 rounded-sm px-2.5 py-1">
      <div className="flex flex-col items-end">
        <div className="text-[8px] font-bold tracking-[0.3em] text-amber-400/80 uppercase leading-none">
          Score
        </div>
        <div className="font-mono font-black text-sm text-white tabular-nums leading-tight">
          {score.toLocaleString()}
        </div>
      </div>
      <div className="w-px h-6 bg-slate-700/60" />
      <div className="flex items-center gap-1">
        <Skull size={11} className="text-red-400/80" />
        <span className="font-mono font-black text-sm text-white tabular-nums">{kills}</span>
      </div>
    </div>
  );
}
