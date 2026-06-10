import type { IncomingMessage, ServerResponse } from 'node:http'
import { readApiEnv } from './env'
import { handleExtractMatchRequest } from './extractMatch'
import { handleMatchesRequest } from './matchesApi'
import { handleXboxExtractMatchRequest, handleXboxScreenshotsRequest } from './xboxScreenshots'

const sendUnhandledError = (res: ServerResponse) => {
  if (res.headersSent) return

  res.statusCode = 500
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: 'Internal server error.' }))
}

const runHandler = async (
  handler: (req: IncomingMessage, res: ServerResponse, ...args: string[]) => Promise<void>,
  req: IncomingMessage,
  res: ServerResponse,
  ...args: string[]
) => {
  try {
    await handler(req, res, ...args)
  } catch (error) {
    console.error('[api]', error)
    sendUnhandledError(res)
  }
}

export const handleApiRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> => {
  if (pathname === '/api/health' && req.method === 'GET') {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: true }))
    return true
  }

  if (await handleMatchesRequest(req, res, pathname)) return true

  const env = readApiEnv()

  if (pathname === '/api/extract-match' && req.method === 'POST') {
    await runHandler(handleExtractMatchRequest, req, res, env.anthropicApiKey)
    return true
  }

  if (pathname === '/api/xbox/screenshots' && req.method === 'GET') {
    await runHandler(handleXboxScreenshotsRequest, req, res, env.openXblApiKey)
    return true
  }

  if (pathname === '/api/xbox/extract-match' && req.method === 'POST') {
    await runHandler(
      handleXboxExtractMatchRequest,
      req,
      res,
      env.anthropicApiKey,
      env.openXblApiKey,
    )
    return true
  }

  return false
}
