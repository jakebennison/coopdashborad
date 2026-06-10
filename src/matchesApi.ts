import { readApiError } from './apiClient'
import type { Match } from './types'

type MatchesResponse = {
  matches: Match[]
  error?: string
}

type MatchResponse = {
  match: Match
  error?: string
}

const parseMatches = (data: MatchesResponse) => data.matches ?? []

export const fetchMatches = async (): Promise<Match[]> => {
  const response = await fetch('/api/matches')

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not load matches.'))
  }

  const data = (await response.json()) as MatchesResponse
  return parseMatches(data)
}

export const createMatchRemote = async (
  match: Match,
  screenshotArchiveKey?: string | null,
): Promise<Match> => {
  const response = await fetch('/api/matches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      match,
      screenshotArchiveKey: screenshotArchiveKey ?? null,
    }),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not save match.'))
  }

  const data = (await response.json()) as MatchResponse
  return data.match
}

export const updateMatchRemote = async (match: Match): Promise<Match> => {
  const response = await fetch(`/api/matches/${match.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(match),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not update match.'))
  }

  const data = (await response.json()) as MatchResponse
  return data.match
}

export const getMatchScreenshotUrl = (matchId: number) => `/api/matches/${matchId}/screenshot`

export const deleteMatchRemote = async (id: number): Promise<void> => {
  const response = await fetch(`/api/matches/${id}`, { method: 'DELETE' })

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not delete match.'))
  }
}

export const deleteAllMatchesRemote = async (): Promise<void> => {
  const response = await fetch('/api/matches', { method: 'DELETE' })

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not clear matches.'))
  }
}
