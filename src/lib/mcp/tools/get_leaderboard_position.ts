import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabaseForUser";

export default defineTool({
  name: "get_leaderboard_position",
  title: "Get leaderboard position",
  description:
    "Return the operator's rank on the global endless-mode leaderboard, plus the top 10 for context.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("endless_leaderboard")
      .select("user_id,display_name,best_endless_wave")
      .order("best_endless_wave", { ascending: false })
      .limit(500);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const rows = data ?? [];
    const uid = ctx.getUserId();
    const rank = rows.findIndex((r) => r.user_id === uid);
    const self = rows.find((r) => r.user_id === uid) ?? null;
    const top10 = rows.slice(0, 10).map((r, i) => ({
      rank: i + 1,
      display_name: r.display_name,
      best_endless_wave: r.best_endless_wave,
    }));
    const result = {
      your_rank: rank >= 0 ? rank + 1 : null,
      your_best_endless_wave: self?.best_endless_wave ?? 0,
      total_ranked_players: rows.length,
      top10,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
});
