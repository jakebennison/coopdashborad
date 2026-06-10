import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect } from 'vite'
import type { Plugin } from 'vite'
import { handleExtractMatchRequest } from './extractMatch'
import { handleXboxExtractMatchRequest, handleXboxScreenshotsRequest } from './xboxScreenshots'

export type ApiEnv = {
  anthropicApiKey: string
  openXblApiKey: string
}

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

const attachApi = (middlewares: Connect.Server, getEnv: () => ApiEnv) => {
  middlewares.use((req, res, next) => routeRequest(req, res, next, getEnv()))
}

export function apiPlugin(getEnv: () => ApiEnv): Plugin {
  return {
    name: 'extract-match-api',
    configureServer(server) {
      attachApi(server.middlewares, getEnv)
    },
    configurePreviewServer(server) {
      attachApi(server.middlewares, getEnv)
    },
  }
}
