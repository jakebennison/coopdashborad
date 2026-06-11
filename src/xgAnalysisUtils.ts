import { getOpponentXg } from './matchUtils'
import type { Match } from './types'
import { matchesWithStats } from './analysisUtils'

export type XgMatchAnalysis = {
  id: number
  opponent: string
  date: string
  venue: Match['venue']
  result: Match['result']
  psgGoals: number
  psgXg: number
  opponentGoals: number
  opponentXg: number | null
  finishingDelta: number
  concededDelta: number | null
  xgResult: 'W' | 'D' | 'L' | null
}

export type XgAnalysisSummary = {
  matchCount: number
  xgMatchCount: number
  bothXgMatchCount: number
  psgGoalsTotal: number
  psgXgTotal: number
  psgGoalsAverage: number | null
  psgXgAverage: number | null
  finishingDeltaTotal: number | null
  finishingDeltaAverage: number | null
  finishingEfficiency: number | null
  overperformCount: number
  underperformCount: number
  evenFinishingCount: number
  concededTotal: number
  xgAgainstTotal: number
  concededAverage: number | null
  xgAgainstAverage: number | null
  defensiveDeltaTotal: number | null
  defensiveDeltaAverage: number | null
  xgRecord: { W: number; D: number; L: number }
  avgActualScoreline: string
  avgXgScoreline: string | null
  totalActualScoreline: string
  totalXgScoreline: string | null
  xgWinActualLossCount: number
  xgLossActualWinCount: number
  matches: XgMatchAnalysis[]
}

const round1 = (value: number) => Math.round(value * 10) / 10

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null

const formatScoreline = (forValue: number, againstValue: number, decimals = 1) =>
  `${round1(forValue).toFixed(decimals)}-${round1(againstValue).toFixed(decimals)}`

export const buildXgAnalysis = (matches: Match[]): XgAnalysisSummary => {
  const statMatches = matchesWithStats(matches)
  const rows: XgMatchAnalysis[] = []
  const xgRecord = { W: 0, D: 0, L: 0 }
  let overperformCount = 0
  let underperformCount = 0
  let evenFinishingCount = 0
  let xgWinActualLossCount = 0
  let xgLossActualWinCount = 0

  let psgGoalsTotal = 0
  let psgXgTotal = 0
  let psgXgCount = 0
  let concededTotal = 0
  let xgAgainstTotal = 0
  let xgAgainstCount = 0

  const psgXgValues: number[] = []
  const opponentXgValues: number[] = []
  const psgGoalValues: number[] = []
  const concededValues: number[] = []

  for (const match of statMatches) {
    const psgXg = match.stats?.xG
    if (typeof psgXg !== 'number') continue

    const opponentXg = getOpponentXg(match)
    const finishingDelta = round1(match.myScore - psgXg)
    const concededDelta = typeof opponentXg === 'number' ? round1(match.opponentScore - opponentXg) : null

    let xgResult: 'W' | 'D' | 'L' | null = null
    if (typeof opponentXg === 'number') {
      if (psgXg > opponentXg) xgResult = 'W'
      else if (psgXg < opponentXg) xgResult = 'L'
      else xgResult = 'D'

      xgRecord[xgResult] += 1
      opponentXgValues.push(opponentXg)
      xgAgainstTotal += opponentXg
      xgAgainstCount += 1

      if (xgResult === 'W' && match.result === 'L') xgWinActualLossCount += 1
      if (xgResult === 'L' && match.result === 'W') xgLossActualWinCount += 1
    }

    if (finishingDelta > 0.05) overperformCount += 1
    else if (finishingDelta < -0.05) underperformCount += 1
    else evenFinishingCount += 1

    psgGoalsTotal += match.myScore
    psgXgTotal += psgXg
    psgXgCount += 1
    concededTotal += match.opponentScore
    psgXgValues.push(psgXg)
    psgGoalValues.push(match.myScore)
    concededValues.push(match.opponentScore)

    rows.push({
      id: match.id,
      opponent: match.opponent,
      date: match.date,
      venue: match.venue,
      result: match.result,
      psgGoals: match.myScore,
      psgXg,
      opponentGoals: match.opponentScore,
      opponentXg,
      finishingDelta,
      concededDelta,
      xgResult,
    })
  }

  const psgGoalsAverage = average(psgGoalValues)
  const psgXgAverage = average(psgXgValues)
  const concededAverage = average(concededValues)
  const xgAgainstAverage = average(opponentXgValues)
  const finishingDeltaTotal =
    psgXgCount > 0 ? round1(psgGoalsTotal - psgXgTotal) : null
  const finishingDeltaAverage =
    psgGoalsAverage != null && psgXgAverage != null
      ? round1(psgGoalsAverage - psgXgAverage)
      : null
  const defensiveDeltaTotal =
    xgAgainstCount > 0 ? round1(concededTotal - xgAgainstTotal) : null
  const defensiveDeltaAverage =
    concededAverage != null && xgAgainstAverage != null
      ? round1(concededAverage - xgAgainstAverage)
      : null
  const finishingEfficiency =
    psgXgTotal > 0 ? round1(psgGoalsTotal / psgXgTotal) : null

  const avgActualScoreline =
    psgGoalsAverage != null && concededAverage != null
      ? formatScoreline(psgGoalsAverage, concededAverage)
      : '-'
  const avgXgScoreline =
    psgXgAverage != null && xgAgainstAverage != null
      ? formatScoreline(psgXgAverage, xgAgainstAverage)
      : null
  const totalActualScoreline = formatScoreline(psgGoalsTotal, concededTotal, 0)
  const totalXgScoreline =
    psgXgCount > 0 && xgAgainstCount > 0
      ? formatScoreline(psgXgTotal, xgAgainstTotal, 1)
      : null

  return {
    matchCount: statMatches.length,
    xgMatchCount: rows.length,
    bothXgMatchCount: xgAgainstCount,
    psgGoalsTotal,
    psgXgTotal,
    psgGoalsAverage,
    psgXgAverage,
    finishingDeltaTotal,
    finishingDeltaAverage,
    finishingEfficiency,
    overperformCount,
    underperformCount,
    evenFinishingCount,
    concededTotal,
    xgAgainstTotal,
    concededAverage,
    xgAgainstAverage,
    defensiveDeltaTotal,
    defensiveDeltaAverage,
    xgRecord,
    avgActualScoreline,
    avgXgScoreline,
    totalActualScoreline,
    totalXgScoreline,
    xgWinActualLossCount,
    xgLossActualWinCount,
    matches: rows,
  }
}

export const formatSignedAnalysisValue = (
  value: number | null | undefined,
  suffix = '',
  decimals = 1,
) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}${suffix}`
}
