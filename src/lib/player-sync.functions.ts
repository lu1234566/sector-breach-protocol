import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RunInput = z.object({
  arena: z.string().min(1).max(64),
  difficulty: z.string().min(1).max(32),
  mode: z.enum(["campaign", "endless"]).default("campaign"),
  wave_reached: z.number().int().min(0).max(10000),
  kills: z.number().int().min(0).max(100000),
  credits_earned: z.number().int().min(0).max(10000000),
  outcome: z.enum(["victory", "defeat"]),
});

/**
 * Record a completed run and roll it into the player's lifetime stats.
 * Called at end-of-run when the user is signed in; unauthenticated play
 * keeps using localStorage only.
 */
export const recordRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RunInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error: insertErr } = await supabase.from("player_runs").insert({
      user_id: userId,
      arena: data.arena,
      difficulty: data.difficulty,
      mode: data.mode,
      wave_reached: data.wave_reached,
      kills: data.kills,
      credits_earned: data.credits_earned,
      outcome: data.outcome,
    });
    if (insertErr) throw new Error(insertErr.message);

    const { data: existing } = await supabase
      .from("player_stats")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const next = {
      user_id: userId,
      total_kills: (existing?.total_kills ?? 0) + data.kills,
      total_deaths: (existing?.total_deaths ?? 0) + (data.outcome === "defeat" ? 1 : 0),
      total_wins: (existing?.total_wins ?? 0) + (data.outcome === "victory" ? 1 : 0),
      total_games: (existing?.total_games ?? 0) + 1,
      total_credits: (existing?.total_credits ?? 0) + data.credits_earned,
      best_wave:
        data.mode === "campaign"
          ? Math.max(existing?.best_wave ?? 0, data.wave_reached)
          : (existing?.best_wave ?? 0),
      best_endless_wave:
        data.mode === "endless"
          ? Math.max(existing?.best_endless_wave ?? 0, data.wave_reached)
          : (existing?.best_endless_wave ?? 0),
    };

    const { error: upsertErr } = await supabase
      .from("player_stats")
      .upsert(next, { onConflict: "user_id" });
    if (upsertErr) throw new Error(upsertErr.message);

    return { ok: true };
  });
