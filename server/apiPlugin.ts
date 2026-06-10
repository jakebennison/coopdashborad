import type { Connect } from 'vite'
import type { Plugin } from 'vite'
import { handleApiRequest } from './apiRoutes'
import { configureHttpTimeouts } from './httpTimeouts'

export type { ApiEnv } from './env'

const attachApi = (middlewares: Connect.Server) => {
  middlewares.use((req, res, next) => {
    void (async () => {
      const pathname = req.url?.split('?')[0] ?? ''
      if (await handleApiRequest(req, res, pathname)) return
      next()
    })().catch((error) => {
      console.error('[api]', error)
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Internal server error.' }))
      }
    })
  })
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
