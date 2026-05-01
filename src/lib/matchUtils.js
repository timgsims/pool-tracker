// Returns a match's players sorted alphabetically, with scores from each side's perspective.
// Use this everywhere match results are displayed so the left player is always alphabetically first.
export function orderedMatch(match) {
  const { player1, player2, winner, games } = match
  const p1First = (player1?.name ?? '').localeCompare(player2?.name ?? '') <= 0
  const left = p1First ? player1 : player2
  const right = p1First ? player2 : player1
  return {
    left,
    right,
    leftScore: games?.filter(g => g.winner_id === left?.id).length ?? 0,
    rightScore: games?.filter(g => g.winner_id === right?.id).length ?? 0,
    leftWon: winner?.id === left?.id,
    rightWon: winner?.id === right?.id,
  }
}
