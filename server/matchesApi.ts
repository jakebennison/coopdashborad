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
import {
  attachScreenshotForMatch,
  deleteAllMatchScreenshots,
  deleteMatchScreenshot,
  getMatchScreenshot,
  listMatchIdsWithScreenshots,
} from './screenshotArchive'

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const parseMatchId = (pathname: string) => {
  const match = pathname.match(/^\/api\/matches\/(\d+)$/)
  return match ? Number(match[1]) : null
}

const parseMatchScreenshotId = (pathname: string) => {
  const match = pathname.match(/^\/api\/matches\/(\d+)\/screenshot$/)
  return match ? Number(match[1]) : null
}

type CreateMatchBody = {
  match: Match
  screenshotArchiveKey?: string | null
}

const normalizeCreateMatchBody = (body: Match | CreateMatchBody): CreateMatchBody => {
  if (body && typeof body === 'object' && 'match' in body && body.match) {
    return body as CreateMatchBody
  }

  return { match: body as Match }
}

const enrichMatchesWithScreenshotFlags = async (matches: Match[]) => {
  const archivedIds = await listMatchIdsWithScreenshots()
  return matches.map((match) => ({
    ...match,
    hasArchivedScreenshot: archivedIds.has(match.id) || Boolean(match.hasArchivedScreenshot),
  }))
}

export async function handleListMatchesRequest(_req: IncomingMessage, res: ServerResponse) {
  try {
    const matches = await enrichMatchesWithScreenshotFlags(await listMatches())
    sendJson(res, 200, { matches })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load matches.'
    sendJson(res, 500, { error: message })
  }
}

export async function handleCreateMatchRequest(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = normalizeCreateMatchBody(await readJsonBody<Match | CreateMatchBody>(req))
    const match = body.match

    if (!match?.id || !match.date || !match.opponent) {
      throw new Error('Match payload is incomplete.')
    }

    let saved = await createMatch(match)
    const archived = await attachScreenshotForMatch(
      saved.id,
      body.screenshotArchiveKey,
      saved.xboxContentId,
    )

    if (archived) {
      saved = (await updateMatch({ ...saved, hasArchivedScreenshot: true })) ?? {
        ...saved,
        hasArchivedScreenshot: true,
      }
    }

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
    await deleteMatchScreenshot(id)
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
    await deleteAllMatchScreenshots()
    await deleteAllMatches()
    sendJson(res, 200, { ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not clear matches.'
    sendJson(res, 500, { error: message })
  }
}

export async function handleGetMatchScreenshotRequest(
  _req: IncomingMessage,
  res: ServerResponse,
  id: number,
) {
  try {
    const screenshot = await getMatchScreenshot(id)
    if (!screenshot) {
      sendJson(res, 404, { error: 'Archived screenshot not found.' })
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', screenshot.mediaType)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.end(screenshot.buffer)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load screenshot.'
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

  const screenshotMatchId = parseMatchScreenshotId(pathname)
  if (screenshotMatchId != null && req.method === 'GET') {
    await handleGetMatchScreenshotRequest(req, res, screenshotMatchId)
    return true
  }

  if (matchId != null && req.method === 'DELETE') {
    await handleDeleteMatchRequest(req, res, matchId)
    return true
  }

  return false
}
