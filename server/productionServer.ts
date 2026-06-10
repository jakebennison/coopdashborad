import { createReadStream, existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import path from 'node:path'
import { handleApiRequest } from './apiRoutes'
import { loadLocalEnvFile } from './env'
import { configureHttpTimeouts } from './httpTimeouts'
import { ensureMatchesStore } from './matchesStore'

loadLocalEnvFile()

const DIST_DIR = path.resolve(process.cwd(), 'dist')
const PORT = Number(process.env.PORT) || 4173

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
}

const resolveStaticPath = (pathname: string) => {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const filePath = path.resolve(DIST_DIR, relativePath)

  if (filePath !== DIST_DIR && !filePath.startsWith(`${DIST_DIR}${path.sep}`)) {
    return null
  }

  return filePath
}

const serveStatic = async (req: IncomingMessage, res: ServerResponse, pathname: string) => {
  let filePath = resolveStaticPath(pathname)

  if (!filePath || !existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html')
  }

  if (!existsSync(filePath)) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('App build not found. Run npm run build before starting the server.')
    return
  }

  const fileStat = await stat(filePath)
  if (fileStat.isDirectory()) {
    await serveStatic(req, res, `${pathname.replace(/\/$/, '')}/index.html`)
    return
  }

  const ext = path.extname(filePath).toLowerCase()
  res.statusCode = 200
  res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'application/octet-stream')
  createReadStream(filePath).pipe(res)
}

const server = createServer((req, res) => {
  void (async () => {
    const host = req.headers.host ?? 'localhost'
    const pathname = new URL(req.url ?? '/', `http://${host}`).pathname

    if (await handleApiRequest(req, res, pathname)) return
    await serveStatic(req, res, pathname)
  })().catch((error) => {
    console.error('[server]', error)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Internal server error.' }))
    }
  })
})

configureHttpTimeouts(server)

void ensureMatchesStore()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Production server listening on 0.0.0.0:${PORT}`)
    })
  })
  .catch((error) => {
    console.error('[matches] Failed to initialize storage:', error)
    process.exit(1)
  })

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error)
})
