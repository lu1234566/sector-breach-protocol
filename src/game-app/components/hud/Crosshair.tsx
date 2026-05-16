interface Props {
  isAds: boolean;
  recentShot: boolean;
}

export function Crosshair({ isAds, recentShot }: Props) {
  if (isAds) {
    return (
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
        <div className="w-1 h-1 rounded-full bg-cyan-300/80 shadow-[0_0_4px_rgba(34,211,238,0.9)]" />
      </div>
    );
  }
  const spread = recentShot ? 8 : 5;
  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
      <div className="relative w-6 h-6 flex items-center justify-center">
        <div className="w-[2px] h-[2px] rounded-full bg-cyan-300" />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-[6px] h-[1px] bg-cyan-300/80 transition-all"
          style={{ left: `calc(50% - ${spread + 6}px)` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-[6px] h-[1px] bg-cyan-300/80 transition-all"
          style={{ right: `calc(50% - ${spread + 6}px)` }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 w-[1px] h-[6px] bg-cyan-300/80 transition-all"
          style={{ top: `calc(50% - ${spread + 6}px)` }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 w-[1px] h-[6px] bg-cyan-300/80 transition-all"
          style={{ bottom: `calc(50% - ${spread + 6}px)` }}
        />
      </div>
    </div>
  );
}
