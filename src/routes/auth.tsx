import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : "",
  }),
  component: AuthPage,
});

function safeNext(next: string): string {
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/auth" });
  const dest = safeNext(next);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: dest, replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") navigate({ to: dest, replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [dest, navigate]);

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split("@")[0] },
            emailRedirectTo: `${window.location.origin}${dest}`,
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth?next=${encodeURIComponent(dest)}`,
      });
      if (result.error) throw result.error;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 font-mono">
      <div className="w-full max-w-sm border border-cyan-500/30 rounded-md p-6 bg-slate-900/70 backdrop-blur">
        <div className="text-[10px] tracking-[0.5em] text-cyan-400/80 uppercase mb-2">
          Operator Uplink
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white uppercase italic mb-6">
          {mode === "signup" ? "Register" : "Sign in"}
        </h1>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="w-full mb-4 py-2.5 rounded bg-white text-slate-900 text-sm font-bold uppercase tracking-widest hover:bg-slate-200 disabled:opacity-60"
        >
          Continue with Google
        </button>

        <div className="text-[10px] text-slate-500 uppercase tracking-widest text-center mb-4">
          or with email
        </div>

        <form onSubmit={handlePassword} className="flex flex-col gap-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Callsign"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-950 border border-cyan-500/30 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-950 border border-cyan-500/30 text-sm text-white focus:outline-none focus:border-cyan-400"
          />
          <input
            type="password"
            placeholder="Password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded bg-slate-950 border border-cyan-500/30 text-sm text-white focus:outline-none focus:border-cyan-400"
          />
          {error && (
            <div className="text-[11px] text-rose-400" role="alert">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded bg-cyan-400 text-slate-950 text-sm font-black uppercase tracking-widest hover:bg-cyan-300 disabled:opacity-60"
          >
            {busy ? "…" : mode === "signup" ? "Register" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="mt-4 w-full text-center text-[11px] text-cyan-400/70 hover:text-cyan-300 uppercase tracking-widest"
        >
          {mode === "signup" ? "Have an account? Sign in" : "New operator? Register"}
        </button>

        <a
          href={dest}
          className="mt-6 block text-center text-[10px] text-slate-500 hover:text-slate-300 uppercase tracking-widest"
        >
          Continue as guest
        </a>
      </div>
    </main>
  );
}
