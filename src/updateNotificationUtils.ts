import type { UpdateNote } from './types'

export const LAST_SEEN_UPDATE_ID_KEY = 'coop26-last-seen-update-id'

export const readLastSeenUpdateId = (): number => {
  try {
    const raw = window.localStorage.getItem(LAST_SEEN_UPDATE_ID_KEY)
    const parsed = raw ? Number(raw) : 0
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

export const markUpdatesSeen = (updates: UpdateNote[]) => {
  if (!updates.length || typeof window === 'undefined') return

  const latestSeen = Math.max(readLastSeenUpdateId(), ...updates.map((update) => update.id))

  try {
    window.localStorage.setItem(LAST_SEEN_UPDATE_ID_KEY, String(latestSeen))
  } catch {
    // Ignore storage failures — alert may replay next visit.
  }
}

export const bootstrapLastSeenUpdateId = (updates: UpdateNote[]) => {
  if (!updates.length || readLastSeenUpdateId() > 0) return

  markUpdatesSeen(updates)
}

export const getUnseenUpdates = (updates: UpdateNote[]): UpdateNote[] => {
  if (!updates.length) return []

  bootstrapLastSeenUpdateId(updates)

  const lastSeen = readLastSeenUpdateId()
  if (!lastSeen) return []

  return updates
    .filter((update) => update.id > lastSeen)
    .sort((a, b) => b.id - a.id || b.date.localeCompare(a.date))
}

export const buildReleaseVersionMap = (updates: UpdateNote[]): Map<number, string> => {
  const chronological = [...updates].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
  )

  return new Map(chronological.map((update, index) => [update.id, `1.${index + 1}`]))
}

export const formatReleaseLabel = (versions: string[]) => {
  if (!versions.length) return '1.0'
  if (versions.length === 1) return versions[0]

  const numeric = versions
    .map((version) => Number(version.replace(/^1\./, '')))
    .filter((value) => Number.isFinite(value))

  if (numeric.length === versions.length) {
    const min = Math.min(...numeric)
    const max = Math.max(...numeric)
    return min === max ? `1.${min}` : `1.${min}–1.${max}`
  }

  return `${versions[versions.length - 1]}–${versions[0]}`
}

export const getUpdateSummary = (body: string, maxLength = 160) => {
  const paragraphs = body
    .split('\n\n')
    .map((entry) => entry.trim())
    .filter(Boolean)

  const intro =
    paragraphs.find((entry) => !entry.startsWith('•')) ??
    paragraphs[0]?.replace(/^•\s*/gm, '').split('\n')[0]?.trim() ??
    body.trim()

  if (intro.length <= maxLength) return intro
  return `${intro.slice(0, maxLength).trim()}…`
}
