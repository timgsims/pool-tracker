CREATE TABLE season_rankings (
  season_id      UUID    NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  player_id      UUID    NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  final_rank     INTEGER NOT NULL,
  final_rating   INTEGER NOT NULL,
  wins           INTEGER NOT NULL DEFAULT 0,
  losses         INTEGER NOT NULL DEFAULT 0,
  matches_played INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (season_id, player_id)
);

ALTER TABLE season_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr_read"   ON season_rankings FOR SELECT USING (true);
CREATE POLICY "sr_insert" ON season_rankings FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "sr_delete" ON season_rankings FOR DELETE USING (is_admin());
