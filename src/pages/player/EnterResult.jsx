import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { nowNZLocal, nzLocalToISO } from '../../lib/dateUtils'

export default function EnterResult() {
  const { linkedPlayerId } = useAuth()
  const navigate = useNavigate()

  const [players, setPlayers] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [player1Id, setPlayer1Id] = useState(linkedPlayerId ?? '')
  const [player2Id, setPlayer2Id] = useState('')
  const [playedAt, setPlayedAt] = useState(nowNZLocal())
  const [tournamentId, setTournamentId] = useState('')
  const [games, setGames] = useState([null, null, null])

  useEffect(() => {
    Promise.all([
      supabase.from('players').select('id, name').eq('active', true).order('name'),
      supabase.from('tournaments').select('id, name').order('date', { ascending: false }).limit(20),
    ]).then(([{ data: p }, { data: t }]) => {
      setPlayers(p ?? [])
      setTournaments(t ?? [])
      setLoading(false)
    })
  }, [])

  const setGame = (index, winnerId) => {
    setGames(prev => prev.map((g, i) => i === index ? winnerId : g))
  }

  const deriveWinner = () => {
    const p1Wins = games.filter(g => g === player1Id).length
    const p2Wins = games.filter(g => g === player2Id).length
    if (p1Wins >= 2) return player1Id
    if (p2Wins >= 2) return player2Id
    return null
  }

  const gamesToShow = () => {
    const p1Wins = games.filter(g => g === player1Id).length
    const p2Wins = games.filter(g => g === player2Id).length
    if (p1Wins >= 2 || p2Wins >= 2) return games.findIndex((g, i) => {
      const p1 = games.slice(0, i + 1).filter(x => x === player1Id).length
      const p2 = games.slice(0, i + 1).filter(x => x === player2Id).length
      return p1 >= 2 || p2 >= 2
    }) + 1
    return 3
  }

  const isValid = () => {
    if (!player1Id || !player2Id || player1Id === player2Id) return false
    return deriveWinner() !== null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid()) return
    setSubmitting(true)
    setError('')

    const winnerId = deriveWinner()
    const visibleGames = gamesToShow()

    const { data: match, error: matchErr } = await supabase
      .from('matches')
      .insert({
        player1_id: player1Id,
        player2_id: player2Id,
        format: 'best_of_3',
        winner_id: winnerId,
        played_at: nzLocalToISO(playedAt),
        tournament_id: tournamentId || null,
      })
      .select('id')
      .single()

    if (matchErr) { setError(matchErr.message); setSubmitting(false); return }

    const gameRows = games.slice(0, visibleGames)
      .filter(Boolean)
      .map((wId, i) => ({ match_id: match.id, game_number: i + 1, winner_id: wId }))

    if (gameRows.length) {
      const { error: gamesErr } = await supabase.from('games').insert(gameRows)
      if (gamesErr) { setError(gamesErr.message); setSubmitting(false); return }
    }

    navigate('/')
  }

  const p1 = players.find(p => p.id === player1Id)
  const p2 = players.find(p => p.id === player2Id)

  if (loading) return <div className="py-12 text-center text-slate-500">Loading…</div>

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <p className="section-header">New Result</p>
        <h1 className="page-title">Enter Match</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Players */}
        <div className="card p-5 space-y-4">
          <p className="section-header mb-0">Players</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Player 1</label>
              <select className="select" value={player1Id} onChange={e => setPlayer1Id(e.target.value)} required>
                <option value="">Select…</option>
                {players.map(p => (
                  <option key={p.id} value={p.id} disabled={p.id === player2Id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Player 2</label>
              <select className="select" value={player2Id} onChange={e => setPlayer2Id(e.target.value)} required>
                <option value="">Select…</option>
                {players.map(p => (
                  <option key={p.id} value={p.id} disabled={p.id === player1Id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Date & tournament */}
        <div className="card p-5 space-y-4">
          <p className="section-header mb-0">Match Details</p>
          <div>
            <label className="label">Date &amp; time</label>
            <input
              type="datetime-local"
              className="input max-w-xs"
              value={playedAt}
              onChange={e => setPlayedAt(e.target.value)}
              required
            />
          </div>

          {tournaments.length > 0 && (
            <div>
              <label className="label">Tournament (optional)</label>
              <select className="select" value={tournamentId} onChange={e => setTournamentId(e.target.value)}>
                <option value="">None</option>
                {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Game results */}
        {player1Id && player2Id && player1Id !== player2Id && (
          <div className="card p-5 space-y-3">
            <p className="section-header mb-0">Game Results</p>
            <div className="space-y-2">
              {[0, 1, 2].slice(0, gamesToShow()).map(i => (
                <div key={i}>
                  <p className="text-xs text-slate-600 mb-1.5">Game {i + 1}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[player1Id, player2Id].map(pid => {
                      const name = players.find(p => p.id === pid)?.name
                      return (
                        <button
                          key={pid}
                          type="button"
                          onClick={() => setGame(i, pid)}
                          className={`py-2.5 rounded-lg font-medium text-sm transition-all border ${
                            games[i] === pid
                              ? 'bg-pool-accent-muted border-pool-accent text-pool-accent'
                              : 'bg-pool-surface border-pool-border text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          {name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {deriveWinner() && (
                <div className="mt-3 px-3 py-2.5 bg-green-950/30 border border-green-900/40 rounded-lg text-sm text-pool-win font-semibold">
                  {players.find(p => p.id === deriveWinner())?.name} wins the match
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/')} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={!isValid() || submitting}>
            {submitting ? 'Saving…' : 'Save Result'}
          </button>
        </div>
      </form>
    </div>
  )
}
