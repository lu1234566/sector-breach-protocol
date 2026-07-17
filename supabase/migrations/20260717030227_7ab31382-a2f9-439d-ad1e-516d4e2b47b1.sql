-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles select own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Player stats (one row per user)
CREATE TABLE public.player_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_kills INT NOT NULL DEFAULT 0,
  total_deaths INT NOT NULL DEFAULT 0,
  total_wins INT NOT NULL DEFAULT 0,
  total_games INT NOT NULL DEFAULT 0,
  total_credits INT NOT NULL DEFAULT 0,
  best_wave INT NOT NULL DEFAULT 0,
  best_endless_wave INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_stats TO authenticated;
GRANT ALL ON public.player_stats TO service_role;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stats select own" ON public.player_stats FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "stats upsert own" ON public.player_stats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stats update own" ON public.player_stats FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Run history
CREATE TABLE public.player_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  arena TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'campaign',
  wave_reached INT NOT NULL DEFAULT 0,
  kills INT NOT NULL DEFAULT 0,
  credits_earned INT NOT NULL DEFAULT 0,
  outcome TEXT NOT NULL DEFAULT 'defeat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX player_runs_user_created_idx ON public.player_runs (user_id, created_at DESC);
CREATE INDEX player_runs_endless_wave_idx ON public.player_runs (mode, wave_reached DESC) WHERE mode = 'endless';
GRANT SELECT, INSERT ON public.player_runs TO authenticated;
GRANT ALL ON public.player_runs TO service_role;
ALTER TABLE public.player_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs select own" ON public.player_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "runs insert own" ON public.player_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Public leaderboard view (best endless wave per player)
CREATE VIEW public.endless_leaderboard
WITH (security_invoker = true)
AS
SELECT
  ps.user_id,
  ps.best_endless_wave,
  COALESCE(pr.display_name, 'Operator') AS display_name,
  ps.updated_at
FROM public.player_stats ps
LEFT JOIN public.profiles pr ON pr.id = ps.user_id
WHERE ps.best_endless_wave > 0;

GRANT SELECT ON public.endless_leaderboard TO authenticated;

-- Allow leaderboard visibility: authenticated users can see all rows in player_stats limited to endless wave column via a policy on base table
CREATE POLICY "stats select leaderboard" ON public.player_stats
  FOR SELECT TO authenticated
  USING (best_endless_wave > 0);

-- Allow reading other users' display_name for the leaderboard
CREATE POLICY "profiles select public displayname" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Auto-create profile + stats row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.player_stats (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_touch_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER player_stats_touch_updated BEFORE UPDATE ON public.player_stats
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();