import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect } from 'vite'
import type { Plugin } from 'vite'
import { readApiEnv, type ApiEnv } from './env'
import { handleExtractMatchRequest } from './extractMatch'
import { configureHttpTimeouts } from './httpTimeouts'
import { handleXboxExtractMatchRequest, handleXboxScreenshotsRequest } from './xboxScreenshots'

export type { ApiEnv } from './env'

const routeRequest = (
  req: IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
  env: ApiEnv,
) => {
  const pathname = req.url?.split('?')[0]

  if (pathname === '/api/extract-match' && req.method === 'POST') {
    void handleExtractMatchRequest(req, res, env.anthropicApiKey)
    return
  }

  if (pathname === '/api/xbox/screenshots' && req.method === 'GET') {
    void handleXboxScreenshotsRequest(req, res, env.openXblApiKey)
    return
  }

  if (pathname === '/api/xbox/extract-match' && req.method === 'POST') {
    void handleXboxExtractMatchRequest(req, res, env.anthropicApiKey, env.openXblApiKey)
    return
  }

  next()
}

const attachApi = (middlewares: Connect.Server) => {
  middlewares.use((req, res, next) => routeRequest(req, res, next, readApiEnv()))
}

export function apiPlugin(): Plugin {
  return {
    name: 'extract-match-api',
    configureServer(server) {
      configureHttpTimeouts(server.httpServer)
      attachApi(server.middlewares)
    },
    configurePreviewServer(server) {
      configureHttpTimeouts(server.httpServer)
      attachApi(server.middlewares)
    },
  }
}
