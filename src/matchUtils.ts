import type {
  DraftMatch,
  ExtractedOpponentStats,
  LoggedVia,
  Match,
  MatchComment,
  MatchStats,
  Result,
  Venue,
  VisionExtraction,
} from './types'
import {
  createMatchComment,
  migrateMatchComments,
  readDefaultCommentAuthor,
} from './commentUtils'
import { getPrimaryGameDisplayName, normalizeTeamLabel } from './teamConfig'
import {
  LEGACY_DEFAULT_PLAYED_AS,
  migrateMatchPlayedAs,
} from './matchTeamUtils'
import { buildStatsFromExtractedTeam, dateToInputValue, normalizeMatchDate, toStatNumber } from './statParsing'

export { normalizeVisionExtraction, toStatNumber } from './statParsing'

export const STORAGE_KEY = 'psg-coop-seasons-matches'

export const statFields: Array<{ key: keyof MatchStats; label: string; suffix?: string }> = [
  { key: 'possession', label: 'Possession', suffix: '%' },
  { key: 'shots', label: 'Shots' },
  { key: 'shotsOnTarget', label: 'Shots on target' },
  { key: 'xG', label: 'xG' },
  { key: 'passes', label: 'Passes' },
  { key: 'passAccuracy', label: 'Pass accuracy', suffix: '%' },
  { key: 'tackles', label: 'Tackles' },
  { key: 'tacklesWon', label: 'Tackles won' },
  { key: 'interceptions', label: 'Interceptions' },
  { key: 'saves', label: 'Saves' },
  { key: 'foulsCommitted', label: 'Fouls committed' },
  { key: 'offsides', label: 'Offsides' },
  { key: 'corners', label: 'Corners' },
  { key: 'freeKicks', label: 'Free kicks' },
  { key: 'yellowCards', label: 'Yellow cards' },
  { key: 'dribbleSuccessRate', label: 'Dribble success', suffix: '%' },
  { key: 'shotAccuracy', label: 'Shot accuracy', suffix: '%' },
  { key: 'ballRecoveryTime', label: 'Ball recovery time' },
  { key: 'penaltyKicks', label: 'Penalty kicks' },
]

export {
  LEGACY_DEFAULT_PLAYED_AS,
  OVERALL_TEAM_SCOPE,
  filterMatchesByTeam,
  filterMatchesByTeamScope,
  getMatchPlayedAs,
  getStatsTeamLabel,
  getTeamsFromMatches,
  migrateMatchPlayedAs,
  type TeamScope,
} from './matchTeamUtils'

export const normaliseTeamName = (name: string): string => normalizeTeamLabel(name)

export const createEmptyStats = (): MatchStats => ({
  possession: null,
  shots: null,
  shotsOnTarget: null,
  xG: null,
  passes: null,
  passAccuracy: null,
  tackles: null,
  tacklesWon: null,
  interceptions: null,
  saves: null,
  foulsCommitted: null,
  offsides: null,
  corners: null,
  freeKicks: null,
  yellowCards: null,
  dribbleSuccessRate: null,
  shotAccuracy: null,
  ballRecoveryTime: null,
  penaltyKicks: null,
})

export const calculateResult = (myScore: number, opponentScore: number): Result => {
  if (myScore > opponentScore) return 'W'
  if (myScore < opponentScore) return 'L'
  return 'D'
}

export const formatStatValue = (value: number | null | undefined, suffix = '') => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return `${value}${suffix}`
}

export const readMatches = (): Match[] => {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return (parsed as Match[]).map((match) => migrateMatchPlayedAs(migrateMatchComments(match)))
  } catch {
    return []
  }
}

export const writeMatches = (matches: Match[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(matches))
}

export const deleteMatchById = (matches: Match[], id: number): Match[] =>
  matches.filter((match) => match.id !== id)

export const normalizeComment = (comment: string | null | undefined): string | null => {
  const trimmed = comment?.trim()
  return trimmed ? trimmed : null
}

export const buildInitialComments = (draft: DraftMatch): MatchComment[] => {
  const body = normalizeComment(draft.comment)
  if (!body) return []

  return [
    createMatchComment(body, draft.commentAuthor?.trim() || readDefaultCommentAuthor()),
  ]
}

export const updateMatchComments = (
  matches: Match[],
  id: number,
  comments: MatchComment[],
): Match[] =>
  matches.map((match) => (match.id === id ? { ...match, comments } : match))

export const clearAllMatches = (): Match[] => []

export const getImportedXboxContentIds = (matches: Match[]): string[] =>
  matches
    .map((match) => match.xboxContentId)
    .filter((contentId): contentId is string => Boolean(contentId))

export const toMatch = (draft: DraftMatch): Match => {
  const myScore = draft.myScore ?? 0
  const opponentScore = draft.opponentScore ?? 0

  return {
    id: Date.now(),
    date: draft.date,
    playedAs: normalizeTeamLabel(draft.playedAs?.trim() || LEGACY_DEFAULT_PLAYED_AS),
    opponent: normaliseTeamName(draft.opponent.trim() || 'Unknown opponent'),
    venue: draft.venue,
    myScore,
    opponentScore,
    result: calculateResult(myScore, opponentScore),
    loggedVia: draft.loggedVia,
    stats: draft.stats,
    opponentStats: draft.opponentStats ?? null,
    xboxContentId: draft.xboxContentId ?? null,
    comments: buildInitialComments(draft),
  }
}

export const buildOpponentStatsFromExtraction = (
  opponent: VisionExtraction['opponent'],
): Partial<MatchStats> => buildStatsFromExtractedTeam(opponent)

export type ExtractionDraftOptions = {
  loggedVia?: LoggedVia
  playedAs?: string
  xboxContentId?: string | null
  /** Xbox capture date or uploaded file date — when the match was played. */
  screenshotDate?: string | null
  /** Server-side pending archive created during Vision extraction. */
  screenshotArchiveKey?: string | null
}

export const resolveDraftMatchDate = (
  extraction: VisionExtraction,
  options?: ExtractionDraftOptions,
): string =>
  normalizeMatchDate(extraction.matchDate) ??
  normalizeMatchDate(options?.screenshotDate) ??
  dateToInputValue(new Date())

const resolveBothSideTeams = (
  extraction: VisionExtraction,
  side: 'left' | 'right',
) => {
  const left = extraction.leftTeam ?? extraction.opponent
  const right = extraction.rightTeam ?? extraction.psg

  return side === 'left'
    ? { myTeam: left, theirTeam: right }
    : { myTeam: right, theirTeam: left }
}

const toOpponentTeam = (
  team: VisionExtraction['leftTeam'] | VisionExtraction['psg'],
  fallbackName: string,
): ExtractedOpponentStats => ({
  name: team && 'name' in team && team.name ? team.name : fallbackName,
  score: team?.score ?? null,
  possession: team?.possession ?? null,
  shots: team?.shots ?? null,
  shotsOnTarget: team?.shotsOnTarget ?? null,
  xG: team?.xG ?? null,
  passes: team?.passes ?? null,
  passAccuracy: team?.passAccuracy ?? null,
  tackles: team?.tackles ?? null,
  tacklesWon: team?.tacklesWon ?? null,
  interceptions: team?.interceptions ?? null,
  saves: team?.saves ?? null,
  foulsCommitted: team?.foulsCommitted ?? null,
  offsides: team?.offsides ?? null,
  corners: team?.corners ?? null,
  freeKicks: team?.freeKicks ?? null,
  yellowCards: team?.yellowCards ?? null,
  dribbleSuccessRate: team?.dribbleSuccessRate ?? null,
  shotAccuracy: team?.shotAccuracy ?? null,
  ballRecoveryTime: team?.ballRecoveryTime ?? null,
  penaltyKicks: team?.penaltyKicks ?? null,
})
const buildDraftStats = (team: VisionExtraction['psg'] | VisionExtraction['opponent']) => {
  const stats = createEmptyStats()
  const built = buildStatsFromExtractedTeam(team)

  for (const field of statFields) {
    stats[field.key] = built[field.key] ?? null
  }

  return stats
}

export const extractionToDraft = (
  extraction: VisionExtraction,
  sideOverride?: 'left' | 'right',
  options?: ExtractionDraftOptions,
): DraftMatch => {
  const playingSide =
    sideOverride ??
    (extraction.psgSide === 'left' || extraction.psgSide === 'right'
      ? extraction.psgSide
      : undefined)

  const playedAs = normalizeTeamLabel(options?.playedAs?.trim() || LEGACY_DEFAULT_PLAYED_AS)

  if (extraction.psgSide === 'both' && playingSide) {
    const { myTeam, theirTeam } = resolveBothSideTeams(extraction, playingSide)
    const opponentTeam = toOpponentTeam(theirTeam, getPrimaryGameDisplayName(playedAs))

    return {
      date: resolveDraftMatchDate(extraction, options),
      playedAs,
      opponent: normaliseTeamName(opponentTeam.name),
      venue: playingSide === 'right' ? 'away' : 'home',
      myScore: toStatNumber(myTeam?.score),
      opponentScore: toStatNumber(theirTeam?.score),
      loggedVia: options?.loggedVia ?? 'screenshot',
      stats: buildDraftStats(myTeam),
      opponentStats: buildOpponentStatsFromExtraction(opponentTeam),
      xboxContentId: options?.xboxContentId ?? null,
      screenshotArchiveKey: options?.screenshotArchiveKey ?? null,
      comment: null,
      commentAuthor: null,
    }
  }

  const stats = buildDraftStats(extraction.psg)

  return {
    date: resolveDraftMatchDate(extraction, options),
    playedAs,
    opponent: normaliseTeamName(extraction.opponent?.name ?? 'Unknown opponent'),
    venue: playingSide === 'right' ? 'away' : 'home',
    myScore: toStatNumber(extraction.psg?.score),
    opponentScore: toStatNumber(extraction.opponent?.score),
    loggedVia: options?.loggedVia ?? 'screenshot',
    stats,
    opponentStats: buildOpponentStatsFromExtraction(extraction.opponent),
    xboxContentId: options?.xboxContentId ?? null,
    screenshotArchiveKey: options?.screenshotArchiveKey ?? null,
    comment: null,
    commentAuthor: null,
  }
}

export const sortMatchesNewestFirst = (matches: Match[]) =>
  [...matches].sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
    return dateDiff || b.id - a.id
  })

export const BASELINE_RECORD = { W: 184, D: 48, L: 150 } as const

export type BaselineFormEntry = {
  result: Result
  opponent?: string
  venue?: Venue
  myScore?: number
  opponentScore?: number
}

/** Pre-entered recent form, newest result first (leftmost tile). */
export const BASELINE_FORM: BaselineFormEntry[] = []

const baselineFormEntryToMatch = (entry: BaselineFormEntry, index: number): Match => ({
  id: -1 - index,
  date: '1970-01-01',
  opponent: entry.opponent ?? 'Unknown opponent',
  venue: entry.venue ?? 'home',
  myScore: entry.myScore ?? 0,
  opponentScore: entry.opponentScore ?? 0,
  result: entry.result,
  loggedVia: 'quick-log',
  stats: null,
  opponentStats: null,
  xboxContentId: null,
  comments: [],
})

export const getFormTickerMatches = (matches: Match[]): Match[] => [
  ...sortMatchesNewestFirst(matches),
  ...BASELINE_FORM.map(baselineFormEntryToMatch),
]

export type ManualFormDraft = {
  playedAs?: string
  opponent: string
  venue: Venue
  result: Result
  reason: string
}

const placeholderScoresForResult = (result: Result) => {
  if (result === 'W') return { myScore: 1, opponentScore: 0 }
  if (result === 'L') return { myScore: 0, opponentScore: 1 }
  return { myScore: 0, opponentScore: 0 }
}

export const isManualFormMatch = (match: Match) => match.loggedVia === 'manual-form'

export const isStatsMatch = (match: Match) => match.loggedVia !== 'manual-form'

export const createManualFormMatch = (draft: ManualFormDraft): Match => {
  const { myScore, opponentScore } = placeholderScoresForResult(draft.result)
  const reason = draft.reason.trim()

  return {
    id: Date.now(),
    date: dateToInputValue(new Date()),
    playedAs: normalizeTeamLabel(draft.playedAs?.trim() || LEGACY_DEFAULT_PLAYED_AS),
    opponent: normaliseTeamName(draft.opponent.trim() || 'Unknown opponent'),
    venue: draft.venue,
    myScore,
    opponentScore,
    result: draft.result,
    loggedVia: 'manual-form',
    stats: null,
    opponentStats: null,
    xboxContentId: null,
    comments: [],
    manualEntryReason: reason || null,
  }
}

export const getMatchRecord = (matches: Match[]) => ({
  W: matches.filter((match) => match.result === 'W').length,
  D: matches.filter((match) => match.result === 'D').length,
  L: matches.filter((match) => match.result === 'L').length,
})

export const getSeasonRecord = (matches: Match[]) => {
  const logged = getMatchRecord(matches)

  return {
    W: BASELINE_RECORD.W + logged.W,
    D: BASELINE_RECORD.D + logged.D,
    L: BASELINE_RECORD.L + logged.L,
  }
}

export const getTrackerRecord = (matches: Match[]) => getMatchRecord(matches)

export type StreakRunStats = {
  total: number
  wins: number
  draws: number
}

export const getCurrentUnbeatenStreak = (matches: Match[]): StreakRunStats => {
  let wins = 0
  let draws = 0

  for (const match of getFormTickerMatches(matches)) {
    if (match.result === 'L') break
    if (match.result === 'W') wins += 1
    else if (match.result === 'D') draws += 1
  }

  return { total: wins + draws, wins, draws }
}

const beatsLongestUnbeatenRun = (candidate: StreakRunStats, longest: StreakRunStats) => {
  if (candidate.total > longest.total) return true
  if (candidate.total < longest.total) return false
  return candidate.wins > longest.wins
}

const getLongestUnbeatenRunStats = (matches: Match[]): StreakRunStats => {
  const chronological = [...getFormTickerMatches(matches)].reverse()
  let currentWins = 0
  let currentDraws = 0
  let longest: StreakRunStats = { total: 0, wins: 0, draws: 0 }

  const commitCurrentRun = () => {
    const total = currentWins + currentDraws
    const candidate = { total, wins: currentWins, draws: currentDraws }
    if (beatsLongestUnbeatenRun(candidate, longest)) {
      longest = candidate
    }
    currentWins = 0
    currentDraws = 0
  }

  for (const match of chronological) {
    if (match.result === 'L') {
      commitCurrentRun()
      continue
    }

    if (match.result === 'W') currentWins += 1
    else if (match.result === 'D') currentDraws += 1
  }

  commitCurrentRun()
  return longest
}

export const getLongestUnbeatenRun = (matches: Match[]): StreakRunStats =>
  getLongestUnbeatenRunStats(matches)

export type WinningRunStats = StreakRunStats & {
  goalsFor: number
  goalsAgainst: number
}

export const getLongestWinningRun = (matches: Match[]): WinningRunStats => {
  const chronological = [...getFormTickerMatches(matches)].reverse()
  let currentMatches: Match[] = []
  let longestMatches: Match[] = []

  const commitRun = () => {
    if (currentMatches.length > longestMatches.length) {
      longestMatches = [...currentMatches]
    }
    currentMatches = []
  }

  for (const match of chronological) {
    if (match.result === 'W') {
      currentMatches.push(match)
    } else {
      commitRun()
    }
  }

  commitRun()

  return {
    total: longestMatches.length,
    wins: longestMatches.length,
    draws: 0,
    goalsFor: longestMatches.reduce((sum, match) => sum + match.myScore, 0),
    goalsAgainst: longestMatches.reduce((sum, match) => sum + match.opponentScore, 0),
  }
}

export const MIN_NOTABLE_STREAK_LENGTH = 5

export type DatedStreakRun = StreakRunStats & {
  startDate: string
  endDate: string | null
  isActive: boolean
}

export type DatedWinStreak = {
  wins: number
  startDate: string
  endDate: string | null
  isActive: boolean
}

export type StreakAnalysis = {
  currentUnbeaten: StreakRunStats
  currentWinning: StreakRunStats
  longestUnbeaten: StreakRunStats
  longestWinning: WinningRunStats
  notableUnbeatenRuns: DatedStreakRun[]
  notableWinStreaks: DatedWinStreak[]
}

export const getCurrentWinningStreak = (matches: Match[]): StreakRunStats => {
  let wins = 0

  for (const match of getFormTickerMatches(matches)) {
    if (match.result !== 'W') break
    wins += 1
  }

  return { total: wins, wins, draws: 0 }
}

const buildUnbeatenRuns = (matches: Match[]): DatedStreakRun[] => {
  const chronological = [...getFormTickerMatches(matches)].reverse()
  const runs: DatedStreakRun[] = []
  let wins = 0
  let draws = 0
  let startDate: string | null = null
  let runMatches: Match[] = []

  const commitRun = (isActive: boolean) => {
    const total = wins + draws
    if (total === 0 || !startDate) return

    runs.push({
      total,
      wins,
      draws,
      startDate,
      endDate: isActive ? null : (runMatches[runMatches.length - 1]?.date ?? null),
      isActive,
    })
    wins = 0
    draws = 0
    startDate = null
    runMatches = []
  }

  for (const match of chronological) {
    if (match.result === 'L') {
      commitRun(false)
      continue
    }

    if (!startDate) startDate = match.date
    if (match.result === 'W') wins += 1
    else if (match.result === 'D') draws += 1
    runMatches.push(match)
  }

  commitRun(true)
  return runs
}

const buildWinStreaks = (matches: Match[]): DatedWinStreak[] => {
  const chronological = [...getFormTickerMatches(matches)].reverse()
  const runs: DatedWinStreak[] = []
  let wins = 0
  let startDate: string | null = null
  let runMatches: Match[] = []

  const commitRun = (isActive: boolean) => {
    if (wins === 0 || !startDate) return

    runs.push({
      wins,
      startDate,
      endDate: isActive ? null : (runMatches[runMatches.length - 1]?.date ?? null),
      isActive,
    })
    wins = 0
    startDate = null
    runMatches = []
  }

  for (const match of chronological) {
    if (match.result !== 'W') {
      commitRun(false)
      continue
    }

    if (!startDate) startDate = match.date
    wins += 1
    runMatches.push(match)
  }

  commitRun(true)
  return runs
}

const sortUnbeatenRunsNewestFirst = (left: DatedStreakRun, right: DatedStreakRun) => {
  if (left.isActive !== right.isActive) return left.isActive ? -1 : 1
  return right.startDate.localeCompare(left.startDate) || right.total - left.total
}

const sortWinStreaksNewestFirst = (left: DatedWinStreak, right: DatedWinStreak) => {
  if (left.isActive !== right.isActive) return left.isActive ? -1 : 1
  return right.startDate.localeCompare(left.startDate) || right.wins - left.wins
}

export const getStreakAnalysis = (matches: Match[]): StreakAnalysis => {
  const allUnbeatenRuns = buildUnbeatenRuns(matches)
  const allWinStreaks = buildWinStreaks(matches)

  return {
    currentUnbeaten: getCurrentUnbeatenStreak(matches),
    currentWinning: getCurrentWinningStreak(matches),
    longestUnbeaten: getLongestUnbeatenRun(matches),
    longestWinning: getLongestWinningRun(matches),
    notableUnbeatenRuns: allUnbeatenRuns
      .filter((run) => run.total >= MIN_NOTABLE_STREAK_LENGTH)
      .sort(sortUnbeatenRunsNewestFirst),
    notableWinStreaks: allWinStreaks
      .filter(
        (run) => run.wins >= MIN_NOTABLE_STREAK_LENGTH || (run.isActive && run.wins > 0),
      )
      .sort(sortWinStreaksNewestFirst),
  }
}

export const getOpponentXg = (match: Match): number | null => {
  const explicit = match.opponentStats?.xG
  return typeof explicit === 'number' ? explicit : null
}

export const getXgRecord = (matches: Match[]) => {
  const record = { W: 0, D: 0, L: 0 }

  for (const match of matches) {
    const psgXg = match.stats?.xG
    const opponentXg = getOpponentXg(match)

    if (typeof psgXg !== 'number' || typeof opponentXg !== 'number') continue

    if (psgXg > opponentXg) record.W += 1
    else if (psgXg < opponentXg) record.L += 1
    else record.D += 1
  }

  return record
}
