import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AuthorizationDetails {
  client?: { name?: string; redirect_uri?: string; scope?: string };
  redirect_url?: string;
  redirect_to?: string;
}

// Beta namespace — supabase.auth.oauth isn't in the public types yet.
interface OAuthNamespace {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: Error | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: Error | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: Error | null }>;
}
function oauthApi(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Session lives in localStorage — SSR would always redirect signed-in users to /auth.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6 font-mono">
      <div className="max-w-md text-center">
        <div className="text-[10px] tracking-[0.5em] text-rose-400/80 uppercase mb-2">
          Authorization error
        </div>
        <p className="text-sm text-slate-300">
          Could not load this authorization request: {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-4 font-mono">
      <div className="w-full max-w-md border border-cyan-500/30 rounded-md p-6 bg-slate-900/70 backdrop-blur">
        <div className="text-[10px] tracking-[0.5em] text-cyan-400/80 uppercase mb-2">
          Authorize connection
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white uppercase italic mb-4">
          Connect {clientName} to Protocol DOC
        </h1>
        <p className="text-sm text-slate-300 mb-6">
          This lets {clientName} use Protocol DOC as you — read your career stats, run history, and
          leaderboard rank.
        </p>
        <p className="text-[11px] text-slate-500 mb-6">
          This does not bypass Protocol DOC's permissions or backend policies.
        </p>
        {error && (
          <div className="text-[11px] text-rose-400 mb-3" role="alert">
            {error}
          </div>
        )}
        <div className="flex gap-3">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 py-2.5 rounded bg-cyan-400 text-slate-950 text-sm font-black uppercase tracking-widest hover:bg-cyan-300 disabled:opacity-60"
          >
            Approve
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 py-2.5 rounded border border-slate-600 text-slate-300 text-sm font-bold uppercase tracking-widest hover:border-slate-400 disabled:opacity-60"
          >
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}
