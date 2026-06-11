import type { StatFieldConfig } from './statsCategories'
import type { Match, MatchStats } from './types'

export const getOpponentStat = (match: Match, key: keyof MatchStats): number | null => {
  const explicit = match.opponentStats?.[key]
  if (typeof explicit === 'number') return explicit
  if (key === 'possession' && typeof match.stats?.possession === 'number') {
    return 100 - match.stats.possession
  }
  return null
}

export const getPsgStat = (match: Match, key: keyof MatchStats): number | null => {
  const value = match.stats?.[key]
  return typeof value === 'number' ? value : null
}

export const matchesWithStats = (matches: Match[]) =>
  matches.filter(
    (match) =>
      match.stats && (match.loggedVia === 'screenshot' || match.loggedVia === 'xbox'),
  )

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null

const total = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) : null)

export type ComparisonMode = 'average' | 'total'

export const isAverageOnlyStat = (key: keyof MatchStats, suffix?: string) =>
  suffix === '%' || key === 'ballRecoveryTime'

export const averagePsgStat = (matches: Match[], key: keyof MatchStats) => {
  const values = matches
    .map((match) => getPsgStat(match, key))
    .filter((value): value is number => typeof value === 'number')
  return average(values)
}

export const averageOpponentStat = (matches: Match[], key: keyof MatchStats) => {
  const values = matches
    .map((match) => getOpponentStat(match, key))
    .filter((value): value is number => typeof value === 'number')
  return average(values)
}

export const totalPsgStat = (matches: Match[], key: keyof MatchStats) => {
  const values = matches
    .map((match) => getPsgStat(match, key))
    .filter((value): value is number => typeof value === 'number')
  return total(values)
}

export const totalOpponentStat = (matches: Match[], key: keyof MatchStats) => {
  const values = matches
    .map((match) => getOpponentStat(match, key))
    .filter((value): value is number => typeof value === 'number')
  return total(values)
}

export type ComparisonRow = {
  key: keyof MatchStats
  label: string
  suffix?: string
  decimals?: number
  psg: number | null
  opponent: number | null
  psgAverage: number | null
  opponentAverage: number | null
  psgTotal: number | null
  opponentTotal: number | null
  psgWins: boolean | null
  comparisonMode: ComparisonMode
  averageOnly: boolean
}

const lowerIsBetterStat = (key: keyof MatchStats) =>
  key === 'ballRecoveryTime' ||
  key === 'foulsCommitted' ||
  key === 'offsides' ||
  key === 'yellowCards'

export const buildComparisonRows = (
  matches: Match[],
  fields: StatFieldConfig[],
  mode: ComparisonMode = 'total',
): ComparisonRow[] =>
  fields.map((field) => {
    const averageOnly = isAverageOnlyStat(field.key, field.suffix)
    const comparisonMode: ComparisonMode = mode === 'average' || averageOnly ? 'average' : 'total'
    const psgAverage = averagePsgStat(matches, field.key)
    const opponentAverage = averageOpponentStat(matches, field.key)
    const psgTotal = totalPsgStat(matches, field.key)
    const opponentTotal = totalOpponentStat(matches, field.key)
    const psg = comparisonMode === 'average' ? psgAverage : averageOnly ? psgAverage : psgTotal
    const opponent =
      comparisonMode === 'average' ? opponentAverage : averageOnly ? opponentAverage : opponentTotal
    const psgWins =
      typeof psg === 'number' && typeof opponent === 'number'
        ? lowerIsBetterStat(field.key)
          ? psg < opponent
          : psg > opponent
        : null

    return {
      key: field.key,
      label: field.label,
      suffix: field.suffix,
      decimals: field.decimals,
      psg,
      opponent,
      psgAverage,
      opponentAverage,
      psgTotal,
      opponentTotal,
      psgWins,
      comparisonMode,
      averageOnly,
    }
  })

export const formatAnalysisValue = (
  value: number | null | undefined,
  suffix = '',
  decimals = 0,
) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  const formatted = decimals > 0 ? value.toFixed(decimals) : `${Math.round(value)}`
  return `${formatted}${suffix}`
}

export const formatComparisonDelta = (
  row: Pick<ComparisonRow, 'key' | 'psg' | 'opponent' | 'suffix' | 'decimals'>,
) => {
  if (typeof row.psg !== 'number' || typeof row.opponent !== 'number') return null

  const diff = lowerIsBetterStat(row.key) ? row.opponent - row.psg : row.psg - row.opponent

  if (Math.abs(diff) < 0.05) {
    return { text: 'Even', tone: 'neutral' as const }
  }

  const sign = diff > 0 ? '+' : ''

  return {
    text: `${sign}${formatAnalysisValue(diff, row.suffix, row.decimals)}`,
    tone: diff > 0 ? ('psg' as const) : ('opp' as const),
  }
}

export type YAxisConfig = {
  domain: [number, number]
  allowDecimals: boolean
  tickCount: number
}

export const getYAxisConfig = (
  psg: number | null,
  opponent: number | null,
  suffix = '',
  decimals = 0,
  key?: keyof MatchStats,
): YAxisConfig => {
  if (key === 'xG') {
    return { domain: [0, 6], allowDecimals: true, tickCount: 7 }
  }

  if (suffix === '%') {
    return { domain: [0, 100], allowDecimals: false, tickCount: 5 }
  }

  const values = [psg, opponent].filter((value): value is number => typeof value === 'number')
  if (!values.length) {
    return { domain: [0, 10], allowDecimals: false, tickCount: 5 }
  }

  const max = Math.max(...values)
  const allowDecimals = decimals > 0 || max < 10

  if (allowDecimals) {
    const ceiling = Math.max(Math.ceil(max * 1.25 * 10) / 10, 1)
    return { domain: [0, ceiling], allowDecimals: true, tickCount: 5 }
  }

  const ceiling = Math.max(Math.ceil(max * 1.15), max + 1, 1)
  return { domain: [0, ceiling], allowDecimals: false, tickCount: 5 }
}

export type TrendDataPoint = {
  label: string
  fullDate: string
  opponentName: string
  matchSummary: string
  psg: number | null
  opponent: number | null
}

export const buildTrendData = (
  matches: Match[],
  key: keyof MatchStats,
  limit = 10,
): TrendDataPoint[] =>
  [...matches]
    .slice(0, limit)
    .reverse()
    .map((match) => ({
      label: new Date(match.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      fullDate: new Date(match.date).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      opponentName: match.opponent,
      matchSummary: `${match.myScore}-${match.opponentScore} ${match.result} · ${match.venue === 'home' ? 'Home' : 'Away'}`,
      psg: getPsgStat(match, key),
      opponent: getOpponentStat(match, key),
    }))
    .filter((entry) => typeof entry.psg === 'number')
