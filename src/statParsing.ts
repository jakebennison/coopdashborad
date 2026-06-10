import type { ExtractedOpponentStats, ExtractedTeamStats, MatchStats, VisionExtraction } from './types'

const statKeys: Array<keyof MatchStats> = [
  'possession',
  'shots',
  'shotsOnTarget',
  'xG',
  'passes',
  'passAccuracy',
  'tackles',
  'tacklesWon',
  'interceptions',
  'saves',
  'foulsCommitted',
  'offsides',
  'corners',
  'freeKicks',
  'yellowCards',
  'dribbleSuccessRate',
  'shotAccuracy',
  'ballRecoveryTime',
  'penaltyKicks',
]

export const normalizeMatchDate = (value: unknown): string | null => {
  if (value === null || value === undefined) return null

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return dateToInputValue(parsed)
    }
  }

  return null
}

export const dateToInputValue = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const fileDateToInputValue = (file: File): string => dateToInputValue(new Date(file.lastModified))

export const toStatNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.replace(/%/g, '').trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const buildStatsFromExtractedTeam = (
  team: ExtractedTeamStats | ExtractedOpponentStats | undefined,
): Partial<MatchStats> => {
  if (!team) return {}

  const stats: Partial<MatchStats> = {}

  for (const key of statKeys) {
    const value = toStatNumber(team[key as keyof typeof team])
    if (value !== null) {
      stats[key] = value
    }
  }

  return stats
}

export const normalizeVisionExtraction = (extraction: VisionExtraction): VisionExtraction => {
  const normalizeTeam = (team: ExtractedTeamStats | ExtractedOpponentStats | undefined) => {
    const built = buildStatsFromExtractedTeam(team)
    const name = 'name' in (team ?? {}) ? (team as ExtractedOpponentStats).name?.trim() : undefined

    return {
      ...(team ?? {}),
      ...(name ? { name: name || 'Unknown opponent' } : {}),
      score: toStatNumber(team?.score),
      possession: built.possession ?? toStatNumber(team?.possession),
      shots: built.shots ?? toStatNumber(team?.shots),
      shotsOnTarget: built.shotsOnTarget ?? toStatNumber(team?.shotsOnTarget),
      xG: built.xG ?? toStatNumber(team?.xG),
      ...built,
    }
  }

  const psg = normalizeTeam(extraction.psg) as ExtractedTeamStats
  const opponent = normalizeTeam(extraction.opponent) as ExtractedOpponentStats
  opponent.name = extraction.opponent?.name?.trim() || 'Unknown opponent'

  let leftTeam: ExtractedOpponentStats | undefined
  let rightTeam: ExtractedOpponentStats | undefined

  if (extraction.psgSide === 'both') {
    if (extraction.leftTeam && extraction.rightTeam) {
      leftTeam = normalizeTeam(extraction.leftTeam) as ExtractedOpponentStats
      rightTeam = normalizeTeam(extraction.rightTeam) as ExtractedOpponentStats
      leftTeam.name = extraction.leftTeam.name?.trim() || 'PARIS SG'
      rightTeam.name = extraction.rightTeam.name?.trim() || 'PARIS SG'
    } else {
      // When leftTeam/rightTeam are missing, vision often maps the right column into `psg`.
      leftTeam = normalizeTeam(extraction.opponent) as ExtractedOpponentStats
      rightTeam = normalizeTeam(extraction.psg) as ExtractedOpponentStats
      leftTeam.name = extraction.opponent?.name?.trim() || 'PARIS SG'
      rightTeam.name = 'PARIS SG'
    }
  }

  return {
    ...extraction,
    matchDate: normalizeMatchDate(extraction.matchDate),
    psg,
    opponent,
    leftTeam,
    rightTeam,
  }
}
