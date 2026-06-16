// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import { useThree, useFrame } from "@react-three/fiber";

/**
 * Tiny perf probe. Mounted inside the Canvas so it can read renderer.info
 * (draw calls / triangles) directly. Reports back to the parent via callback
 * at most 4× per second, so the DOM panel only re-renders a handful of times
 * per second even at 60 FPS.
 */
export function PerfProbe({
  onSample,
}: {
  onSample: (s: { fps: number; calls: number; triangles: number }) => void;
}) {
  const { gl } = useThree();
  const frames = useRef(0);
  const last = useRef(performance.now());

  useFrame(() => {
    frames.current++;
    const now = performance.now();
    const elapsed = now - last.current;
    if (elapsed >= 250) {
      const fps = (frames.current * 1000) / elapsed;
      const info = (gl as any).info?.render ?? { calls: 0, triangles: 0 };
      onSample({ fps, calls: info.calls | 0, triangles: info.triangles | 0 });
      frames.current = 0;
      last.current = now;
    }
  });

  return null;
}

interface PerfHudProps {
  enemies: number;
  particles: number;
  qualityTier: string;
  paused: boolean;
  sample: { fps: number; calls: number; triangles: number } | null;
}

/** DOM overlay sibling of the Canvas. Cheap; only re-renders when sample updates. */
export function PerfHud({ enemies, particles, qualityTier, paused, sample }: PerfHudProps) {
  const fps = sample?.fps ?? 0;
  const color = fps >= 45 ? "#4ade80" : fps >= 28 ? "#fbbf24" : "#f87171";
  return (
    <div className="pointer-events-none absolute top-2 left-2 z-[150] font-mono text-[10px] leading-tight bg-slate-950/80 border border-cyan-500/30 rounded px-2 py-1.5 text-cyan-100/90 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-[9px] tracking-widest uppercase text-cyan-400/70">PERF</span>
        <span style={{ color }} className="font-bold">
          {fps.toFixed(0)} fps
        </span>
        {paused && <span className="text-amber-400/90">[paused]</span>}
      </div>
      <div>calls {sample?.calls ?? 0}</div>
      <div>tris {((sample?.triangles ?? 0) / 1000).toFixed(1)}k</div>
      <div>enemies {enemies}</div>
      <div>parts {particles}</div>
      <div className="text-cyan-400/60 uppercase tracking-wider">q:{qualityTier}</div>
    </div>
  );
}

/** Reads perf overlay flag (?perf=1 or localStorage sbp_perf=1). */
export function usePerfHudEnabled(): boolean {
  const [on, setOn] = useState(() => {
    if (typeof window === "undefined") return false;
    if (new URLSearchParams(window.location.search).get("perf") === "1") return true;
    try {
      return localStorage.getItem("sbp_perf") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      // F9 toggles the perf overlay at runtime.
      if (e.key === "F9") {
        setOn((v) => {
          const next = !v;
          try {
            localStorage.setItem("sbp_perf", next ? "1" : "0");
          } catch {}
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return on;
}
