// Returns first name only, or "First L." if another player shares the same first name
export function displayName(fullName, allNames) {
  if (!fullName) return ''
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) return fullName
  const first = parts[0]
  const lastInitial = parts[parts.length - 1][0]
  const hasDuplicate = allNames.some(
    n => n && n !== fullName && n.trim().split(/\s+/)[0].toLowerCase() === first.toLowerCase()
  )
  return hasDuplicate ? `${first} ${lastInitial}.` : first
}

// Build { playerId: displayName } from [{id, name}]
export function buildDisplayNames(players) {
  const names = players.map(p => p.name).filter(Boolean)
  return Object.fromEntries(
    players.filter(p => p.id && p.name).map(p => [p.id, displayName(p.name, names)])
  )
}
