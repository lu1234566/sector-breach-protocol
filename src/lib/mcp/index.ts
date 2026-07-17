import { auth, defineMcp } from "@lovable.dev/mcp-js";

import getLifetimeStats from "./tools/get_lifetime_stats";
import listRecentRuns from "./tools/list_recent_runs";
import getLeaderboardPosition from "./tools/get_leaderboard_position";
import getArenaCatalog from "./tools/get_arena_catalog";

// Direct Supabase host is required for the OAuth issuer (see app-mcp-server-authoring):
// process.env.SUPABASE_URL is rewritten to the .lovable.cloud proxy on publish, which
// breaks issuer verification. VITE_SUPABASE_PROJECT_ID is inlined at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "protocol-doc-mcp",
  title: "Protocol DOC — Arena Stats",
  version: "0.1.0",
  instructions:
    "Read-only tools for a Protocol DOC operator's arena history. Use `get_lifetime_stats` for career totals, `list_recent_runs` for recent runs, `get_leaderboard_position` for endless-mode ranking, and `get_arena_catalog` for static arena info.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getLifetimeStats, listRecentRuns, getLeaderboardPosition, getArenaCatalog],
});
