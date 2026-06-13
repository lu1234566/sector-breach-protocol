// @ts-nocheck
import React, { useEffect, useRef } from "react";

/**
 * Full-screen sniper scope overlay.
 * Pure CSS — no canvas/3D cost. ADS progress is read from the player ref via
 * rAF and applied imperatively (display/opacity), so the fade-in works
 * without any React re-render.
 */
export function SniperScope({ playerRef }: { playerRef: React.MutableRefObject<any> }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const progress = playerRef.current?.adsProgress ?? 0;
      const el = rootRef.current;
      if (el) {
        if (progress <= 0.05) {
          el.style.display = "none";
        } else {
          el.style.display = "block";
          el.style.opacity = String(Math.min(1, progress * 1.4));
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playerRef]);

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 pointer-events-none z-[55] overflow-hidden"
      style={{ display: "none", opacity: 0 }}
    >
      {/* Black mask with circular cutout */}
      <div
        className="absolute inset-0 bg-black"
        style={{
          WebkitMaskImage:
            "radial-gradient(circle at 50% 50%, transparent 0, transparent 38%, black 41%)",
          maskImage:
            "radial-gradient(circle at 50% 50%, transparent 0, transparent 38%, black 41%)",
        }}
      />

      {/* Inner subtle vignette tint */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(34,211,238,0.04) 0%, rgba(34,211,238,0.08) 30%, transparent 38%)",
        }}
      />

      {/* Scope ring */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-400/70"
        style={{
          width: "76vmin",
          height: "76vmin",
          boxShadow: "0 0 30px rgba(34,211,238,0.45), inset 0 0 60px rgba(34,211,238,0.15)",
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/30"
        style={{ width: "78vmin", height: "78vmin" }}
      />

      {/* Crosshair lines (clipped to circle area via overflow) */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: "76vmin", height: "76vmin" }}
      >
        {/* Horizontal hairline */}
        <div
          className="absolute top-1/2 left-0 right-0 -translate-y-1/2 bg-cyan-300/80"
          style={{ height: "1px", boxShadow: "0 0 4px rgba(34,211,238,0.8)" }}
        />
        {/* Vertical hairline */}
        <div
          className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 bg-cyan-300/80"
          style={{ width: "1px", boxShadow: "0 0 4px rgba(34,211,238,0.8)" }}
        />
        {/* Mil-dots vertical */}
        {[-3, -2, -1, 1, 2, 3].map((i) => (
          <div
            key={`v${i}`}
            className="absolute left-1/2 -translate-x-1/2 bg-cyan-300/90"
            style={{
              top: `${50 + i * 5}%`,
              width: "6px",
              height: "1px",
              boxShadow: "0 0 4px rgba(34,211,238,0.9)",
            }}
          />
        ))}
        {/* Mil-dots horizontal */}
        {[-3, -2, -1, 1, 2, 3].map((i) => (
          <div
            key={`h${i}`}
            className="absolute top-1/2 -translate-y-1/2 bg-cyan-300/90"
            style={{
              left: `${50 + i * 5}%`,
              height: "6px",
              width: "1px",
              boxShadow: "0 0 4px rgba(34,211,238,0.9)",
            }}
          />
        ))}
        {/* Center pip */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-fuchsia-400 rounded-full"
          style={{ width: "3px", height: "3px", boxShadow: "0 0 6px rgba(232,121,249,0.95)" }}
        />
      </div>

      {/* Range marks (top-left readout) */}
      <div className="absolute top-6 left-6 text-cyan-300 font-mono text-[10px] tracking-widest uppercase opacity-80">
        <div>SCOPE · 6x</div>
        <div className="text-cyan-400/60">RNG-LOCK</div>
      </div>
      <div className="absolute bottom-6 right-6 text-cyan-300 font-mono text-[10px] tracking-widest uppercase opacity-80 text-right">
        <div>STAB · OK</div>
        <div className="text-fuchsia-400/70">PROTOCOL DOC</div>
      </div>
    </div>
  );
}
