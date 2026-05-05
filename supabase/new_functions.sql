-- ============================================================
-- NEW SECURITY DEFINER FUNCTIONS
-- Run this in the Supabase SQL Editor.
-- These allow player-role users to complete tournaments and
-- update their own avatar without admin privileges.
-- ============================================================


-- Allow players to set/chain the tiebreaker on a tournament
CREATE OR REPLACE FUNCTION activate_tournament_tiebreaker(
  p_tournament_id uuid,
  p_player_ids    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_player_or_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE tournaments
  SET
    tiebreaker_players     = p_player_ids,
    tiebreaker_activated_at = NOW()
  WHERE id = p_tournament_id
    AND completed = false;
END;
$$;


-- Allow players to finalise a tournament: set participant positions + mark completed
-- Also clears any tiebreaker state in the same atomic write.
CREATE OR REPLACE FUNCTION complete_tournament(
  p_tournament_id uuid,
  p_positions     jsonb   -- e.g. '{"<player-uuid>": 1, "<player-uuid>": 2}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid text;
  v_pos int;
BEGIN
  IF NOT is_player_or_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  FOR v_pid, v_pos IN
    SELECT key, value::int FROM jsonb_each_text(p_positions)
  LOOP
    UPDATE tournament_participants
    SET final_position = v_pos
    WHERE tournament_id = p_tournament_id
      AND player_id = v_pid::uuid;
  END LOOP;

  UPDATE tournaments
  SET
    completed          = true,
    tiebreaker_players = null
    -- tiebreaker_activated_at is kept so the admin page can identify tiebreaker matches after completion
  WHERE id = p_tournament_id;
END;
$$;


-- Allow players to record a bracket round winner and advance them to the next slot
CREATE OR REPLACE FUNCTION advance_bracket_round(
  p_tournament_id uuid,
  p_round_id      uuid,
  p_winner_id     uuid,
  p_round_number  int,
  p_position      int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_player_or_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE tournament_rounds
  SET winner_id = p_winner_id
  WHERE id = p_round_id;

  IF p_position % 2 = 1 THEN
    UPDATE tournament_rounds
    SET player1_id = p_winner_id
    WHERE tournament_id = p_tournament_id
      AND round_number   = p_round_number + 1
      AND position       = CEIL(p_position::numeric / 2)::int;
  ELSE
    UPDATE tournament_rounds
    SET player2_id = p_winner_id
    WHERE tournament_id = p_tournament_id
      AND round_number   = p_round_number + 1
      AND position       = CEIL(p_position::numeric / 2)::int;
  END IF;
END;
$$;


-- Allow a player to update their own avatar URL (admin can update anyone's)
CREATE OR REPLACE FUNCTION update_player_avatar(
  p_player_id  uuid,
  p_avatar_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND player_id = p_player_id
    )
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE players
  SET avatar_url = p_avatar_url
  WHERE id = p_player_id;
END;
$$;


-- Updated admin_reset_all_data: now also deletes tournament structures
CREATE OR REPLACE FUNCTION admin_reset_all_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  DELETE FROM tournament_rounds    WHERE true;
  DELETE FROM games                WHERE true;
  DELETE FROM matches              WHERE true;
  DELETE FROM tournament_participants WHERE true;
  DELETE FROM tournaments          WHERE true;
END;
$$;
