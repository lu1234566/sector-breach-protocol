import { DIFFICULTIES, type DifficultyKey } from '@/game-app/game/constants';

export function WavePanel({
  wave,
  difficulty,
}: {
  wave: number;
  difficulty: DifficultyKey;
}) {
  return (
    <div className="pointer-events-none absolute top-4 left-4 z-40 flex items-center gap-2">
      <div className="bg-slate-950/70 backdrop-blur-md border border-cyan-500/30 rounded-sm px-2.5 py-1">
        <div className="text-[8px] font-bold tracking-[0.3em] text-cyan-300/80 uppercase leading-none">
          Wave
        </div>
        <div className="font-mono font-black text-sm text-white leading-tight">
          {wave}
          <span className="text-slate-500 text-[10px]">/5</span>
        </div>
      </div>
      <div
        className="bg-slate-950/60 backdrop-blur-md border rounded-sm px-2 py-1 text-[9px] font-black tracking-[0.25em] uppercase"
        style={{
          borderColor: `${DIFFICULTIES[difficulty].color}55`,
          color: DIFFICULTIES[difficulty].color,
        }}
      >
        {DIFFICULTIES[difficulty].name}
      </div>
    </div>
  );
}
