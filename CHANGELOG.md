# Changelog

All notable changes to Pool Tracker are recorded here, grouped by release.

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
