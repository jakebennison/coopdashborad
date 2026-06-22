import type { Match } from './types'
import { normalizeTeamLabel } from './teamConfig'

export const LEGACY_DEFAULT_PLAYED_AS = 'PSG'

export const getMatchPlayedAs = (match: Match): string =>
  match.playedAs?.trim() || LEGACY_DEFAULT_PLAYED_AS

export const migrateMatchPlayedAs = (match: Match): Match =>
  match.playedAs?.trim()
    ? { ...match, playedAs: normalizeTeamLabel(match.playedAs) }
    : { ...match, playedAs: LEGACY_DEFAULT_PLAYED_AS }

export const filterMatchesByTeam = (matches: Match[], team: string): Match[] =>
  matches.filter((match) => getMatchPlayedAs(match) === team)
