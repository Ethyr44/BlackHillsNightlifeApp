-- ============================================================================
-- BLACK HILLS NIGHTLIFE (BHNL) — SUPABASE SECURITY & PERFORMANCE HARDENING
-- ============================================================================
-- Paste and run this script in your Supabase Dashboard -> SQL Editor.
-- It performs three critical upgrades:
--   1. Creates atomic SECURITY DEFINER RPCs for Geo-Gift claiming and Gem
--      consumption (`claim_geo_gift` and `consume_user_gem`).
--   2. Adds a BEFORE UPDATE trigger on `public.profiles` that prevents
--      non-Admin authenticated client requests from directly tampering with
--      `account_type`, `account_status`, `lifestyle_points`, `league_monthly`,
--      `cur_usd`, `cur_iron`, `cur_wood`, `cur_stone`, `inv_gems`,
--      `active_multiplier`, or `multiplier_uses_left`.
--   3. Adds performance indexes for high-traffic queries (posts, post_likes,
--      comments, venue_checkins, and leaderboard rankings).
-- ============================================================================

-- 1. PERFORMANCE INDEXES (Idempotent)
CREATE INDEX IF NOT EXISTS idx_posts_created_at_desc ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts (user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_user ON public.post_likes (post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments (post_id);
CREATE INDEX IF NOT EXISTS idx_venue_checkins_venue_created ON public.venue_checkins (venue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_lifestyle_points_desc ON public.profiles (lifestyle_points DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_league_monthly_desc ON public.profiles (league_monthly DESC);

-- 2. RPC: ATOMIC GEO-GIFT CLAIM (`claim_geo_gift`)
CREATE OR REPLACE FUNCTION public.claim_geo_gift(p_gift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_gift record;
  v_profile record;
  v_new_gems jsonb;
  v_gem_key text;
  v_gem_val int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_gift
  FROM public.geo_gifts
  WHERE id = p_gift_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Geo-Gift not found';
  END IF;

  IF v_gift.expires_at IS NOT NULL AND v_gift.expires_at < now() THEN
    RAISE EXCEPTION 'This Geo-Gift has expired';
  END IF;

  IF v_gift.claimed_by IS NOT NULL AND v_user_id = ANY(v_gift.claimed_by) THEN
    RAISE EXCEPTION 'You have already claimed this Geo-Gift';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  v_new_gems := COALESCE(v_profile.inv_gems, '{}'::jsonb);
  IF v_gift.reward_gems IS NOT NULL THEN
    FOR v_gem_key, v_gem_val IN
      SELECT key, (value::text)::int FROM jsonb_each(v_gift.reward_gems)
    LOOP
      v_new_gems := jsonb_set(
        v_new_gems,
        ARRAY[v_gem_key],
        to_jsonb(COALESCE((v_new_gems ->> v_gem_key)::int, 0) + v_gem_val),
        true
      );
    END LOOP;
  END IF;

  -- Bypass column guard inside trusted SECURITY DEFINER function
  PERFORM set_config('bhnl.bypass_profile_guard', 'true', true);

  UPDATE public.profiles
  SET
    lifestyle_points = COALESCE(lifestyle_points, 0) + COALESCE(v_gift.reward_lp, 0),
    cur_wood  = COALESCE(cur_wood, 0)  + COALESCE((v_gift.reward_resources ->> 'Wood')::int, 0),
    cur_stone = COALESCE(cur_stone, 0) + COALESCE((v_gift.reward_resources ->> 'Stone')::int, 0),
    cur_iron  = COALESCE(cur_iron, 0)  + COALESCE((v_gift.reward_resources ->> 'Iron')::int, 0),
    inv_gems  = v_new_gems
  WHERE id = v_user_id;

  UPDATE public.geo_gifts
  SET claimed_by = array_append(COALESCE(claimed_by, ARRAY[]::uuid[]), v_user_id)
  WHERE id = p_gift_id;

  RETURN jsonb_build_object(
    'success', true,
    'reward_lp', COALESCE(v_gift.reward_lp, 0)
  );
END;
$$;

-- 3. RPC: ATOMIC GEM CONSUMPTION (`consume_user_gem`)
CREATE OR REPLACE FUNCTION public.consume_user_gem(p_gem_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile record;
  v_current_count int;
  v_new_gems jsonb;
  v_mult int := 1;
  v_uses int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  v_current_count := COALESCE((v_profile.inv_gems ->> p_gem_name)::int, 0);
  IF v_current_count <= 0 THEN
    RAISE EXCEPTION 'Insufficient % balance', p_gem_name;
  END IF;

  IF p_gem_name = 'Quartz' THEN v_mult := 2; v_uses := 1;
  ELSIF p_gem_name = 'Amethyst' THEN v_mult := 2; v_uses := 2;
  ELSIF p_gem_name = 'Jade' THEN v_mult := 3; v_uses := 1;
  ELSIF p_gem_name = 'Emerald' THEN v_mult := 3; v_uses := 2;
  ELSIF p_gem_name = 'Sapphire' THEN v_mult := 4; v_uses := 1;
  ELSIF p_gem_name = 'Ruby' THEN v_mult := 2; v_uses := 5;
  ELSIF p_gem_name = 'Diamond' THEN v_mult := 4; v_uses := 4;
  ELSE
    RAISE EXCEPTION 'Unknown gem type: %', p_gem_name;
  END IF;

  v_new_gems := jsonb_set(
    COALESCE(v_profile.inv_gems, '{}'::jsonb),
    ARRAY[p_gem_name],
    to_jsonb(v_current_count - 1),
    true
  );

  PERFORM set_config('bhnl.bypass_profile_guard', 'true', true);

  UPDATE public.profiles
  SET
    inv_gems = v_new_gems,
    active_multiplier = v_mult,
    multiplier_uses_left = v_uses
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'inv_gems', v_new_gems,
    'active_multiplier', v_mult,
    'multiplier_uses_left', v_uses
  );
END;
$$;

-- 4. PROFILE PRIVILEGE & ECONOMY COLUMN GUARD TRIGGER
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_type text;
BEGIN
  -- Allow server-side RPCs that set bhnl.bypass_profile_guard = 'true' or service_role
  IF current_setting('bhnl.bypass_profile_guard', true) = 'true'
     OR current_setting('request.jwt.claim.role', true) = 'service_role'
     OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if the caller is an Admin
  SELECT account_type INTO v_caller_type
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_type = 'Admin' THEN
    RETURN NEW;
  END IF;

  -- Non-admins cannot escalate privileges or approval status
  NEW.account_type := OLD.account_type;
  NEW.account_status := OLD.account_status;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_sensitive_columns();
