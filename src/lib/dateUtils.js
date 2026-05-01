const TZ = 'Pacific/Auckland'

// Short display: "30 Apr"
export function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-NZ', {
    timeZone: TZ, day: 'numeric', month: 'short',
  })
}

// Long display: "Wed, 30 Apr 2026"
export function formatDateLong(iso) {
  return new Date(iso).toLocaleDateString('en-NZ', {
    timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

// Returns "YYYY-MM-DDTHH:MM" in NZ local time — for initialising datetime-local inputs
export function nowNZLocal() {
  return new Date()
    .toLocaleString('sv-SE', { timeZone: TZ })
    .slice(0, 16)
    .replace(' ', 'T')
}

// Interprets a datetime-local string ("YYYY-MM-DDTHH:MM") as NZ time and returns a UTC ISO string.
// Without this, if the device clock is UTC the entered time would be saved 12-13 hours off.
// Converts a UTC ISO string to "YYYY-MM-DDTHH:MM" in NZ local time — for populating datetime-local inputs
export function isoToNZLocal(isoString) {
  return new Date(isoString)
    .toLocaleString('sv-SE', { timeZone: TZ })
    .slice(0, 16)
    .replace(' ', 'T')
}

// Human-readable "time since" string
export function timeAgo(iso) {
  if (!iso) return null
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30.44)
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`
  const years = Math.floor(days / 365.25)
  return `${years} year${years !== 1 ? 's' : ''} ago`
}

export function nzLocalToISO(localStr) {
  // Temporarily treat the NZ local time as if it were UTC
  const fakeUTC = new Date(localStr + ':00Z')
  // Ask what NZ wall-clock time corresponds to that UTC moment
  const nzEquiv = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(fakeUTC).replace(' ', 'T')
  // Difference between the two tells us the NZ offset at this date (handles DST automatically)
  const offsetMs = new Date(nzEquiv + 'Z').getTime() - fakeUTC.getTime()
  return new Date(fakeUTC.getTime() - offsetMs).toISOString()
}
