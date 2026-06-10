import type { IncomingMessage, ServerResponse } from 'node:http'

export const LONG_REQUEST_MS = 600_000
export const ANTHROPIC_REQUEST_MS = 180_000

type TimeoutCapableServer = {
  requestTimeout?: number
  headersTimeout?: number
  keepAliveTimeout?: number
}

export const configureHttpTimeouts = (httpServer: unknown) => {
  if (!httpServer || typeof httpServer !== 'object' || !('requestTimeout' in httpServer)) return

  const server = httpServer as TimeoutCapableServer
  server.requestTimeout = LONG_REQUEST_MS
  server.headersTimeout = LONG_REQUEST_MS + 60_000
  server.keepAliveTimeout = 120_000
}

export const configureLongRunningRequest = (req: IncomingMessage, res: ServerResponse) => {
  req.setTimeout(LONG_REQUEST_MS)
  res.setTimeout(LONG_REQUEST_MS)
}
