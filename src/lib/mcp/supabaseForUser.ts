import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Per-request Supabase client that acts as the caller (RLS applies).
 * Built inside each tool handler — never module-scoped, never admin.
 */
export function supabaseForUser(ctx: ToolContext) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const token = ctx.getToken();
  return createClient(url, key, {
    global: {
      // Opaque sb_publishable_ keys aren't JWTs; PostgREST rejects them as bearers.
      // Send the user's token as Authorization and the publishable key as apikey.
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}
