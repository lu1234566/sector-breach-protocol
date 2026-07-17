# Add OAuth-protected MCP server to Protocol DOC

You chose "Protected with OAuth" for MCP access. The app currently has no user accounts and stores all progress in browser localStorage, so this needs three layers built together: accounts, server-side player data, and the MCP server itself.

## What ships

1. **Lovable Cloud + accounts** — email/password + Google sign-in, a `profiles` table, and an `_authenticated` route gate.
2. **Player data mirrored server-side** — new `player_stats` and `player_runs` tables (lifetime stats + per-run history), RLS-scoped to the signed-in user. LocalStorage keeps working offline; when signed in, stats sync up on run end.
3. **Managed OAuth 2.1 authorization server** activated via `supabase--configure_oauth_server`, plus the consent route at `src/routes/[.]lovable.oauth.consent.tsx` that preserves `authorization_id` through login/signup/Google.
4. **MCP server at `/mcp`** using `@lovable.dev/mcp-js`, verifying Supabase bearer tokens (`auth.oauth.issuer`, issuer built from `VITE_SUPABASE_PROJECT_ID`).
5. **Tools exposed** (each acts as the signed-in user via RLS):
   - `get_lifetime_stats` — kills, deaths, wins, best wave, best endless wave, total credits.
   - `list_recent_runs` — last N runs with wave reached, arena, difficulty, kills, outcome.
   - `get_leaderboard_position` — user's rank on best endless wave (reads a public view).
   - `get_arena_catalog` — static arena metadata (read-only, no user data).
6. A simple favicon so connector clients show a proper icon.

## Not in scope

- Rewriting the game loop or moving live gameplay server-side. Only end-of-run summaries sync.
- Write/mutation tools (grant credits, reset progress). Read-only first; we can add mutations later behind `destructiveHint`.
- Migrating existing local progress into new accounts — first sign-in starts fresh server-side; local save keeps working.

## Technical notes

- `src/lib/mcp/index.ts` + one file per tool under `src/lib/mcp/tools/`. `mcpPlugin()` added to `vite.config.ts`; do not hand-write `src/routes/mcp.ts`.
- Issuer: `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/auth/v1`, `acceptedAudiences: "authenticated"`.
- Tool handlers build a per-request Supabase client with `Authorization: Bearer ${ctx.getToken()}` so RLS runs as the caller.
- New migration creates `profiles`, `player_stats`, `player_runs` with GRANTs to `authenticated` + `service_role` and RLS policies scoped to `auth.uid()`.
- Run-end sync: a `createServerFn` (`recordRun`) writes to `player_runs` and upserts `player_stats` when a session is present; unauthenticated play keeps using localStorage only.
- Consent route uses `supabase.auth.oauth` and forwards `next` through email/password, signup `emailRedirectTo`, and Google `redirect_uri`.
- After edits: run `app_mcp_server--extract_mcp_manifest` to validate.

## Confirm before I build

Two things worth flagging:

- **Adding accounts changes the game's UX** (menu now needs Sign in / Continue as guest). OK to add?
- **Tool set above** — is read-only lifetime stats + run history + leaderboard the right first cut, or do you want different tools (e.g. "start a run from a chat command", "grant credits")?
