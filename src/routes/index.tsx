import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
        content: "Neon arena combat. Survive the waves. Break the protocol.",
      },
    ],
  }),
});

function AuthPill() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="fixed top-3 right-3 z-[200] font-mono">
      {email ? (
        <div className="flex items-center gap-2 rounded-full border border-cyan-500/30 bg-slate-950/80 backdrop-blur px-3 py-1.5 text-[10px] uppercase tracking-widest">
          <span className="text-cyan-300 truncate max-w-[180px]">{email}</span>
          <button onClick={signOut} className="text-slate-400 hover:text-cyan-300">
            sign out
          </button>
        </div>
      ) : (
        <Link
          to="/auth"
          search={{ next: "/" }}
          className="inline-flex items-center gap-1 rounded-full border border-cyan-500/40 bg-slate-950/80 backdrop-blur px-3 py-1.5 text-[10px] uppercase tracking-widest text-cyan-300 hover:border-cyan-300 hover:text-white"
        >
          Sign in
        </Link>
      )}
    </div>
  );
}

function Index() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black font-mono">
        <div className="text-center">
          <div className="text-2xl tracking-[0.3em]">
            <span className="text-white">PROTOCOL</span>
            <span className="ml-2 bg-gradient-to-r from-cyan-300 to-fuchsia-400 bg-clip-text text-transparent">
              DOC
            </span>
          </div>
          <div className="mt-2 text-xs text-cyan-400/70">BOOTING ARENA UPLINK…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AuthPill />
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-black font-mono">
            <div className="text-center">
              <div className="text-2xl tracking-[0.3em] animate-pulse">
                <span className="text-white">PROTOCOL</span>
                <span className="ml-2 bg-gradient-to-r from-cyan-300 to-fuchsia-400 bg-clip-text text-transparent">
                  DOC
                </span>
              </div>
              <div className="mt-2 text-xs text-cyan-400/70">LOADING ARENA…</div>
            </div>
          </div>
        }
      >
        <GameApp />
      </Suspense>
    </>
  );
}
