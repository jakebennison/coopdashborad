import type { Match } from './types'
import { normalizeTeamLabel } from './teamConfig'

export const LEGACY_DEFAULT_PLAYED_AS = 'PSG'

export const OVERALL_TEAM_SCOPE = 'overall' as const

export type TeamScope = typeof OVERALL_TEAM_SCOPE | string

export const getMatchPlayedAs = (match: Match): string =>
  match.playedAs?.trim() || LEGACY_DEFAULT_PLAYED_AS

export const migrateMatchPlayedAs = (match: Match): Match =>
  match.playedAs?.trim()
    ? { ...match, playedAs: normalizeTeamLabel(match.playedAs) }
    : { ...match, playedAs: LEGACY_DEFAULT_PLAYED_AS }

export const filterMatchesByTeam = (matches: Match[], team: string): Match[] =>
  matches.filter((match) => getMatchPlayedAs(match) === team)

export const filterMatchesByTeamScope = (matches: Match[], scope: TeamScope): Match[] => {
  if (scope === OVERALL_TEAM_SCOPE) return matches
  return filterMatchesByTeam(matches, scope)
}

export const getTeamsFromMatches = (matches: Match[]): string[] => {
  const counts = new Map<string, number>()

  for (const match of matches) {
    const team = getMatchPlayedAs(match)
    counts.set(team, (counts.get(team) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([team]) => team)
}

export const getStatsTeamLabel = (scope: TeamScope): string =>
  scope === OVERALL_TEAM_SCOPE ? 'Team' : scope
