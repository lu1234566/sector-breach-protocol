import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";

const GameApp = lazy(() => import("@/game-app/GameApp"));

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Protocol DOC — Neon Arena Shooter" },
      {
        name: "description",
        content:
          "Protocol DOC: a fast neon arena shooter. Survive escalating waves, chain kills, and break the leaderboard.",
      },
      { property: "og:title", content: "Protocol DOC — Neon Arena Shooter" },
      {
        property: "og:description",
        content:
          "Neon arena combat. Survive the waves. Break the protocol.",
      },
    ],
  }),
});

function Index() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black font-mono">
        <div className="text-center">
          <div className="text-2xl tracking-[0.3em]">
            <span className="text-white">PROTOCOL</span>
            <span className="ml-2 bg-gradient-to-r from-cyan-300 to-fuchsia-400 bg-clip-text text-transparent">DOC</span>
          </div>
          <div className="mt-2 text-xs text-cyan-400/70">BOOTING ARENA UPLINK…</div>
        </div>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-emerald-400 font-mono">
          <div className="text-center">
            <div className="text-2xl tracking-[0.3em] animate-pulse">DOC</div>
            <div className="mt-2 text-xs opacity-60">LOADING ASSETS…</div>
          </div>
        </div>
      }
    >
      <GameApp />
    </Suspense>
  );
}
