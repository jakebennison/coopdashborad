import {
  DEFAULT_PLAYED_TEAMS,
  DEFAULT_SELECTED_TEAM,
} from './teamConfig'

const PLAYED_TEAMS_KEY = 'coop-played-teams'
const SELECTED_TEAM_KEY = 'coop-selected-team'

export const readPlayedTeams = (): string[] => {
  try {
    const raw = window.localStorage.getItem(PLAYED_TEAMS_KEY)
    if (!raw) return [...DEFAULT_PLAYED_TEAMS]

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [...DEFAULT_PLAYED_TEAMS]

    const teams = parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean)

    return teams.length ? teams : [...DEFAULT_PLAYED_TEAMS]
  } catch {
    return [...DEFAULT_PLAYED_TEAMS]
  }
}

export const writePlayedTeams = (teams: string[]) => {
  window.localStorage.setItem(PLAYED_TEAMS_KEY, JSON.stringify(teams))
}

export const readSelectedTeam = (): string => {
  try {
    const raw = window.localStorage.getItem(SELECTED_TEAM_KEY)
    if (!raw) return DEFAULT_SELECTED_TEAM

    const trimmed = raw.trim()
    return trimmed || DEFAULT_SELECTED_TEAM
  } catch {
    return DEFAULT_SELECTED_TEAM
  }
}

export const writeSelectedTeam = (team: string) => {
  window.localStorage.setItem(SELECTED_TEAM_KEY, team.trim())
}
