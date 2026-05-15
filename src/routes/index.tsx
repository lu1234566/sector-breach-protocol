import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";

const GameApp = lazy(() => import("@/game-app/GameApp"));

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "DOC — Tactical Wave Shooter" },
      {
        name: "description",
        content:
          "DOC: a fast, tactical 3D wave shooter. Survive procedural waves, upgrade your arsenal, and climb the leaderboard.",
      },
      { property: "og:title", content: "DOC — Tactical Wave Shooter" },
      {
        property: "og:description",
        content:
          "Fast, tactical 3D wave shooter. Survive, upgrade, dominate.",
      },
    ],
  }),
});

function Index() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-emerald-400 font-mono">
        <div className="text-center">
          <div className="text-2xl tracking-[0.3em]">DOC</div>
          <div className="mt-2 text-xs opacity-60">BOOTING TACTICAL UPLINK…</div>
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
