import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabaseForUser";

export default defineTool({
  name: "list_recent_runs",
  title: "List recent runs",
  description:
    "Return the operator's most recent completed runs (default 10, max 50). Each row includes arena, difficulty, mode, wave reached, kills, credits earned, outcome, and timestamp.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many runs to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("player_runs")
      .select("arena,difficulty,mode,wave_reached,kills,credits_earned,outcome,created_at")
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const runs = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(runs) }],
      structuredContent: { runs },
    };
  },
});
