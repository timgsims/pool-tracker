const SLOT_H = 56
const CARD_H = 52
const CONNECTOR_W = 16
const HEADER_H = 28
const COL_MIN_W = 148

function getRoundName(roundIdx, totalRounds) {
  const fromEnd = totalRounds - 1 - roundIdx
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semi-Finals'
  if (fromEnd === 2) return 'Quarter-Finals'
  return `Round ${roundIdx + 1}`
}

function PlayerSlot({ name, isWinner, isPlaceholder }) {
  return (
    <div className={`px-2.5 py-1.5 text-xs truncate flex items-center gap-1.5 ${
      isWinner ? 'text-slate-100 font-semibold'
      : isPlaceholder ? 'text-slate-700 italic'
      : 'text-slate-400'
    }`}>
      {isWinner && <span className="text-pool-accent shrink-0 text-[10px]">✓</span>}
      {name}
    </div>
  )
}

function MatchCard({ match, nameOf, onClick, clickable }) {
  const p1Name = match.player1_id ? nameOf(match.player1_id) : 'TBD'
  const p2Name = match.is_bye ? 'BYE'
    : match.player2_id ? nameOf(match.player2_id)
    : 'TBD'

  return (
    <div
      className={`border rounded-lg overflow-hidden bg-pool-card transition-colors ${
        clickable
          ? 'border-pool-border cursor-pointer hover:border-slate-500'
          : 'border-pool-border/60'
      }`}
      onClick={() => clickable && onClick?.(match)}
    >
      <PlayerSlot
        name={p1Name}
        isWinner={!!match.winner_id && match.winner_id === match.player1_id}
        isPlaceholder={!match.player1_id}
      />
      <div className="border-t border-pool-border/40" />
      <PlayerSlot
        name={p2Name}
        isWinner={!!match.winner_id && match.winner_id === match.player2_id}
        isPlaceholder={!match.player2_id && !match.is_bye}
      />
    </div>
  )
}

export default function BracketView({ rounds, nameOf, onMatchClick, readOnly = false }) {
  const numRounds = rounds.length
  if (!numRounds) return null

  const bracketSize = Math.pow(2, numRounds)
  const totalH = HEADER_H + bracketSize * SLOT_H

  return (
    <div className="overflow-x-auto">
      <div
        className="flex relative"
        style={{ height: totalH, minWidth: numRounds * COL_MIN_W }}
      >
        {rounds.map((matches, ri) => {
          const slotsPerMatch = Math.pow(2, ri + 1)
          const isLast = ri === numRounds - 1

          return (
            <div key={ri} className="relative flex-1" style={{ minWidth: COL_MIN_W }}>
              <p
                className="text-xs text-slate-600 text-center absolute left-0 right-0"
                style={{ top: 0, height: HEADER_H, lineHeight: `${HEADER_H}px` }}
              >
                {getRoundName(ri, numRounds)}
              </p>

              {matches.map((match, mi) => {
                const centerSlot = mi * slotsPerMatch + slotsPerMatch / 2
                const topPx = HEADER_H + centerSlot * SLOT_H - CARD_H / 2
                const canClick = !readOnly && !match.winner_id && !match.is_bye
                  && match.player1_id && match.player2_id

                return (
                  <div
                    key={mi}
                    className="absolute"
                    style={{ top: topPx, left: 4, right: isLast ? 4 : CONNECTOR_W + 4 }}
                  >
                    <MatchCard
                      match={match}
                      nameOf={nameOf}
                      onClick={onMatchClick}
                      clickable={canClick}
                    />
                  </div>
                )
              })}

              {/* Bracket connectors: pair → next round */}
              {!isLast && Array.from({ length: Math.floor(matches.length / 2) }).map((_, pairIdx) => {
                const c1 = HEADER_H + (pairIdx * 2 * slotsPerMatch + slotsPerMatch / 2) * SLOT_H
                const c2 = HEADER_H + ((pairIdx * 2 + 1) * slotsPerMatch + slotsPerMatch / 2) * SLOT_H
                return (
                  <div
                    key={`c-${pairIdx}`}
                    style={{
                      position: 'absolute',
                      right: 4,
                      top: c1,
                      height: c2 - c1,
                      width: CONNECTOR_W,
                      borderRight: '1px solid rgba(71,85,105,0.5)',
                      borderTop: '1px solid rgba(71,85,105,0.5)',
                      borderBottom: '1px solid rgba(71,85,105,0.5)',
                    }}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
