import { useEffect, useRef, useState } from "react";

interface Props {
  playerRef: React.MutableRefObject<{ isAds: boolean }>;
  lastShotTimeRef: React.MutableRefObject<number>;
}

/**
 * Self-driven crosshair: ADS state and shot-spread come straight from the
 * game-loop refs via a small rAF poll, re-rendering only on transitions.
 * The app no longer re-renders 30x/s, so render-time sampling would go stale.
 */
export function Crosshair({ playerRef, lastShotTimeRef }: Props) {
  const [view, setView] = useState({ isAds: false, recentShot: false });
  const viewRef = useRef(view);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const isAds = !!playerRef.current?.isAds;
      const recentShot = Date.now() - (lastShotTimeRef.current ?? 0) < 90;
      if (isAds !== viewRef.current.isAds || recentShot !== viewRef.current.recentShot) {
        viewRef.current = { isAds, recentShot };
        setView(viewRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playerRef, lastShotTimeRef]);

  if (view.isAds) {
    return (
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
        <div className="w-1 h-1 rounded-full bg-cyan-300/80 shadow-[0_0_4px_rgba(34,211,238,0.9)]" />
      </div>
    );
  }
  const spread = view.recentShot ? 8 : 5;
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
