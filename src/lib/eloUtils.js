export const BASE_RATING = 1000
export const PROVISIONAL_THRESHOLD = 5
const K_BASE = 32
const DECAY_HALF_LIFE_DAYS = 45
const DECAY_FLOOR = 0.25

function timeDecay(daysAgo) {
  return Math.max(DECAY_FLOOR, Math.exp(-Math.LN2 * daysAgo / DECAY_HALF_LIFE_DAYS))
}

function expectedScore(rA, rB) {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400))
}

/**
 * Compute Elo ratings and per-match deltas from a chronologically ordered match list.
 *
 * Includes all matches passed in — callers are responsible for filtering (e.g. by season).
 * Tournament matches count toward Elo.
 *
 * @param {Array}       matches       Sorted ASC by played_at. Requires player1_id,
 *                                    player2_id, winner_id, played_at, id.
 * @param {Date|string} [referenceDate] Decay reference point. Defaults to now.
 * @returns {{ ratings: Object, deltas: Object }}
 *   ratings: playerId -> { rating, wins, losses, matchesPlayed, isProvisional }
 *   deltas:  matchId  -> { [winnerId]: +N, [loserId]: -N }
 */
export function computeElo(matches, referenceDate) {
  const refMs = referenceDate ? new Date(referenceDate).getTime() : Date.now()
  const ratings = {}
  const stats = {}
  const pairDayCounts = {}
  const deltas = {}

  for (const m of matches) {
    if (!m.winner_id || !m.player1_id || !m.player2_id || m.player1_id === m.player2_id) continue

    const p1 = m.player1_id
    const p2 = m.player2_id

    if (ratings[p1] === undefined) { ratings[p1] = BASE_RATING; stats[p1] = { wins: 0, losses: 0, played: 0 } }
    if (ratings[p2] === undefined) { ratings[p2] = BASE_RATING; stats[p2] = { wins: 0, losses: 0, played: 0 } }

    const daysAgo = Math.max(0, (refMs - new Date(m.played_at).getTime()) / 86400000)
    const decay = timeDecay(daysAgo)

    const dateStr = m.played_at.slice(0, 10)
    const pairKey = (p1 < p2 ? `${p1}:${p2}` : `${p2}:${p1}`) + `:${dateStr}`
    const n = (pairDayCounts[pairKey] ?? 0) + 1
    pairDayCounts[pairKey] = n
    const repFactor = Math.pow(0.5, n - 1)

    const K = K_BASE * decay * repFactor
    const winner = m.winner_id
    const loser = winner === p1 ? p2 : p1

    const eWinner = expectedScore(ratings[winner], ratings[loser])
    const delta = K * (1 - eWinner)

    ratings[winner] += delta
    ratings[loser] -= delta

    deltas[m.id] = { [winner]: Math.round(delta), [loser]: -Math.round(delta) }

    stats[winner].wins++
    stats[winner].played++
    stats[loser].losses++
    stats[loser].played++
  }

  const ratingResult = {}
  for (const pid of Object.keys(ratings)) {
    ratingResult[pid] = {
      rating: Math.round(ratings[pid]),
      wins: stats[pid].wins,
      losses: stats[pid].losses,
      matchesPlayed: stats[pid].played,
      isProvisional: stats[pid].played < PROVISIONAL_THRESHOLD,
    }
  }

  return { ratings: ratingResult, deltas }
}

/** Backward-compatible wrapper — returns ratings only. */
export function computeEloRatings(matches, referenceDate) {
  return computeElo(matches, referenceDate).ratings
}

/**
 * Convert a computeElo ratings result into a sorted standings array.
 * Non-provisional players first (rating DESC), then provisional (rating DESC).
 *
 * @param {Object} eloRatings  ratings from computeElo or computeEloRatings.
 * @param {Array}  playerList  Array of { id, name } objects.
 * @returns {Array} Standings rows with player_id, player_name, rating, wins,
 *                  losses, matchesPlayed, isProvisional.
 */
export function buildEloStandings(eloRatings, playerList) {
  const rows = Object.entries(eloRatings).map(([pid, data]) => {
    const player = playerList.find(p => p.id === pid)
    return { player_id: pid, player_name: player?.name ?? pid, ...data }
  })
  const byRating = (a, b) => b.rating - a.rating
  return [
    ...rows.filter(r => !r.isProvisional).sort(byRating),
    ...rows.filter(r => r.isProvisional).sort(byRating),
  ]
}
