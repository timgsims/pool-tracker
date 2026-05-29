# Changelog

All notable changes to Pool Tracker are recorded here, grouped by release.

---

## v2.3.1 — 2026-05-17

### Fixed
- PWA: "New version available" banner now appears when a new build is deployed — tap "Update now" to reload immediately instead of waiting for the service worker to refresh on its own

---

## v2.3.0 — 2026-05-17

### Added
- Player Profile: Rival card — shows the opponent with the best win rate against the player (min. 3 matches), displayed below Favourite Opponent in both season and all-time views

### Dev
- Sync script: `user_roles` is now saved and restored around the TRUNCATE CASCADE, so dev admin access survives every live→dev data sync

---

## v2.2.0 — 2026-05-22

### Changed
- Elo rating system: removed same-day repeat match penalty — every match between the same two players in a day now counts at full K, regardless of how many times they've played that day
- Rationale: the penalty created asymmetric unfairness in comeback scenarios (early losses at full K, later wins at a fraction), and the Elo expected-score formula already naturally limits point gains as ratings converge

---

## v2.1.0 — 2026-05-22

### Added
- Match cards on Leaderboard Recent Results, All Matches, and Player Profile now show each player's Elo rating change (+N / −N) between the players row and the date row, aligned under their respective player
- "ELO RANK CHANGE" label centred between the two delta values; date/format dot now fixed-width centred for visual symmetry

### Changed
- Tournament matches now count toward Elo ratings (previously only regular Bo3 matches were included)
- `computeElo()` function added to eloUtils.js returning both ratings and per-match deltas; `computeEloRatings()` kept as a backward-compatible wrapper

### Fixed
- Safari PWA: `datetime-local` input no longer overflows its container (`-webkit-appearance: none` + explicit `height` added to base layer)
- Bo3 Stats and Tournament Stats: Player Breakdown sticky name column now renders correctly on mobile (column width anchored, `w-24 overflow-hidden` wrapper matches Head to Head table pattern)

---

## v2.0.3 — 2026-05-16

### Changed
- Display Dashboard Recent Results: cards now show both players with scores, Bo3 game sequence (W-L-W per side), player avatars, and a full date + time stamp (e.g. "16 May · 13:58")
- Display Dashboard Day Standings: full player breakdown — avatar, P/W/L/W%, Best streak, Comebacks, and today's results as W/L badges
- Display Dashboard Season Leaderboard: full player breakdown matching Bo3 Stats page — avatar, P/W/L/W%, Elo rating, Best streak, Comebacks, Last 10 W/L badges

---

## v2.0.2 — 2026-05-16

### Fixed
- Display Dashboard: Recent Results cards now show both players with scores, game sequence (W-L-W), and time — consistent with match display elsewhere in the app
- Display Dashboard: leaderboard tables now have breathing room between the rank number and player name columns
- Display Dashboard: Tournament Recent Results cards updated to match the same richer format

---

## v2.0.1 — 2026-05-16

### Fixed
- Display Dashboard: development environment banner now shown on the dashboard page (consistent with the rest of the app)

---

## v2.0.0 — 2026-05-16

### Added
- Display Dashboard (`/dashboard`): full-screen 1920×1080 display page for the garage screen, hidden on mobile
- Dashboard auto-rotates between 4 views every 15 seconds with a horizontal slide animation, and auto-refreshes all data every 60 seconds
- **Bo3 mode** — three views: Recent Results (last 10), Day Standings (today's W/L leaderboard), Season Leaderboard (Elo standings)
- **Tournament mode** — four views: Bracket or Round Robin draw, Recent Results with stage labels (Quarter-Final / Semi-Final / Final), Tournament Standings, Player Breakdown (W/L/Win%)
- Admin Dashboard: Display Dashboard control panel — toggle between Bo3 and Tournament mode, select which tournament to display, link to open the dashboard in a new tab
- Dashboard config persisted in new `dashboard_config` database table (publicly readable, admin-writable)

---

## v1.9.4 — 2026-05-16

### Fixed
- StatCard: value and sub-label now anchored to the bottom of each card, consistent with record cards on the Bo3 Stats and Tournament Stats pages

---

## v1.9.3 — 2026-05-16

### Changed
- Changelog pages (public and admin): markdown now renders formatted — headings, lists, and dividers styled consistently with the Rules page

---

## v1.9.2 — 2026-05-16

### Fixed
- Leaderboard H2H: expanded matchup history now scoped to the current season only — previously showed all historical matches

---

## v1.9.1 — 2026-05-16

### Added
- Public Changelog page accessible from the main menu

### Fixed
- Leaderboard: provisional players no longer have their full row greyed out — only the Elo rating value is muted, consistent with other tables

---

## v1.9.0 — 2026-05-16

### Added
- Player Profile: Elo rating card shown in Season stats grid
- Player Profile: Elo rating card shown in All Time and Career stats grids (computed from full match history)
- Players page: Elo rating column added to the player list
- Bo3 Stats: Elo rating column added to Player Breakdown table

### Changed
- Player Profile: season stats and streak/comeback cards merged into a single section — no more duplicate "Season — *name*" header
- Player Profile: All Time / Career stats and streak/comeback cards likewise merged to the top of the page
- Player Profile: "Comeback Wins" sub-label shortened to "After losing game 1" for better mobile fit
- Bo3 Stats: Best streak and Last 10 columns now visible in All Time view (previously hidden)

### Dev
- `scripts/sync-live-to-dev.sh` — one-command database refresh from live to dev; preserves dev `user_roles` so admin access survives the sync

---

## v1.8.0 — 2026-05-11

### Added
- Home leaderboard: Elo rating system replaces win percentage — season-scoped, resets to 1000 each season, with time-decay K-factor (recency weighted, half-life 45 days) and same-day farming protection (repeated matches against the same opponent on the same day yield diminishing K)
- Home leaderboard: provisional ratings shown below a separator for players with fewer than 5 matches (displayed as `~rating` in muted style)
- Admin Seasons: Complete Season archives final Elo ratings for all players into `season_rankings` table
- Season Detail leaderboard: shows archived Elo ratings for completed seasons; falls back to win% for pre-Elo historical seasons
- Database: `season_rankings` table — stores final rank, Elo rating, W/L/GP per player per completed season; RLS enabled

### Changed
- Home leaderboard: column widths tightened — # and STRK narrower, more room for player names
- Tournament bracket: BYE slots in `ranked_similar` seeding now go to the top seeds, not the bottom (consistent with playoff seeding)

### Security
- Database: RLS enabled on `schema_migrations` table (previously no row-level security)
- Auth: new user signups are now assigned `viewer` role by default; admin must manually promote to `player`

---

## v1.7.0 — 2026-05-09

### Added
- Stats: All Time view shows Longest Win Streak, Longest Loss Streak, and Busiest Day records — excluding historical seasons marked as date-unreliable via the new `stats_available` flag
- Stats: season selector lists all completed past seasons with real match data as individual options
- Tournament Stats: full season selector (Current Season | past seasons | All Time) with season-scoped filtering for both matches and tournament wins
- Admin Seasons: season name editable for active and completed seasons
- Admin Seasons: season champion editable for completed seasons (dropdown of all players)
- Season Detail: back arrow (←) linking to the Seasons archive page
- Player Profile: Longest Win Streak, Longest Loss Streak, Total Matches, and Last Match now visible in All Time view; streaks exclude date-unreliable historical seasons
- Database: `seasons.stats_available` column — marks seasons with randomised historical data as excluded from date-sensitive stats; migration applied to test and live

### Changed
- Stats: "Best" and "Last 10" columns hidden in All Time view (not meaningful without date ordering)
- Player Profile: streak card labels renamed "Longest Win Streak" / "Longest Loss Streak" and colour-coded green/red to match other stats pages
- StatCard component: new `loss` prop for red-coloured stat values

### Fixed
- Home: H2H matrix left sticky column no longer overflows into adjacent columns on narrow screens
- Stats: season selector no longer shows the active season as a duplicate past season option

---

## v1.6.1 — 2026-05-08

### Added
- Admin: Changelog page displaying this file in plain text

---

## v1.6.0 — 2026-05-08

### Added
- Tournaments page: round robin match results expandable per pair (H2H format with Bo3 scores and game sequences)
- Tournaments page: bracket match cards clickable — popup showing round name, winner, Bo3 score, and game sequence
- Seasons: Archived Seasons page and individual Season Detail page with leaderboard, graph, and trophy cabinet
- Seasons: date range filter component for filtering stats by season

### Changed
- Tournament Stats page is now stats-only (Records highlights + Player Breakdown table) — tournament results list moved to Tournaments page
- Bo3 Stats page: merged "Regular Matches" and "Best of 3" sections into a single Records grid and Player Breakdown table; added W/L/Comebacks columns; removed duplicate Most Matches card

---

## v1.5.0 — 2026-05-07

### Added
- Admin: bracket matches are now editable after being entered (click to re-record result)
- Admin: stale match detection highlights bracket matches that are out of sync with recorded results
- Test environment: browser tab title and favicon update dynamically to indicate test vs live
- Test environment: persistent banner in navbar so test environment is always clearly identified

### Changed
- Leaderboard: Best-of-3 Matches section has a sub-header for clarity
- Admin Users table: dropdowns fill column width; table scrolls horizontally on mobile rather than compressing

---

## v1.4.0 — 2026-05-05

### Added
- Test environment: separate Supabase instance, database sync scripts, and test tooling
- Viewer account type: can access Account Settings page

### Changed
- Tournament Stats page: consistent sort order matching Tournaments page
- Player profile: tournament record card now shows tournament wins (not match wins)
- Admin: tournament name editable after creation; tiebreaker results visible in admin view

### Fixed
- Tournament auto-complete, tiebreaker match detection, same-minute sort edge case
- Avatar upload for player-role users
- Navbar display for player-role users

---

## v1.3.0 — 2026-05-03

### Added
- Tiebreaker system: persisted to database, supports chaining, visible to all players
- Account Settings page: change password and profile picture
- Rules page: markdown editor for admins, rendered view for all users
- Player profile: all-time Bo3 last 10, all-match monthly form graph, longest win/loss streaks

### Changed
- Player profile: avatar links to Account Settings
- Match cards: clearer match type labels (Bo3 vs regular)

### Fixed
- Tournament completion state and bracket RLS policies
- Date input height collapsing on empty value (Chromium)
- Round robin tiebreaker edge cases

---

## v1.2.0 — 2026-05-02

### Added
- Seasons system: admin management, leaderboard integration, trophy cabinet per season
- Tournament Stats page: separate from regular match stats
- Bo3 Stats section on Stats page with win rate and comeback wins records
- Tournament record card on player profile
- Round robin: auto-fill final standings from match results
- Enter Match page: shows tournament schedule when a tournament is active

### Fixed
- Avatar upload on iOS (replaced `display:none` with opacity/size approach)
- Date/time inputs overflowing on mobile (iOS WebKit)
- Stats records calculations and best streak (wins only)
- Rarest matchup: now includes single-match pairs

---

## v1.1.0 — 2026-05-01–02

### Added
- Full tournament system: bracket and round robin formats with scheduling
- Tournament admin: create, seed, manage bracket/RR matches, record results, crown winner
- Players page with alphabetical listing

### Changed
- Player names: proper-case normalisation
- H2H table: sticky first column on mobile

---

## v1.0.0 — 2026-05-01

### Added
- Core match recording: regular and best-of-3 formats, game-by-game tracking
- Leaderboard: overall standings, H2H matchups, recent results
- Stats page: records (most matches, streaks, busiest day, rarest matchup) and player breakdown
- Per-player profile: match history, H2H breakdowns, win rate, streaks
- Auth system: sign up, email confirmation, password reset, gender selection
- Admin panel: manage players, users, matches, roles
- Avatar upload and display throughout the app
- Smart name abbreviation on mobile (first name + last initial only if duplicate)
- Horizontally scrollable tables on mobile
- PWA: installable, GitHub Pages hosted
