import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Match } from '../src/types'
import { readJsonBody } from './extractMatch'
import {
  createMatch,
  deleteAllMatches,
  deleteMatch,
  listMatches,
  updateMatch,
} from './matchesStore'

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const parseMatchId = (pathname: string) => {
  const match = pathname.match(/^\/api\/matches\/(\d+)$/)
  return match ? Number(match[1]) : null
}

export async function handleListMatchesRequest(_req: IncomingMessage, res: ServerResponse) {
  try {
    const matches = await listMatches()
    sendJson(res, 200, { matches })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load matches.'
    sendJson(res, 500, { error: message })
  }
}

export async function handleCreateMatchRequest(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await readJsonBody<Match>(req)
    if (!body?.id || !body.date || !body.opponent) {
      throw new Error('Match payload is incomplete.')
    }

    const saved = await createMatch(body)
    sendJson(res, 201, { match: saved })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save match.'
    sendJson(res, 400, { error: message })
  }
}

export async function handleUpdateMatchRequest(
  req: IncomingMessage,
  res: ServerResponse,
  id: number,
) {
  try {
    const body = await readJsonBody<Match>(req)
    if (body.id !== id) {
      throw new Error('Match ID mismatch.')
    }

    const saved = await updateMatch(body)
    if (!saved) {
      sendJson(res, 404, { error: 'Match not found.' })
      return
    }

    sendJson(res, 200, { match: saved })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update match.'
    sendJson(res, 400, { error: message })
  }
}

export async function handleDeleteMatchRequest(
  _req: IncomingMessage,
  res: ServerResponse,
  id: number,
) {
  try {
    const deleted = await deleteMatch(id)
    if (!deleted) {
      sendJson(res, 404, { error: 'Match not found.' })
      return
    }

    sendJson(res, 200, { ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not delete match.'
    sendJson(res, 500, { error: message })
  }
}

export async function handleDeleteAllMatchesRequest(_req: IncomingMessage, res: ServerResponse) {
  try {
    await deleteAllMatches()
    sendJson(res, 200, { ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not clear matches.'
    sendJson(res, 500, { error: message })
  }
}

export const handleMatchesRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  if (pathname === '/api/matches' && req.method === 'GET') {
    await handleListMatchesRequest(req, res)
    return true
  }

  if (pathname === '/api/matches' && req.method === 'POST') {
    await handleCreateMatchRequest(req, res)
    return true
  }

  if (pathname === '/api/matches' && req.method === 'DELETE') {
    await handleDeleteAllMatchesRequest(req, res)
    return true
  }

  const matchId = parseMatchId(pathname)
  if (matchId != null && req.method === 'PUT') {
    await handleUpdateMatchRequest(req, res, matchId)
    return true
  }

  if (matchId != null && req.method === 'DELETE') {
    await handleDeleteMatchRequest(req, res, matchId)
    return true
  }

  return false
}
