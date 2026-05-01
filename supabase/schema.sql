-- ============================================================
-- 8-BALL POOL TRACKER — DATABASE SCHEMA
-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- ============================================================


-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role       AS ENUM ('admin', 'player', 'viewer');
CREATE TYPE match_format    AS ENUM ('best_of_3', 'single');
CREATE TYPE tournament_format AS ENUM ('round_robin', 'bracket');


-- ============================================================
-- TABLES
-- ============================================================

-- Player profiles — separate from auth accounts.
-- Admin creates these manually; optionally links them to a user account.
CREATE TABLE players (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  avatar_url TEXT,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Maps auth users to roles, and optionally to a player profile.
CREATE TABLE user_roles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       user_role   NOT NULL DEFAULT 'viewer',
  player_id  UUID        REFERENCES players(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

-- Tournament records.
CREATE TABLE tournaments (
  id         UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT              NOT NULL,
  date       DATE              NOT NULL,
  format     tournament_format NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  created_by UUID              REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Head-to-head matches (best-of-3 or single game).
CREATE TABLE matches (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  played_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  format        match_format NOT NULL DEFAULT 'best_of_3',
  player1_id    UUID         NOT NULL REFERENCES players(id),
  player2_id    UUID         NOT NULL REFERENCES players(id),
  winner_id     UUID         REFERENCES players(id),
  tournament_id UUID         REFERENCES tournaments(id) ON DELETE SET NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by    UUID         REFERENCES auth.users(id) ON DELETE SET NULL,

  CHECK (player1_id <> player2_id),
  CHECK (winner_id IS NULL OR winner_id = player1_id OR winner_id = player2_id)
);

-- Individual game results within a match (up to 3 for best-of-3).
CREATE TABLE games (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID        NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  game_number INTEGER     NOT NULL CHECK (game_number BETWEEN 1 AND 3),
  winner_id   UUID        NOT NULL REFERENCES players(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (match_id, game_number)
);

-- Participants and final standings for each tournament.
CREATE TABLE tournament_participants (
  tournament_id  UUID    NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id      UUID    NOT NULL REFERENCES players(id)    ON DELETE CASCADE,
  final_position INTEGER,
  PRIMARY KEY (tournament_id, player_id)
);


-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tournaments_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- AUTO-CREATE user_roles ROW ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- HELPER FUNCTIONS (called inside RLS policies)
-- SECURITY DEFINER bypasses RLS when checking user_roles,
-- so these cannot recurse.
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_player_or_admin()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'player')
  );
$$;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE players               ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches               ENABLE ROW LEVEL SECURITY;
ALTER TABLE games                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;

-- players: anyone reads, only admin writes
CREATE POLICY "players_read"   ON players FOR SELECT USING (true);
CREATE POLICY "players_insert" ON players FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "players_update" ON players FOR UPDATE USING (is_admin());
CREATE POLICY "players_delete" ON players FOR DELETE USING (is_admin());

-- user_roles: user sees own row, admin sees all; only admin writes
CREATE POLICY "user_roles_read"   ON user_roles FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "user_roles_insert" ON user_roles FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE USING (is_admin());
CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE USING (is_admin());

-- matches: anyone reads; player/admin inserts; only admin edits/deletes
CREATE POLICY "matches_read"   ON matches FOR SELECT USING (true);
CREATE POLICY "matches_insert" ON matches FOR INSERT WITH CHECK (is_player_or_admin());
CREATE POLICY "matches_update" ON matches FOR UPDATE USING (is_admin());
CREATE POLICY "matches_delete" ON matches FOR DELETE USING (is_admin());

-- games: same as matches
CREATE POLICY "games_read"   ON games FOR SELECT USING (true);
CREATE POLICY "games_insert" ON games FOR INSERT WITH CHECK (is_player_or_admin());
CREATE POLICY "games_update" ON games FOR UPDATE USING (is_admin());
CREATE POLICY "games_delete" ON games FOR DELETE USING (is_admin());

-- tournaments: anyone reads, only admin writes
CREATE POLICY "tournaments_read"   ON tournaments FOR SELECT USING (true);
CREATE POLICY "tournaments_insert" ON tournaments FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "tournaments_update" ON tournaments FOR UPDATE USING (is_admin());
CREATE POLICY "tournaments_delete" ON tournaments FOR DELETE USING (is_admin());

-- tournament_participants: same as tournaments
CREATE POLICY "tp_read"   ON tournament_participants FOR SELECT USING (true);
CREATE POLICY "tp_insert" ON tournament_participants FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "tp_update" ON tournament_participants FOR UPDATE USING (is_admin());
CREATE POLICY "tp_delete" ON tournament_participants FOR DELETE USING (is_admin());


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_matches_played_at   ON matches(played_at DESC);
CREATE INDEX idx_matches_player1     ON matches(player1_id);
CREATE INDEX idx_matches_player2     ON matches(player2_id);
CREATE INDEX idx_matches_winner      ON matches(winner_id);
CREATE INDEX idx_matches_tournament  ON matches(tournament_id);
CREATE INDEX idx_games_match         ON games(match_id);
CREATE INDEX idx_user_roles_user     ON user_roles(user_id);
CREATE INDEX idx_user_roles_player   ON user_roles(player_id);


-- ============================================================
-- VIEWS
-- ============================================================

-- Per-player stats for a given season year.
-- Filters to completed matches only (winner_id IS NOT NULL).
CREATE OR REPLACE VIEW player_season_stats AS
SELECT
  p.id                                                          AS player_id,
  p.name                                                        AS player_name,
  EXTRACT(YEAR FROM m.played_at)::INTEGER                       AS season,
  COUNT(m.id)::INTEGER                                          AS matches_played,
  COUNT(CASE WHEN m.winner_id = p.id THEN 1 END)::INTEGER       AS wins,
  COUNT(CASE WHEN m.winner_id != p.id THEN 1 END)::INTEGER      AS losses,
  ROUND(
    COUNT(CASE WHEN m.winner_id = p.id THEN 1 END)::NUMERIC
    / NULLIF(COUNT(m.id), 0),
    4
  )                                                             AS win_pct
FROM players p
JOIN matches m
  ON (m.player1_id = p.id OR m.player2_id = p.id)
  AND m.winner_id IS NOT NULL
WHERE p.active = TRUE
GROUP BY p.id, p.name, EXTRACT(YEAR FROM m.played_at);


-- Head-to-head record between every pair of players.
-- player_a_id is always the lesser UUID to avoid duplicate pairs.
CREATE OR REPLACE VIEW head_to_head_stats AS
SELECT
  LEAST(player1_id, player2_id)                                                   AS player_a_id,
  GREATEST(player1_id, player2_id)                                                AS player_b_id,
  COUNT(*)::INTEGER                                                               AS matches_played,
  COUNT(CASE WHEN winner_id = LEAST(player1_id, player2_id)    THEN 1 END)::INTEGER AS player_a_wins,
  COUNT(CASE WHEN winner_id = GREATEST(player1_id, player2_id) THEN 1 END)::INTEGER AS player_b_wins
FROM matches
WHERE winner_id IS NOT NULL
GROUP BY LEAST(player1_id, player2_id), GREATEST(player1_id, player2_id);


-- Comeback wins: player won the match having lost game 1 in a best-of-3.
CREATE OR REPLACE VIEW comeback_wins AS
SELECT
  m.id          AS match_id,
  m.played_at,
  m.player1_id,
  m.player2_id,
  m.winner_id,
  g1.winner_id  AS game1_winner_id,
  (m.winner_id <> g1.winner_id) AS is_comeback
FROM matches m
JOIN games g1 ON g1.match_id = m.id AND g1.game_number = 1
WHERE m.format = 'best_of_3'
  AND m.winner_id IS NOT NULL;


-- ============================================================
-- FUNCTION: get_all_users()
-- Admin-only RPC that returns user account info + roles.
-- Needed because auth.users is not directly queryable from client.
-- ============================================================

CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
  user_id    UUID,
  email      TEXT,
  created_at TIMESTAMPTZ,
  role       user_role,
  player_id  UUID,
  player_name TEXT
)
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    ur.user_id,
    au.email::TEXT,
    au.created_at,
    ur.role,
    ur.player_id,
    p.name
  FROM user_roles ur
  JOIN auth.users au ON au.id = ur.user_id
  LEFT JOIN players p ON p.id = ur.player_id
  ORDER BY au.created_at DESC;
END;
$$;


-- ============================================================
-- REALTIME
-- Enable live updates for the key tables.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;


-- ============================================================
-- POST-SETUP: MAKE YOURSELF ADMIN
-- After you sign up with your email, run this one-off query
-- (replace with your actual email):
-- ============================================================

-- UPDATE user_roles SET role = 'admin'
-- WHERE user_id = (
--   SELECT id FROM auth.users WHERE email = 'your-email@example.com'
-- );
