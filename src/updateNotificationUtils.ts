import type { UpdateNote } from './types'

export const LAST_SEEN_UPDATE_ID_KEY = 'coop26-last-seen-update-id'
export const DISMISSED_FORCED_UPDATE_IDS_KEY = 'coop26-dismissed-forced-update-ids'

/** Minimum unseen changelog entries before the entry alert appears. */
export const UPDATE_ALERT_MIN_COUNT = 5

/** Changelog ids that should notify immediately, below the minimum count. */
export const FORCE_NOTIFICATION_UPDATE_IDS = new Set<number>([2026061228, 2026062301])

const sortUpdatesNewestFirst = (updates: UpdateNote[]) =>
  [...updates].sort((a, b) => b.id - a.id || b.date.localeCompare(a.date))

export const readLastSeenUpdateId = (): number => {
  try {
    const raw = window.localStorage.getItem(LAST_SEEN_UPDATE_ID_KEY)
    const parsed = raw ? Number(raw) : 0
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

export const readDismissedForcedUpdateIds = (): Set<number> => {
  try {
    const raw = window.localStorage.getItem(DISMISSED_FORCED_UPDATE_IDS_KEY)
    if (!raw) return new Set()

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()

    return new Set(parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value)))
  } catch {
    return new Set()
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

export const markForcedUpdatesDismissed = (updates: UpdateNote[]) => {
  if (typeof window === 'undefined') return

  const forcedIds = updates
    .filter((update) => FORCE_NOTIFICATION_UPDATE_IDS.has(update.id))
    .map((update) => update.id)

  if (!forcedIds.length) return

  const next = new Set([...readDismissedForcedUpdateIds(), ...forcedIds])

  try {
    window.localStorage.setItem(DISMISSED_FORCED_UPDATE_IDS_KEY, JSON.stringify([...next]))
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

  return sortUpdatesNewestFirst(updates.filter((update) => update.id > lastSeen))
}

export const getPendingForcedNotifications = (updates: UpdateNote[]): UpdateNote[] => {
  const dismissed = readDismissedForcedUpdateIds()

  return sortUpdatesNewestFirst(
    updates.filter(
      (update) => FORCE_NOTIFICATION_UPDATE_IDS.has(update.id) && !dismissed.has(update.id),
    ),
  )
}

export const getPendingUpdateAlert = (updates: UpdateNote[]): UpdateNote[] => {
  const forced = getPendingForcedNotifications(updates)
  if (forced.length) return forced

  const unseen = getUnseenUpdates(updates)
  if (unseen.length >= UPDATE_ALERT_MIN_COUNT) return unseen

  return []
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
  const { intro, bullets } = parseUpdateBody(body)
  const fallback = intro ?? bullets[0] ?? body.trim()
  if (fallback.length <= maxLength) return fallback
  return `${fallback.slice(0, maxLength).trim()}…`
}

export type ParsedUpdateBody = {
  intro: string | null
  bullets: string[]
}

export const parseUpdateBody = (body: string): ParsedUpdateBody => {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const bullets: string[] = []
  const introLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('•')) {
      bullets.push(line.replace(/^•\s*/, '').trim())
      continue
    }

    if (!bullets.length) {
      introLines.push(line)
    }
  }

  return {
    intro: introLines.join(' ').trim() || null,
    bullets,
  }
}
