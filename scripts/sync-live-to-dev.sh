#!/usr/bin/env bash
# Copies all game data from live to dev, preserving dev auth/user_roles.
# Requires LIVE_DB_URI and TEST_DB_URI from .env.scripts (loaded automatically).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.scripts"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.scripts not found at $ENV_FILE" >&2
  exit 1
fi

# Load env vars
set -a; source "$ENV_FILE"; set +a

: "${LIVE_DB_URI:?LIVE_DB_URI must be set in .env.scripts}"
: "${TEST_DB_URI:?TEST_DB_URI must be set in .env.scripts}"

DUMP_FILE="$(mktemp /tmp/pool_live_data_XXXXXX.sql)"
trap 'rm -f "$DUMP_FILE"' EXIT

echo "→ Dumping live data..."
pg_dump "$LIVE_DB_URI" \
  --data-only --no-owner --no-acl \
  -t public.players \
  -t public.seasons \
  -t public.rules \
  -t public.matches \
  -t public.games \
  -t public.tournaments \
  -t public.tournament_rounds \
  -t public.tournament_participants \
  -t public.season_rankings \
  -f "$DUMP_FILE"

echo "→ Clearing dev data (preserving user_roles)..."
psql "$TEST_DB_URI" -c "
TRUNCATE
  public.games,
  public.tournament_participants,
  public.tournament_rounds,
  public.season_rankings,
  public.matches,
  public.tournaments,
  public.seasons,
  public.rules,
  public.players
CASCADE;
"

echo "→ Restoring live data into dev..."
psql "$TEST_DB_URI" \
  -c "SET session_replication_role = replica;" \
  -f "$DUMP_FILE" \
  -c "SET session_replication_role = DEFAULT;"

echo "→ Verifying row counts..."
psql "$TEST_DB_URI" -c "
SELECT 'players'     AS tbl, COUNT(*) FROM public.players
UNION ALL SELECT 'seasons',  COUNT(*) FROM public.seasons
UNION ALL SELECT 'matches',  COUNT(*) FROM public.matches
UNION ALL SELECT 'games',    COUNT(*) FROM public.games
UNION ALL SELECT 'user_roles (untouched)', COUNT(*) FROM public.user_roles;
"

echo "✓ Dev database refreshed from live."
