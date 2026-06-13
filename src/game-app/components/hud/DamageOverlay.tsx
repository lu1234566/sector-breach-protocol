import { useEffect, useReducer } from "react";
import { motion } from "motion/react";
import type { DamageIndicator } from "@/game-app/game/types";

interface Props {
  indicators: DamageIndicator[];
  hp: number;
  lastDamageTime: number;
  hitMarker: { time: number; killed: boolean };
}

export function DamageOverlay({ indicators, hp, lastDamageTime, hitMarker }: Props) {
  const now = Date.now();
  const [, forceExpire] = useReducer((n: number) => n + 1, 0);

  // The damage flash / hit marker are time-windowed at render. The app only
  // re-renders on real events now, so schedule one extra render to clear
  // them once the window passes.
  useEffect(() => {
    const remain = 130 - (Date.now() - Math.max(lastDamageTime, hitMarker.time));
    if (remain > 0) {
      const t = setTimeout(forceExpire, remain + 16);
      return () => clearTimeout(t);
    }
  }, [lastDamageTime, hitMarker.time, hitMarker]);
  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
      {indicators.map((ind) => {
        const deg = (ind.angle * 180) / Math.PI;
        const op = Math.max(0, Math.min(1, ind.opacity));
        return (
          <div
            key={ind.id}
            className="absolute top-1/2 left-1/2"
            style={{
              width: "140vmax",
              height: "140vmax",
              transform: `translate(-50%, -50%) rotate(${deg}deg)`,
              opacity: op * 0.85,
            }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "conic-gradient(from 320deg at 50% 50%, transparent 0deg, rgba(220,38,38,0) 30deg, rgba(220,38,38,0.55) 40deg, rgba(248,113,113,0.85) 50deg, rgba(220,38,38,0.55) 60deg, rgba(220,38,38,0) 70deg, transparent 360deg)",
                WebkitMaskImage:
                  "radial-gradient(circle at 50% 50%, transparent 36%, black 50%, black 60%, transparent 70%)",
                maskImage:
                  "radial-gradient(circle at 50% 50%, transparent 36%, black 50%, black 60%, transparent 70%)",
                filter: "blur(6px)",
              }}
            />
          </div>
        );
      })}
      {hp < 30 && <div className="absolute inset-0 bg-red-600/5 animate-pulse" />}
      {now - lastDamageTime < 100 && (
        <div
          className="absolute inset-0 transition-opacity"
          style={{
            background: `radial-gradient(circle, transparent 40%, rgba(220, 38, 38, ${0.12 * (1 - (now - lastDamageTime) / 100)}) 100%)`,
          }}
        />
      )}
      {now - hitMarker.time < 120 && (
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1.1, opacity: 1 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <div className="relative w-7 h-7">
            {(
              [
                ["top-0 left-0 origin-left rotate-45"],
                ["top-0 right-0 origin-right -rotate-45"],
                ["bottom-0 left-0 origin-left -rotate-45"],
                ["bottom-0 right-0 origin-right rotate-45"],
              ] as const
            ).map((cls, i) => (
              <div
                key={i}
                className={`absolute ${cls[0]} w-2.5 h-[1.5px] ${
                  hitMarker.killed
                    ? "bg-red-500 shadow-[0_0_8px_red]"
                    : "bg-cyan-300 shadow-[0_0_8px_cyan]"
                }`}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
