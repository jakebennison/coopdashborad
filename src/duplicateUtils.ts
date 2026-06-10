import {
  createEmptyStats,
  formatStatValue,
  normaliseTeamName,
  statFields,
} from './matchUtils'
import type { DraftMatch, Match, MatchStats } from './types'

export type DuplicateComparisonRow = {
  label: string
  draftValue: string
  existingValue: string
  matches: boolean
}

const statValueEqual = (left: number | null | undefined, right: number | null | undefined) =>
  (left ?? null) === (right ?? null)

const statsRecordEqual = (
  left: MatchStats | null | undefined,
  right: MatchStats | null | undefined,
) => {
  const a = left ?? createEmptyStats()
  const b = right ?? createEmptyStats()

  return statFields.every(({ key }) => statValueEqual(a[key], b[key]))
}

const opponentStatsRecordEqual = (
  left: Partial<MatchStats> | null | undefined,
  right: Partial<MatchStats> | null | undefined,
) => {
  const a = left ?? {}
  const b = right ?? {}

  return statFields.every(({ key }) => statValueEqual(a[key], b[key]))
}

export const draftMatchesExisting = (draft: DraftMatch, match: Match) => {
  if (draft.xboxContentId && match.xboxContentId && draft.xboxContentId === match.xboxContentId) {
    return true
  }

  if (normaliseTeamName(draft.opponent.trim()) !== match.opponent) return false
  if (draft.venue !== match.venue) return false
  if (draft.myScore !== match.myScore || draft.opponentScore !== match.opponentScore) return false
  if (!statsRecordEqual(draft.stats, match.stats)) return false
  if (!opponentStatsRecordEqual(draft.opponentStats, match.opponentStats)) return false

  return true
}

export const findDuplicateMatches = (draft: DraftMatch, matches: Match[]) =>
  matches.filter((match) => draftMatchesExisting(draft, match))

export const buildDuplicateComparison = (
  draft: DraftMatch,
  match: Match,
): DuplicateComparisonRow[] => {
  const rows: DuplicateComparisonRow[] = [
    {
      label: 'Date',
      draftValue: draft.date,
      existingValue: match.date,
      matches: draft.date === match.date,
    },
    {
      label: 'Opponent',
      draftValue: normaliseTeamName(draft.opponent.trim()),
      existingValue: match.opponent,
      matches: normaliseTeamName(draft.opponent.trim()) === match.opponent,
    },
    {
      label: 'Venue',
      draftValue: draft.venue === 'home' ? 'Home' : 'Away',
      existingValue: match.venue === 'home' ? 'Home' : 'Away',
      matches: draft.venue === match.venue,
    },
    {
      label: 'Score',
      draftValue: `${draft.myScore ?? '-'}–${draft.opponentScore ?? '-'}`,
      existingValue: `${match.myScore}–${match.opponentScore}`,
      matches: draft.myScore === match.myScore && draft.opponentScore === match.opponentScore,
    },
  ]

  for (const field of statFields) {
    const draftValue = draft.stats?.[field.key] ?? null
    const existingValue = match.stats?.[field.key] ?? null

    rows.push({
      label: `PSG ${field.label}`,
      draftValue: formatStatValue(draftValue, field.suffix),
      existingValue: formatStatValue(existingValue, field.suffix),
      matches: statValueEqual(draftValue, existingValue),
    })
  }

  for (const field of statFields) {
    const draftValue = draft.opponentStats?.[field.key] ?? null
    const existingValue = match.opponentStats?.[field.key] ?? null

    rows.push({
      label: `Opponent ${field.label}`,
      draftValue: formatStatValue(draftValue, field.suffix),
      existingValue: formatStatValue(existingValue, field.suffix),
      matches: statValueEqual(draftValue, existingValue),
    })
  }

  return rows
}

export const formatLoggedMatchLabel = (match: Match) =>
  `${match.date} · ${match.opponent} · ${match.myScore}–${match.opponentScore}`
