ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
-- No policies needed — migration scripts connect via direct DB URI (bypasses RLS)
-- Anon/authenticated Supabase clients have no access
