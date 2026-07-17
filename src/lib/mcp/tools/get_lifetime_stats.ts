import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabaseForUser";

export default defineTool({
  name: "get_lifetime_stats",
  title: "Get lifetime stats",
  description:
    "Return the signed-in operator's career totals: kills, deaths, wins, games played, credits earned, best campaign wave, best endless wave.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("player_stats")
      .select(
        "total_kills,total_deaths,total_wins,total_games,total_credits,best_wave,best_endless_wave,updated_at",
      )
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const stats = data ?? {
      total_kills: 0,
      total_deaths: 0,
      total_wins: 0,
      total_games: 0,
      total_credits: 0,
      best_wave: 0,
      best_endless_wave: 0,
      updated_at: null,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(stats) }],
      structuredContent: stats,
    };
  },
});
